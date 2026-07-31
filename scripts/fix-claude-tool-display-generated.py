#!/usr/bin/env python3
from pathlib import Path

root = Path(__file__).resolve().parents[1]
test_path = root / "packages/coding-agent/test/claude-tool-display.test.ts"

test_path.write_text(
    r'''import { Text } from "@earendil-works/pi-tui";
import { describe, expect, it } from "vitest";
import { createAllToolDefinitions } from "../src/core/tools/index.ts";
import {
	getToolActivityKind,
	ToolActivityGroupComponent,
} from "../src/modes/interactive/components/tool-activity-group.ts";
import { initTheme, theme } from "../src/modes/interactive/theme/theme.ts";
import { stripAnsi } from "../src/utils/ansi.ts";

initTheme("dark");

function context(args: Record<string, unknown>, overrides: Record<string, unknown> = {}): any {
	return {
		args,
		toolCallId: "tool-call",
		invalidate: () => {},
		lastComponent: undefined,
		state: {},
		cwd: process.cwd(),
		executionStarted: true,
		argsComplete: true,
		isPartial: false,
		expanded: false,
		showImages: false,
		isError: false,
		...overrides,
	};
}

function render(component: { render(width: number): string[] } | undefined): string {
	return (component?.render(200) ?? []).map(stripAnsi).join("\n");
}

describe("Claude-style tool presentation", () => {
	it("renders Read results as metadata instead of repeating file contents", () => {
		const definition = createAllToolDefinitions(process.cwd()).read;
		const component = definition.renderResult?.(
			{
				content: [{ type: "text", text: "secret file body" }],
				details: { kind: "text", linesRead: 12 },
			},
			{ expanded: false, isPartial: false },
			theme,
			context({ path: "src/a.ts" }),
		);
		const output = render(component);
		expect(output).toContain("Read 12 lines");
		expect(output).not.toContain("secret file body");
	});

	it("renders search results as counts until expanded", () => {
		const definition = createAllToolDefinitions(process.cwd()).grep;
		const collapsed = definition.renderResult?.(
			{
				content: [{ type: "text", text: "a.ts:1: hit\nb.ts:2: hit" }],
				details: { matchCount: 2, fileCount: 2 },
			},
			{ expanded: false, isPartial: false },
			theme,
			context({ pattern: "hit" }),
		);
		const collapsedOutput = render(collapsed);
		expect(collapsedOutput).toContain("Found 2 matches across 2 files");
		expect(collapsedOutput).not.toContain("a.ts:1");

		const expanded = definition.renderResult?.(
			{
				content: [{ type: "text", text: "a.ts:1: hit\nb.ts:2: hit" }],
				details: { matchCount: 2, fileCount: 2 },
			},
			{ expanded: true, isPartial: false },
			theme,
			context({ pattern: "hit" }, { expanded: true }),
		);
		expect(render(expanded)).toContain("a.ts:1: hit");
	});

	it("groups consecutive reads, searches, listings, and Bash calls", () => {
		const group = new ToolActivityGroupComponent(() => {});
		group.addTool({
			toolCallId: "read-1",
			toolName: "read",
			args: { path: "src/a.ts" },
			kind: "read",
			component: new Text("read src/a.ts", 0, 0),
		});
		group.addTool({
			toolCallId: "grep-1",
			toolName: "grep",
			args: { pattern: "renderToolUse" },
			kind: "search",
			component: new Text("grep renderToolUse", 0, 0),
		});
		group.markStarted("grep-1");
		let output = render(group);
		expect(output).toContain("Searching for 1 pattern, reading 1 file");
		// Claude keeps the first hint visible for at least 700ms to avoid flicker.
		expect(output).toContain("src/a.ts");

		group.markCompleted("read-1", false);
		group.markCompleted("grep-1", false);
		output = render(group);
		expect(output).toContain("Searched for 1 pattern, read 1 file");

		group.setExpanded(true);
		output = render(group);
		expect(output).toContain("read src/a.ts");
		expect(output).toContain("grep renderToolUse");
	});

	it("classifies Bash calls using Claude's read/search/list categories", () => {
		expect(getToolActivityKind("bash", { command: "rg renderToolUse src" })).toBe("search");
		expect(getToolActivityKind("bash", { command: "cat package.json | jq .name" })).toBe("read");
		expect(getToolActivityKind("bash", { command: "ls -la" })).toBe("list");
		expect(getToolActivityKind("bash", { command: "npm test" })).toBe("bash");
	});
});
''',
    encoding="utf-8",
)

behavior_script = root / "scripts/repair-claude-tool-display-behavior.py"
exec(compile(behavior_script.read_text(encoding="utf-8"), str(behavior_script), "exec"))
behavior_script.unlink()

index_path = root / "packages/coding-agent/src/core/tools/index.ts"
index_content = index_path.read_text(encoding="utf-8")
start_index = index_content.index("class ClaudeBashCallComponent implements Component {")
end_index = index_content.index("export function createToolDefinition", start_index)
index_replacement = r'''class ClaudeBashCallComponent implements Component {
	constructor(private readonly lines: string[]) {}

	render(width: number): string[] {
		const contentLines = this.lines.filter((line) => stripAnsi(line).trim().length > 0);
		if (contentLines.length === 0) return [];

		const maxLineWidth = Math.max(1, Math.min(width, BASH_CALL_PREVIEW_MAX_WIDTH));
		const rendered: string[] = [];
		let remainingWidth = BASH_CALL_PREVIEW_MAX_WIDTH;
		let truncated = contentLines.length > BASH_CALL_PREVIEW_MAX_LINES;

		for (const line of contentLines.slice(0, BASH_CALL_PREVIEW_MAX_LINES)) {
			const allowedWidth = Math.max(1, Math.min(maxLineWidth, remainingWidth));
			if (visibleWidth(line) > allowedWidth) {
				rendered.push(truncateToWidth(line, allowedWidth, "…"));
				truncated = true;
				break;
			}
			rendered.push(line);
			remainingWidth -= visibleWidth(line);
			if (remainingWidth <= 0) {
				truncated = contentLines.length > rendered.length;
				break;
			}
		}

		if (truncated && rendered.length > 0) {
			const lastIndex = rendered.length - 1;
			const lastLine = rendered[lastIndex] ?? "";
			if (!stripAnsi(lastLine).endsWith("…")) {
				rendered[lastIndex] = truncateToWidth(`${lastLine}…`, maxLineWidth, "…");
			}
		}
		return rendered;
	}
}

function createBashDisplayToolDefinition(
	cwd: string,
	options?: BashToolOptions,
): ReturnType<typeof createBashToolDefinition> {
	const definition = createBashToolDefinition(cwd, options);
	const renderCall = definition.renderCall;
	if (!renderCall) return definition;

	return {
		...definition,
		renderCall(args, activeTheme, context) {
			const state = context.state as typeof context.state & BashDisplayState;
			const executionArgs = getToolExecutionArguments<BashToolInput>(context.toolCallId);
			if (executionArgs !== undefined) {
				state.canonicalExecutionArgs = executionArgs;
			}

			const displayArgs: BashToolInput =
				state.canonicalExecutionArgs ??
				(context.executionStarted || !context.isPartial ? args : { command: "" });
			const lastComponent = context.lastComponent instanceof ClaudeBashCallComponent ? undefined : context.lastComponent;

			if (!context.executionStarted || context.expanded) {
				return renderCall(displayArgs, activeTheme, { ...context, lastComponent });
			}

			const commandLines =
				typeof displayArgs.command === "string"
					? displayArgs.command.split(String.fromCharCode(10))
					: [displayArgs.command];
			const timeoutSuffix =
				typeof displayArgs.timeout === "number"
					? activeTheme.fg("muted", ` (timeout ${displayArgs.timeout}s)`)
					: "";
			const lines = commandLines.map((command, index) => {
				const commandDisplay = command && command.length > 0 ? command : "...";
				return (
					activeTheme.fg("toolTitle", activeTheme.bold(`$ ${commandDisplay}`)) +
					(index === 0 ? timeoutSuffix : "")
				);
			});
			return new ClaudeBashCallComponent(lines);
		},
	};
}

'''
index_path.write_text(index_content[:start_index] + index_replacement + index_content[end_index:], encoding="utf-8")
