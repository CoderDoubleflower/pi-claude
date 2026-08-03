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

const hiddenToolCallNames = ["TodoWrite", "EnterPlanMode", "ExitPlanMode", "AskUserQuestion"] as const;

describe("tool execution spacing", () => {
	it.each(hiddenToolCallNames)("hides the %s call shell but preserves its rendered result", (toolName) => {
		const definition = {
			renderShell: "self",
			renderCall: () => new Text(`SHOULD NOT RENDER: ${toolName}`, 0, 0),
			renderResult: () => new Text(`Rendered result for ${toolName}`, 0, 0),
		} as unknown as ToolDefinition<any, any>;
		const component = new ToolExecutionComponent(
			toolName,
			`hidden-call-${toolName}`,
			{ secretArgument: "should-not-render" },
			{ showImages: false },
			definition,
			ui,
			process.cwd(),
		);

		expect(component.render(120)).toEqual([]);
		component.markExecutionStarted();
		component.setArgsComplete();
		component.updateResult({ content: [{ type: "text", text: "Internal result" }], isError: false });

		const rendered = component.render(120).map(stripAnsi).join("\n");
		expect(rendered).toContain(`Rendered result for ${toolName}`);
		expect(rendered).not.toContain("SHOULD NOT RENDER");
		expect(rendered).not.toContain("secretArgument");
		expect(rendered).not.toMatch(/^● /m);
	});

	it("keeps successful TodoWrite updates silent but shows failures", () => {
		const component = new ToolExecutionComponent(
			"TodoWrite",
			"todo-result-visibility",
			{ todos: [] },
			{ showImages: false },
			undefined,
			ui,
			process.cwd(),
		);
		component.markExecutionStarted();
		component.setArgsComplete();
		component.updateResult({
			content: [{ type: "text", text: "Todos updated" }],
			details: { oldTodos: [], newTodos: [] },
			isError: false,
		});
		expect(component.render(120)).toEqual([]);

		component.updateResult({
			content: [{ type: "text", text: "Todo update failed" }],
			details: { oldTodos: [], newTodos: [] },
			isError: true,
		});
		const rendered = component.render(120).map(stripAnsi).join("\n");
		expect(rendered).toContain("Todo update failed");
		expect(rendered).not.toContain("TodoWrite");
		expect(rendered).not.toMatch(/^● /m);
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
