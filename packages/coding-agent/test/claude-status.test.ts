import type { EditorTheme, TUI } from "@earendil-works/pi-tui";
import { afterEach, describe, expect, test, vi } from "vitest";
import { KeybindingsManager } from "../src/core/keybindings.ts";
import { formatClaudeTurnDuration } from "../src/modes/interactive/components/claude-working.ts";
import { CustomEditor } from "../src/modes/interactive/components/custom-editor.ts";
import {
	CompletedStatusIndicator,
	WorkingStatusIndicator,
} from "../src/modes/interactive/components/status-indicator.ts";
import { initTheme } from "../src/modes/interactive/theme/theme.ts";
import { stripAnsi } from "../src/utils/ansi.ts";

function createTui(): TUI {
	return {
		requestRender() {},
		terminal: { rows: 40, columns: 80 },
	} as unknown as TUI;
}

function createEditorTheme(borderColor: (text: string) => string): EditorTheme {
	const identity = (text: string) => text;
	return {
		borderColor,
		selectList: {
			selectedPrefix: identity,
			selectedText: identity,
			description: identity,
			scrollInfo: identity,
			noMatch: identity,
		},
	};
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe("Claude status indicators", () => {
	test("aligns the working glyph with tool markers in column zero", () => {
		initTheme("dark");
		const indicator = new WorkingStatusIndicator(createTui(), "Testing…", { frames: ["✻"] });
		const line = indicator
			.render(40)
			.map(stripAnsi)
			.find((entry) => entry.trim().length > 0);
		indicator.dispose();

		expect(line?.trimEnd()).toBe("✻ Testing…");
		expect(line?.indexOf("✻")).toBe(0);
	});

	test("renders a persistent Claude-style completion message with duration", () => {
		initTheme("dark");
		vi.spyOn(Math, "random").mockReturnValue(0);
		const indicator = new CompletedStatusIndicator(createTui(), 66_000);
		const line = indicator
			.render(40)
			.map(stripAnsi)
			.find((entry) => entry.trim().length > 0);
		indicator.dispose();

		expect(line?.trimEnd()).toBe("✻ Baked for 1m 6s");
		expect(line?.indexOf("✻")).toBe(0);
	});

	test("formats turn durations using Claude-style units", () => {
		expect(formatClaudeTurnDuration(0)).toBe("1s");
		expect(formatClaudeTurnDuration(66_000)).toBe("1m 6s");
		expect(formatClaudeTurnDuration(3_723_000)).toBe("1h 2m 3s");
	});
});

describe("CustomEditor border color", () => {
	test("uses the theme border for prompts while preserving bash mode", () => {
		let themeCalls = 0;
		let thinkingCalls = 0;
		let bashCalls = 0;
		const editor = new CustomEditor(
			createTui(),
			createEditorTheme((text) => {
				themeCalls++;
				return text;
			}),
			KeybindingsManager.create(),
		);

		editor.borderColor = (text) => {
			thinkingCalls++;
			return text;
		};
		editor.setText("hello");
		editor.render(40);
		expect(themeCalls).toBeGreaterThan(0);
		expect(thinkingCalls).toBe(0);

		themeCalls = 0;
		editor.borderColor = (text) => {
			bashCalls++;
			return text;
		};
		editor.setText("!pwd");
		editor.render(40);
		expect(bashCalls).toBeGreaterThan(0);
		expect(themeCalls).toBe(0);
	});
});
