import { Text, type TUI } from "@earendil-works/pi-tui";
import type { ToolDefinition } from "../src/core/extensions/types.ts";
import { describe, expect, it } from "vitest";
import { ToolExecutionComponent } from "../src/modes/interactive/components/tool-execution.ts";
import { initTheme } from "../src/modes/interactive/theme/theme.ts";
import { stripAnsi } from "../src/utils/ansi.ts";

initTheme("dark");

const ui = {
	requestRender: () => {},
} as unknown as TUI;

describe("tool execution spacing", () => {
	it("does not preserve blank renderer rows after an empty self-rendered tool", () => {
		const component = new ToolExecutionComponent(
			"TodoWrite",
			"todo-spacing",
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

		expect(component.render(120).map(stripAnsi)).toEqual(["", "● TodoWrite"]);
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
