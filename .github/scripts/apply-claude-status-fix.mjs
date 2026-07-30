import { readFileSync, rmSync, writeFileSync } from "node:fs";

function replaceExact(path, search, replacement) {
	const source = readFileSync(path, "utf8");
	const occurrences = source.split(search).length - 1;
	if (occurrences !== 1) {
		throw new Error(`${path}: expected one matching block, found ${occurrences}`);
	}
	writeFileSync(path, source.replace(search, replacement));
}

const claudeWorkingPath = "packages/coding-agent/src/modes/interactive/components/claude-working.ts";
replaceExact(
	claudeWorkingPath,
	`] as const;\n\nfunction getClaudeSpinnerCharacters(): string[] {`,
	`] as const;\n\nconst CLAUDE_COMPLETED_VERBS = [\n\t"Baked",\n\t"Brewed",\n\t"Churned",\n\t"Cogitated",\n\t"Cooked",\n\t"Crunched",\n\t"Sautéed",\n\t"Worked",\n] as const;\nconst CLAUDE_COMPLETED_GLYPH = "✻";\n\nfunction getClaudeSpinnerCharacters(): string[] {`,
);
replaceExact(
	claudeWorkingPath,
	`export function colorClaudeWorkingText(text: string): string {\n\treturn colorClaude(text);\n}\n\nconst spinnerCharacters = getClaudeSpinnerCharacters();\n\nexport const CLAUDE_WORKING_INDICATOR: WorkingIndicatorOptions = {\n\tframes: [...spinnerCharacters, ...[...spinnerCharacters].reverse()].map((character) => colorClaude(character)),\n\tintervalMs: CLAUDE_SPINNER_INTERVAL_MS,\n};\n`,
	`export function colorClaudeWorkingText(text: string): string {\n\treturn colorClaude(text);\n}\n\nexport function createClaudeCompletedMessage(): string {\n\treturn CLAUDE_COMPLETED_VERBS[Math.floor(Math.random() * CLAUDE_COMPLETED_VERBS.length)] ?? "Worked";\n}\n\nexport function formatClaudeTurnDuration(durationMs: number): string {\n\tconst totalSeconds = Math.max(1, Math.round(Math.max(0, durationMs) / 1000));\n\tconst hours = Math.floor(totalSeconds / 3600);\n\tconst minutes = Math.floor((totalSeconds % 3600) / 60);\n\tconst seconds = totalSeconds % 60;\n\tif (hours > 0) return \\`${"${hours}"}h ${"${minutes}"}m ${"${seconds}"}s\\`;\n\tif (minutes > 0) return \\`${"${minutes}"}m ${"${seconds}"}s\\`;\n\treturn \\`${"${seconds}"}s\\`;\n}\n\nconst spinnerCharacters = getClaudeSpinnerCharacters();\n\nexport const CLAUDE_WORKING_INDICATOR: WorkingIndicatorOptions = {\n\tframes: [...spinnerCharacters, ...[...spinnerCharacters].reverse()].map((character) => colorClaude(character)),\n\tintervalMs: CLAUDE_SPINNER_INTERVAL_MS,\n};\n\nexport const CLAUDE_COMPLETED_INDICATOR: WorkingIndicatorOptions = {\n\tframes: [colorClaude(CLAUDE_COMPLETED_GLYPH)],\n\tintervalMs: CLAUDE_SPINNER_INTERVAL_MS,\n};\n`,
);

const statusIndicatorPath = "packages/coding-agent/src/modes/interactive/components/status-indicator.ts";
replaceExact(
	statusIndicatorPath,
	`import {\n\tCLAUDE_WORKING_INDICATOR,\n\tcolorClaudeWorkingText,\n\tcreateClaudeWorkingMessage,\n} from "./claude-working.ts";`,
	`import {\n\tCLAUDE_COMPLETED_INDICATOR,\n\tCLAUDE_WORKING_INDICATOR,\n\tcolorClaudeWorkingText,\n\tcreateClaudeCompletedMessage,\n\tcreateClaudeWorkingMessage,\n\tformatClaudeTurnDuration,\n} from "./claude-working.ts";`,
);
replaceExact(
	statusIndicatorPath,
	`export type StatusIndicatorKind = "working" | "retry" | "compaction" | "branchSummary";`,
	`export type StatusIndicatorKind = "working" | "completed" | "retry" | "compaction" | "branchSummary";`,
);
replaceExact(
	statusIndicatorPath,
	`\tdispose(): void {\n\t\tthis.stop();\n\t}\n`,
	`\toverride render(width: number): string[] {\n\t\treturn super.render(width).map((line) => (line.startsWith(" ") ? \\`${"${line.slice(1)}"} \\` : line));\n\t}\n\n\tdispose(): void {\n\t\tthis.stop();\n\t}\n`,
);
replaceExact(
	statusIndicatorPath,
	`}\n\nexport class RetryStatusIndicator extends StatusIndicator {`,
	`}\n\nexport class CompletedStatusIndicator extends StatusIndicator {\n\tconstructor(ui: TUI, durationMs: number) {\n\t\tsuper(\n\t\t\t"completed",\n\t\t\tui,\n\t\t\tcolorClaudeWorkingText,\n\t\t\tcolorClaudeWorkingText,\n\t\t\t\\`${"${createClaudeCompletedMessage()}"} for ${"${formatClaudeTurnDuration(durationMs)}"}\\`,\n\t\t\tCLAUDE_COMPLETED_INDICATOR,\n\t\t);\n\t}\n}\n\nexport class RetryStatusIndicator extends StatusIndicator {`,
);

const customEditorPath = "packages/coding-agent/src/modes/interactive/components/custom-editor.ts";
replaceExact(
	customEditorPath,
	`export class CustomEditor extends Editor {\n\tprivate keybindings: KeybindingsManager;`,
	`export class CustomEditor extends Editor {\n\tprivate keybindings: KeybindingsManager;\n\tprivate readonly themeBorderColor: EditorTheme["borderColor"];`,
);
replaceExact(
	customEditorPath,
	`\t\tsuper(tui, theme, options);\n\t\tthis.keybindings = keybindings;`,
	`\t\tsuper(tui, theme, options);\n\t\tthis.keybindings = keybindings;\n\t\tthis.themeBorderColor = theme.borderColor;`,
);
replaceExact(
	customEditorPath,
	`\toverride render(width: number): string[] {\n\t\tif (width <= PROMPT_PREFIX_WIDTH) {`,
	`\toverride render(width: number): string[] {\n\t\tif (!this.getText().trimStart().startsWith("!")) {\n\t\t\tthis.borderColor = this.themeBorderColor;\n\t\t}\n\n\t\tif (width <= PROMPT_PREFIX_WIDTH) {`,
);

const interactiveModePath = "packages/coding-agent/src/modes/interactive/interactive-mode.ts";
replaceExact(
	interactiveModePath,
	`import {\n\tBranchSummaryStatusIndicator,\n\tCompactionStatusIndicator,\n\tIdleStatus,`,
	`import {\n\tBranchSummaryStatusIndicator,\n\tCompletedStatusIndicator,\n\tCompactionStatusIndicator,\n\tIdleStatus,`,
);
replaceExact(
	interactiveModePath,
	`\tprivate readonly defaultWorkingMessage = "Working...";\n\tprivate readonly defaultHiddenThinkingLabel = "Thinking...";`,
	`\tprivate readonly defaultWorkingMessage = "Working...";\n\tprivate agentStartedAt: number | undefined = undefined;\n\tprivate readonly defaultHiddenThinkingLabel = "Thinking...";`,
);
replaceExact(
	interactiveModePath,
	`\t\t\tcase "agent_start":\n\t\t\t\tthis.pendingTools.clear();`,
	`\t\t\tcase "agent_start":\n\t\t\t\tthis.agentStartedAt = Date.now();\n\t\t\t\tthis.pendingTools.clear();`,
);
replaceExact(
	interactiveModePath,
	`\t\t\tcase "agent_end":\n\t\t\t\tif (this.settingsManager.getShowTerminalProgress()) {\n\t\t\t\t\tthis.ui.terminal.setProgress(false);\n\t\t\t\t}\n\t\t\t\tthis.clearStatusIndicator("working");\n\t\t\t\tif (this.streamingComponent) {`,
	`\t\t\tcase "agent_end": {\n\t\t\t\tif (this.settingsManager.getShowTerminalProgress()) {\n\t\t\t\t\tthis.ui.terminal.setProgress(false);\n\t\t\t\t}\n\t\t\t\tconst agentDurationMs =\n\t\t\t\t\tthis.agentStartedAt === undefined ? undefined : Math.max(0, Date.now() - this.agentStartedAt);\n\t\t\t\tthis.agentStartedAt = undefined;\n\t\t\t\tif (this.workingVisible && agentDurationMs !== undefined) {\n\t\t\t\t\tthis.showStatusIndicator(new CompletedStatusIndicator(this.ui, agentDurationMs));\n\t\t\t\t} else {\n\t\t\t\t\tthis.clearStatusIndicator("working");\n\t\t\t\t}\n\t\t\t\tif (this.streamingComponent) {`,
);
replaceExact(
	interactiveModePath,
	`\t\t\t\tthis.ui.requestRender();\n\t\t\t\tbreak;\n\n\t\t\tcase "agent_settled":`,
	`\t\t\t\tthis.ui.requestRender();\n\t\t\t\tbreak;\n\t\t\t}\n\n\t\t\tcase "agent_settled":`,
);

const testPath = "packages/coding-agent/test/claude-status.test.ts";
writeFileSync(
	testPath,
	`import type { EditorTheme, TUI } from "@earendil-works/pi-tui";\nimport { afterEach, describe, expect, test, vi } from "vitest";\nimport { KeybindingsManager } from "../src/core/keybindings.ts";\nimport {\n\tformatClaudeTurnDuration,\n} from "../src/modes/interactive/components/claude-working.ts";\nimport { CustomEditor } from "../src/modes/interactive/components/custom-editor.ts";\nimport {\n\tCompletedStatusIndicator,\n\tWorkingStatusIndicator,\n} from "../src/modes/interactive/components/status-indicator.ts";\nimport { initTheme } from "../src/modes/interactive/theme/theme.ts";\nimport { stripAnsi } from "../src/utils/ansi.ts";\n\nfunction createTui(): TUI {\n\treturn { requestRender() {} } as unknown as TUI;\n}\n\nfunction createEditorTheme(borderColor: (text: string) => string): EditorTheme {\n\tconst identity = (text: string) => text;\n\treturn {\n\t\tborderColor,\n\t\tselectList: {\n\t\t\tselectedPrefix: identity,\n\t\t\tselectedText: identity,\n\t\t\tdescription: identity,\n\t\t\tscrollInfo: identity,\n\t\t\tnoMatch: identity,\n\t\t},\n\t};\n}\n\nafterEach(() => {\n\tvi.restoreAllMocks();\n});\n\ndescribe("Claude status indicators", () => {\n\ttest("aligns the working glyph with tool markers in column zero", () => {\n\t\tinitTheme("dark");\n\t\tconst indicator = new WorkingStatusIndicator(createTui(), "Testing…", { frames: ["✻"] });\n\t\tconst line = indicator.render(40).map(stripAnsi).find((entry) => entry.trim().length > 0);\n\t\tindicator.dispose();\n\n\t\texpect(line?.trimEnd()).toBe("✻ Testing…");\n\t\texpect(line?.indexOf("✻")).toBe(0);\n\t});\n\n\ttest("renders a persistent Claude-style completion message with duration", () => {\n\t\tinitTheme("dark");\n\t\tvi.spyOn(Math, "random").mockReturnValue(0);\n\t\tconst indicator = new CompletedStatusIndicator(createTui(), 66_000);\n\t\tconst line = indicator.render(40).map(stripAnsi).find((entry) => entry.trim().length > 0);\n\t\tindicator.dispose();\n\n\t\texpect(line?.trimEnd()).toBe("✻ Baked for 1m 6s");\n\t\texpect(line?.indexOf("✻")).toBe(0);\n\t});\n\n\ttest("formats turn durations using Claude-style units", () => {\n\t\texpect(formatClaudeTurnDuration(0)).toBe("1s");\n\t\texpect(formatClaudeTurnDuration(66_000)).toBe("1m 6s");\n\t\texpect(formatClaudeTurnDuration(3_723_000)).toBe("1h 2m 3s");\n\t});\n});\n\ndescribe("CustomEditor border color", () => {\n\ttest("uses the theme border for prompts while preserving bash mode", () => {\n\t\tlet themeCalls = 0;\n\t\tlet thinkingCalls = 0;\n\t\tlet bashCalls = 0;\n\t\tconst editor = new CustomEditor(\n\t\t\tcreateTui(),\n\t\t\tcreateEditorTheme((text) => {\n\t\t\t\tthemeCalls++;\n\t\t\t\treturn text;\n\t\t\t}),\n\t\t\tKeybindingsManager.create(),\n\t\t);\n\n\t\teditor.borderColor = (text) => {\n\t\t\tthinkingCalls++;\n\t\t\treturn text;\n\t\t};\n\t\teditor.setText("hello");\n\t\teditor.render(40);\n\t\texpect(themeCalls).toBeGreaterThan(0);\n\t\texpect(thinkingCalls).toBe(0);\n\n\t\tthemeCalls = 0;\n\t\teditor.borderColor = (text) => {\n\t\t\tbashCalls++;\n\t\t\treturn text;\n\t\t};\n\t\teditor.setText("!pwd");\n\t\teditor.render(40);\n\t\texpect(bashCalls).toBeGreaterThan(0);\n\t\texpect(themeCalls).toBe(0);\n\t});\n});\n`,
);

rmSync(".github/scripts/apply-claude-status-fix.mjs");
rmSync(".github/workflows/apply-claude-status-fix.yml");
