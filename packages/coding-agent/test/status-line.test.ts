import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SettingsManager } from "../src/core/settings-manager.ts";
import {
	normalizeStatusLineOutput,
	type StatusLineCommandInput,
	StatusLineCommandRunner,
} from "../src/core/status-line.ts";
import { appendExtensionStatuses } from "../src/modes/interactive/components/footer.ts";
import { initTheme } from "../src/modes/interactive/theme/theme.ts";
import { stripAnsi } from "../src/utils/ansi.ts";

initTheme("dark");

const input: StatusLineCommandInput = {
	cwd: process.cwd(),
	session_id: "session-1",
	transcript_path: "/tmp/session.jsonl",
	model: { id: "test-model", display_name: "Test Model" },
	workspace: { current_dir: process.cwd(), project_dir: process.cwd(), added_dirs: [] },
	version: "0.0.0",
	output_style: { name: "default" },
	cost: {
		total_cost_usd: 0,
		total_duration_ms: 0,
		total_api_duration_ms: 0,
		total_lines_added: 0,
		total_lines_removed: 0,
	},
	context_window: {
		total_input_tokens: 0,
		total_output_tokens: 0,
		context_window_size: 200_000,
		current_usage: null,
		used_percentage: 0,
		remaining_percentage: 100,
	},
	exceeds_200k_tokens: false,
	effort: { level: "off" },
	thinking: { enabled: false },
	pi: { git_branch: "main", extension_statuses: {} },
};

describe("status line settings", () => {
	it("normalizes command settings", () => {
		const settings = SettingsManager.inMemory({
			statusLine: {
				type: "command",
				command: "./statusline.sh",
				padding: 2.9,
				refreshInterval: 0,
			},
		});

		expect(settings.getStatusLine()).toEqual({
			type: "command",
			command: "./statusline.sh",
			padding: 2,
			refreshInterval: 1,
		});
	});
});

describe("status line command", () => {
	it("normalizes multi-line output", () => {
		expect(normalizeStatusLineOutput("one\r\ntwo\n")).toEqual(["one", "two"]);
		expect(normalizeStatusLineOutput("\n")).toEqual([""]);
	});

	it("passes JSON on stdin and preserves ANSI and multiple rows", async () => {
		const directory = mkdtempSync(join(tmpdir(), "pi-status-line-"));
		const scriptPath = join(directory, "statusline.mjs");
		writeFileSync(
			scriptPath,
			`let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", chunk => input += chunk);
process.stdin.on("end", () => {
  const value = JSON.parse(input);
  process.stdout.write("\\u001b[32m" + value.model.id + "\\u001b[0m\\ncols=" + process.env.COLUMNS);
});
`,
		);
		chmodSync(scriptPath, 0o755);

		let resolveRender: (() => void) | undefined;
		const rendered = new Promise<void>((resolve) => {
			resolveRender = resolve;
		});
		const runner = new StatusLineCommandRunner(() => resolveRender?.());
		const command = `${JSON.stringify(process.execPath)} ${JSON.stringify(scriptPath)}`;

		try {
			const initial = runner.update(
				{ type: "command", command, padding: 1 },
				{ input, cwd: process.cwd(), columns: 88 },
			);
			expect(initial).toEqual({ lines: [""], padding: 1 });

			await Promise.race([
				rendered,
				new Promise<never>((_, reject) => setTimeout(() => reject(new Error("status line timed out")), 3000)),
			]);

			const result = runner.update(
				{ type: "command", command, padding: 1 },
				{ input, cwd: process.cwd(), columns: 88 },
			);
			expect(result.lines.map(stripAnsi)).toEqual(["test-model", "cols=88"]);
		} finally {
			runner.dispose();
			rmSync(directory, { recursive: true, force: true });
		}
	});

	it("does not re-run solely because elapsed duration changed", async () => {
		const directory = mkdtempSync(join(tmpdir(), "pi-status-line-duration-"));
		const scriptPath = join(directory, "statusline-duration.mjs");
		writeFileSync(
			scriptPath,
			`let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", chunk => input += chunk);
process.stdin.on("end", () => {
  const value = JSON.parse(input);
  process.stdout.write(String(value.cost.total_duration_ms));
});
`,
		);
		chmodSync(scriptPath, 0o755);

		let renderCount = 0;
		let resolveFirstRender: (() => void) | undefined;
		const firstRendered = new Promise<void>((resolve) => {
			resolveFirstRender = resolve;
		});
		const runner = new StatusLineCommandRunner(() => {
			renderCount += 1;
			if (renderCount === 1) resolveFirstRender?.();
		});
		const command = `${JSON.stringify(process.execPath)} ${JSON.stringify(scriptPath)}`;
		const settings = { type: "command" as const, command };
		const initialRequest = { input, cwd: process.cwd(), columns: 80 };

		try {
			runner.update(settings, initialRequest);
			await Promise.race([
				firstRendered,
				new Promise<never>((_, reject) => setTimeout(() => reject(new Error("status line timed out")), 3000)),
			]);

			const updatedInput = {
				...input,
				cost: { ...input.cost, total_duration_ms: 1000 },
			};
			const result = runner.update(settings, {
				input: updatedInput,
				cwd: process.cwd(),
				columns: 80,
			});
			await new Promise((resolve) => setTimeout(resolve, 600));

			expect(renderCount).toBe(1);
			expect(result.lines).toEqual(["0"]);
		} finally {
			runner.dispose();
			rmSync(directory, { recursive: true, force: true });
		}
	});
});

describe("footer status composition", () => {
	it("keeps Plan mode visible below custom status-line output", () => {
		const lines = appendExtensionStatuses(
			["custom status"],
			new Map([["native.plan-mode", "\u001b[36m⏸ plan\u001b[0m"]]),
			80,
		);

		expect(lines.map(stripAnsi)).toEqual(["custom status", "⏸ plan"]);
	});
});
