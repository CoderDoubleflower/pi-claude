import { stripVTControlCharacters } from "node:util";
import {
	type AutocompleteProvider,
	Editor,
	type EditorTheme,
	type TUI,
} from "@earendil-works/pi-tui";
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

function createEditor(): CustomEditor {
	const tui = { terminal: { rows: 40 } } as unknown as TUI;
	const keybindings = {} as unknown as KeybindingsManager;
	return new CustomEditor(tui, editorTheme, keybindings);
}

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

		const rendered = createEditor().render(40);

		expect(stripVTControlCharacters(rendered[0] ?? "")).toContain("/help        Show available commands");
		expect(rendered[0]).toMatch(/\x1b\[38;(?:2;152;186;220|5;110)m/);
		expect(stripVTControlCharacters(rendered[1] ?? "")).toBe("─".repeat(40));
		expect(stripVTControlCharacters(rendered.at(-1) ?? "")).toBe("─".repeat(40));
	});

	it("prefixes every slash-command label without changing completion values", async () => {
		let wrappedProvider: AutocompleteProvider | undefined;
		vi.spyOn(Editor.prototype, "setAutocompleteProvider").mockImplementation((provider) => {
			wrappedProvider = provider;
		});

		const provider: AutocompleteProvider = {
			async getSuggestions(lines) {
				return {
					prefix: lines[0] ?? "",
					items: [
						{ value: "help", label: "help" },
						{ value: "model", label: "/model" },
					],
				};
			},
			applyCompletion(lines, cursorLine, cursorCol) {
				return { lines, cursorLine, cursorCol };
			},
		};

		createEditor().setAutocompleteProvider(provider);
		if (!wrappedProvider) throw new Error("Expected wrapped autocomplete provider");

		const options = { signal: new AbortController().signal };
		const commandMenu = await wrappedProvider.getSuggestions(["/"], 0, 1, options);
		expect(commandMenu?.items.map((item) => item.label)).toEqual(["/help", "/model"]);
		expect(commandMenu?.items.map((item) => item.value)).toEqual(["help", "model"]);

		const argumentMenu = await wrappedProvider.getSuggestions(["/login "], 0, 7, options);
		expect(argumentMenu?.items.map((item) => item.label)).toEqual(["help", "/model"]);
	});
});
