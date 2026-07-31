import { Text } from "@earendil-works/pi-tui";
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
		// Match Claude Code's 700ms minimum hint visibility so fast calls do not flicker.
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
