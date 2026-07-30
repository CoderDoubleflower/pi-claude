import type { TUI } from "@earendil-works/pi-tui";
import { afterEach, describe, expect, test, vi } from "vitest";
import { formatClaudeTurnDuration } from "../src/modes/interactive/components/claude-working.ts";
import {
	CompletedStatusIndicator,
	WorkingStatusIndicator,
} from "../src/modes/interactive/components/status-indicator.ts";
import { InteractiveMode } from "../src/modes/interactive/interactive-mode.ts";
import { getEditorTheme, initTheme, theme } from "../src/modes/interactive/theme/theme.ts";
import { stripAnsi } from "../src/utils/ansi.ts";

type BorderColor = (text: string) => string;
type EditorBorderHost = {
	isBashMode: boolean;
	editor: { borderColor: BorderColor };
	ui: { requestRender(): void };
};

function createTui(): TUI {
	return { requestRender() {} } as unknown as TUI;
}

function applyEditorBorderColor(host: EditorBorderHost): void {
	const updateEditorBorderColor = (
		InteractiveMode.prototype as unknown as {
			updateEditorBorderColor(this: EditorBorderHost): void;
		}
	).updateEditorBorderColor;
	updateEditorBorderColor.call(host);
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

describe("Interactive editor border color", () => {
	test("uses the active theme border instead of the thinking level", () => {
		initTheme("dark");
		let renderRequests = 0;
		const host: EditorBorderHost = {
			isBashMode: false,
			editor: { borderColor: (text) => theme.fg("thinkingHigh", text) },
			ui: {
				requestRender() {
					renderRequests++;
				},
			},
		};

		applyEditorBorderColor(host);

		expect(host.editor.borderColor("─")).toBe(getEditorTheme().borderColor("─"));
		expect(host.editor.borderColor("─")).toBe(theme.fg("borderMuted", "─"));
		expect(renderRequests).toBe(1);
	});

	test("preserves the dedicated bash-mode border", () => {
		initTheme("dark");
		const host: EditorBorderHost = {
			isBashMode: true,
			editor: { borderColor: getEditorTheme().borderColor },
			ui: { requestRender() {} },
		};

		applyEditorBorderColor(host);

		expect(host.editor.borderColor("─")).toBe(theme.getBashModeBorderColor()("─"));
	});
});
