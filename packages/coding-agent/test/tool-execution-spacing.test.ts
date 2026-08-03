import { Text, type TUI } from "@earendil-works/pi-tui";
import { describe, expect, it } from "vitest";
import type { ToolDefinition } from "../src/core/extensions/types.ts";
import { ToolExecutionComponent } from "../src/modes/interactive/components/tool-execution.ts";
import { initTheme } from "../src/modes/interactive/theme/theme.ts";
import { stripAnsi } from "../src/utils/ansi.ts";

initTheme("dark");

const ui = {
	requestRender: () => {},
} as unknown as TUI;

const backgroundToolNames = ["TodoWrite", "EnterPlanMode", "ExitPlanMode", "AskUserQuestion"] as const;

describe("tool execution spacing", () => {
	it.each(backgroundToolNames)("keeps %s execution out of the transcript UI", (toolName) => {
		const component = new ToolExecutionComponent(
			toolName,
			`hidden-${toolName}`,
			{},
			{ showImages: false },
			undefined,
			ui,
			process.cwd(),
		);

		expect(component.render(120)).toEqual([]);

		component.markExecutionStarted();
		component.setArgsComplete();
		component.updateResult({
			content: [{ type: "text", text: "Internal tool result" }],
			isError: false,
		});

		expect(component.render(120)).toEqual([]);
	});

	it("preserves fallback rendering for other empty self-rendered tools", () => {
		const definition = {
			renderShell: "self",
			renderCall: () => new Text("", 0, 0),
		} as unknown as ToolDefinition<any, any>;
		const component = new ToolExecutionComponent(
			"EmptySelfRendered",
			"empty-self-rendered",
			{},
			{ showImages: false },
			definition,
			ui,
			process.cwd(),
		);

		component.markExecutionStarted();
		component.setArgsComplete();
		component.updateResult({ content: [], isError: false });

		expect(component.render(120).map(stripAnsi)).toEqual(["", "● EmptySelfRendered"]);
	});

	it("preserves terminal-image-only renderer output", () => {
		const imageSequence = "\x1b]1337;File=name=test.png;inline=1:AAAA\x07";
		const definition = {
			renderShell: "self",
			renderCall: () => new Text(imageSequence, 0, 0),
		} as unknown as ToolDefinition<any, any>;

		const component = new ToolExecutionComponent(
			"ImageOnly",
			"image-only",
			{},
			{ showImages: false },
			definition,
			ui,
			process.cwd(),
		);

		const lines = component.render(120);
		expect(lines.some((line) => line.includes(imageSequence))).toBe(true);
		expect(lines.map(stripAnsi).join("\n")).toContain("ImageOnly");
	});
});
