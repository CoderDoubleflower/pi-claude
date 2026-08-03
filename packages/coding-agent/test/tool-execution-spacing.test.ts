import type { TUI } from "@earendil-works/pi-tui";
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
});
