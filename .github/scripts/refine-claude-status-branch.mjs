import { execFileSync } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";

function replaceExact(path, search, replacement) {
	const source = readFileSync(path, "utf8");
	const occurrences = source.split(search).length - 1;
	if (occurrences !== 1) {
		throw new Error(`${path}: expected one matching block, found ${occurrences}`);
	}
	writeFileSync(path, source.replace(search, replacement));
}

execFileSync(
	"git",
	[
		"checkout",
		"origin/main",
		"--",
		"packages/coding-agent/src/modes/interactive/components/custom-editor.ts",
	],
	{ stdio: "inherit" },
);

replaceExact(
	"packages/coding-agent/src/modes/interactive/interactive-mode.ts",
	`\tprivate updateEditorBorderColor(): void {\n\t\tif (this.isBashMode) {\n\t\t\tthis.editor.borderColor = theme.getBashModeBorderColor();\n\t\t} else {\n\t\t\tconst level = this.session.thinkingLevel || "off";\n\t\t\tthis.editor.borderColor = theme.getThinkingBorderColor(level);\n\t\t}\n\t\tthis.ui.requestRender();\n\t}`,
	`\tprivate updateEditorBorderColor(): void {\n\t\tif (this.isBashMode) {\n\t\t\tthis.editor.borderColor = theme.getBashModeBorderColor();\n\t\t} else {\n\t\t\tthis.editor.borderColor = getEditorTheme().borderColor;\n\t\t}\n\t\tthis.ui.requestRender();\n\t}`,
);

writeFileSync(
	"packages/coding-agent/test/claude-status.test.ts",
	`import type { TUI } from "@earendil-works/pi-tui";\nimport { afterEach, describe, expect, test, vi } from "vitest";\nimport {\n\tformatClaudeTurnDuration,\n} from "../src/modes/interactive/components/claude-working.ts";\nimport {\n\tCompletedStatusIndicator,\n\tWorkingStatusIndicator,\n} from "../src/modes/interactive/components/status-indicator.ts";\nimport { InteractiveMode } from "../src/modes/interactive/interactive-mode.ts";\nimport { getEditorTheme, initTheme, theme } from "../src/modes/interactive/theme/theme.ts";\nimport { stripAnsi } from "../src/utils/ansi.ts";\n\ntype BorderColor = (text: string) => string;\ntype EditorBorderHost = {\n\tisBashMode: boolean;\n\teditor: { borderColor: BorderColor };\n\tui: { requestRender(): void };\n};\n\nfunction createTui(): TUI {\n\treturn { requestRender() {} } as unknown as TUI;\n}\n\nfunction applyEditorBorderColor(host: EditorBorderHost): void {\n\tconst updateEditorBorderColor = (InteractiveMode.prototype as unknown as {\n\t\tupdateEditorBorderColor(this: EditorBorderHost): void;\n\t}).updateEditorBorderColor;\n\tupdateEditorBorderColor.call(host);\n}\n\nafterEach(() => {\n\tvi.restoreAllMocks();\n});\n\ndescribe("Claude status indicators", () => {\n\ttest("aligns the working glyph with tool markers in column zero", () => {\n\t\tinitTheme("dark");\n\t\tconst indicator = new WorkingStatusIndicator(createTui(), "Testing…", { frames: ["✻"] });\n\t\tconst line = indicator\n\t\t\t.render(40)\n\t\t\t.map(stripAnsi)\n\t\t\t.find((entry) => entry.trim().length > 0);\n\t\tindicator.dispose();\n\n\t\texpect(line?.trimEnd()).toBe("✻ Testing…");\n\t\texpect(line?.indexOf("✻")).toBe(0);\n\t});\n\n\ttest("renders a persistent Claude-style completion message with duration", () => {\n\t\tinitTheme("dark");\n\t\tvi.spyOn(Math, "random").mockReturnValue(0);\n\t\tconst indicator = new CompletedStatusIndicator(createTui(), 66_000);\n\t\tconst line = indicator\n\t\t\t.render(40)\n\t\t\t.map(stripAnsi)\n\t\t\t.find((entry) => entry.trim().length > 0);\n\t\tindicator.dispose();\n\n\t\texpect(line?.trimEnd()).toBe("✻ Baked for 1m 6s");\n\t\texpect(line?.indexOf("✻")).toBe(0);\n\t});\n\n\ttest("formats turn durations using Claude-style units", () => {\n\t\texpect(formatClaudeTurnDuration(0)).toBe("1s");\n\t\texpect(formatClaudeTurnDuration(66_000)).toBe("1m 6s");\n\t\texpect(formatClaudeTurnDuration(3_723_000)).toBe("1h 2m 3s");\n\t});\n});\n\ndescribe("Interactive editor border color", () => {\n\ttest("uses the active theme border instead of the thinking level", () => {\n\t\tinitTheme("dark");\n\t\tlet renderRequests = 0;\n\t\tconst host: EditorBorderHost = {\n\t\t\tisBashMode: false,\n\t\t\teditor: { borderColor: (text) => theme.fg("thinkingHigh", text) },\n\t\t\tui: {\n\t\t\t\trequestRender() {\n\t\t\t\t\trenderRequests++;\n\t\t\t\t},\n\t\t\t},\n\t\t};\n\n\t\tapplyEditorBorderColor(host);\n\n\t\texpect(host.editor.borderColor("─")).toBe(getEditorTheme().borderColor("─"));\n\t\texpect(host.editor.borderColor("─")).toBe(theme.fg("borderMuted", "─"));\n\t\texpect(renderRequests).toBe(1);\n\t});\n\n\ttest("preserves the dedicated bash-mode border", () => {\n\t\tinitTheme("dark");\n\t\tconst host: EditorBorderHost = {\n\t\t\tisBashMode: true,\n\t\t\teditor: { borderColor: getEditorTheme().borderColor },\n\t\t\tui: { requestRender() {} },\n\t\t};\n\n\t\tapplyEditorBorderColor(host);\n\n\t\texpect(host.editor.borderColor("─")).toBe(theme.getBashModeBorderColor()("─"));\n\t});\n});\n`,
);

rmSync(".github/scripts/refine-claude-status-branch.mjs");
