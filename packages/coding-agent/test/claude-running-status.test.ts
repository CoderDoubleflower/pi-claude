import type { TUI } from "@earendil-works/pi-tui";
import { describe, expect, test } from "vitest";
import type { TodoItem } from "../src/core/tools/todo-write.ts";
import { TodoPanelComponent } from "../src/extensions/todo-panel.ts";
import {
	encodeClaudeRunningMessage,
	formatClaudeRunningMessage,
} from "../src/modes/interactive/components/claude-running-status.ts";
import { WorkingStatusIndicator } from "../src/modes/interactive/components/status-indicator.ts";
import { initTheme, theme } from "../src/modes/interactive/theme/theme.ts";
import { stripAnsi } from "../src/utils/ansi.ts";

function createTui(): TUI {
	return { requestRender() {}, terminal: { rows: 24 } } as unknown as TUI;
}

const todos: TodoItem[] = [
	{ content: "Record the environment baseline", status: "completed", activeForm: "Recording the baseline" },
	{ content: "Validate the test entry point", status: "completed", activeForm: "Validating the entry point" },
	{ content: "Summarize the environment results", status: "in_progress", activeForm: "Summarizing results" },
];

describe("Claude running status parity", () => {
	test("renders elapsed time, output-token estimate, and thinking effort in the spinner row", () => {
		initTheme("dark");
		const indicator = new WorkingStatusIndicator(
			createTui(),
			encodeClaudeRunningMessage(
				{
					elapsedMs: 198_000,
					responseCharacters: 28_000,
					mode: "thinking",
					thinkingStatus: "thinking",
					effortLevel: "medium",
				},
				"Summarizing environment test results…",
			),
			{ frames: ["✻"] },
		);
		const rendered = indicator.render(140);
		const line = rendered.map(stripAnsi).find((entry) => entry.trim().length > 0);
		indicator.dispose();

		expect(line?.trimEnd()).toBe(
			"✻ Summarizing environment test results… (3m 18s · ↓ 7.0k tokens · thinking with medium effort)",
		);
	});

	test("uses Claude Code's verbose branch from the first frame", () => {
		const base = {
			responseCharacters: 4000,
			mode: "requesting" as const,
			thinkingStatus: null,
		};
		expect(formatClaudeRunningMessage("Working…", { ...base, elapsedMs: 0 }, 100)).toBe(
			"Working… (0s · ↑ 1.0k tokens)",
		);
		expect(formatClaudeRunningMessage("Working…", { ...base, elapsedMs: 750, responseCharacters: 0 }, 100)).toBe(
			"Working… (0s)",
		);
	});

	test("prioritizes thinking and drops effort, timer, and tokens on narrow terminals", () => {
		const message = formatClaudeRunningMessage(
			"Working…",
			{
				elapsedMs: 60_000,
				responseCharacters: 8000,
				mode: "thinking",
				thinkingStatus: "thinking",
				effortLevel: "medium",
			},
			22,
		);
		expect(message).toBe("Working… (thinking)");
	});

	test("renders the todo connector on the row immediately after the spinner", () => {
		initTheme("dark");
		const indicator = new WorkingStatusIndicator(
			createTui(),
			encodeClaudeRunningMessage(
				{
					elapsedMs: 198_000,
					responseCharacters: 28_000,
					mode: "thinking",
					thinkingStatus: "thinking",
					effortLevel: "medium",
					todos,
				},
				"Summarizing environment test results…",
			),
			{ frames: ["✻"] },
		);
		const lines = indicator.render(140).map(stripAnsi);
		indicator.dispose();

		const spinnerIndex = lines.findIndex((line) => line.includes("Summarizing environment test results"));
		expect(spinnerIndex).toBeGreaterThanOrEqual(0);
		expect(lines[spinnerIndex + 1]).toMatch(/^ {2}⎿ [✔√] Record the environment baseline/);
	});
});

describe("Claude todo tree connector", () => {
	test("attaches the active todo list directly beneath the spinner with a single connector", () => {
		initTheme("dark");
		const lines = new TodoPanelComponent(todos, theme, () => 24, false).render(100).map(stripAnsi);

		expect(lines[0]).toMatch(/^ {2}⎿ [✔√] Record the environment baseline/);
		expect(lines[1]).toMatch(/^ {4}[✔√] Validate the test entry point/);
		expect(lines[2]).toMatch(/^ {4}[◼■] Summarize the environment results/);
		expect(lines.slice(1).join("\n")).not.toContain("⎿");
	});
});
