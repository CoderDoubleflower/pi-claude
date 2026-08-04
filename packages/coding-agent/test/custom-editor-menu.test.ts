import { stripVTControlCharacters } from "node:util";
import { Editor, type EditorTheme, type TUI } from "@earendil-works/pi-tui";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { KeybindingsManager } from "../src/core/keybindings.ts";
import { CustomEditor } from "../src/modes/interactive/components/custom-editor.ts";
import { initTheme } from "../src/modes/interactive/theme/theme.ts";

beforeAll(() => {
	initTheme("dark");
});

afterEach(() => {
	vi.restoreAllMocks();
});

const editorTheme: EditorTheme = {
	borderColor: (text: string) => text,
	selectList: {
		selectedPrefix: (text: string) => text,
		selectedText: (text: string) => text,
		description: (text: string) => text,
		scrollInfo: (text: string) => text,
		noMatch: (text: string) => text,
	},
};

describe("CustomEditor menu presentation", () => {
	it("renders autocomplete above the input and colors the full selected row", () => {
		vi.spyOn(Editor.prototype, "render").mockImplementation(function (this: Editor, width: number) {
			const runtimeTheme = (this as unknown as { theme: EditorTheme }).theme;
			return [
				"─".repeat(width),
				"draft request",
				"─".repeat(width),
				runtimeTheme.selectList.selectedText("  /help        Show available commands"),
			];
		});

		const tui = { terminal: { rows: 40 } } as unknown as TUI;
		const keybindings = {} as unknown as KeybindingsManager;
		const editor = new CustomEditor(tui, editorTheme, keybindings);
		const rendered = editor.render(40);

		expect(stripVTControlCharacters(rendered[0] ?? "")).toContain("/help        Show available commands");
		expect(rendered[0]).toMatch(/\x1b\[38;(?:2;152;186;220|5;110)m/);
		expect(stripVTControlCharacters(rendered[1] ?? "")).toBe("─".repeat(40));
		expect(stripVTControlCharacters(rendered.at(-1) ?? "")).toBe("─".repeat(40));
	});
});
