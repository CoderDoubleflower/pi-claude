import { readFileSync, writeFileSync } from "node:fs";

function replaceOnce(path, before, after, label) {
	let content = readFileSync(path, "utf8");
	if (content.includes(after)) return;
	const first = content.indexOf(before);
	if (first < 0) throw new Error(`Missing ${label} in ${path}`);
	if (content.indexOf(before, first + before.length) >= 0) {
		throw new Error(`Multiple matches for ${label} in ${path}`);
	}
	content = `${content.slice(0, first)}${after}${content.slice(first + before.length)}`;
	writeFileSync(path, content);
}

replaceOnce(
	"packages/coding-agent/src/cli/startup-ui.ts",
	'import { ProcessTerminal, setKeybindings, type TUI, TuiMainScreen } from "@earendil-works/pi-tui";',
	'import { ProcessTerminal, setKeybindings, type TUI } from "@earendil-works/pi-tui";',
	"startup TUI import",
);
replaceOnce(
	"packages/coding-agent/src/cli/startup-ui.ts",
	'import { SettingsManager } from "../core/settings-manager.ts";',
	'import { SettingsManager } from "../core/settings-manager.ts";\nimport { createMainScreenTui } from "../utils/tui-runtime.ts";',
	"startup compatibility import",
);
replaceOnce(
	"packages/coding-agent/src/cli/startup-ui.ts",
	"const ui: TUI = new TuiMainScreen(new ProcessTerminal(), settingsManager.getShowHardwareCursor(), getAgentDir());",
	"const ui: TUI = createMainScreenTui(\n\t\tnew ProcessTerminal(),\n\t\tsettingsManager.getShowHardwareCursor(),\n\t\tgetAgentDir(),\n\t);",
	"startup TUI construction",
);

replaceOnce(
	"packages/coding-agent/src/cli/config-selector.ts",
	'import { ProcessTerminal, type TUI, TuiMainScreen } from "@earendil-works/pi-tui";',
	'import { ProcessTerminal, type TUI } from "@earendil-works/pi-tui";',
	"config selector TUI import",
);
replaceOnce(
	"packages/coding-agent/src/cli/config-selector.ts",
	'import { initTheme, stopThemeWatcher } from "../modes/interactive/theme/theme.ts";',
	'import { initTheme, stopThemeWatcher } from "../modes/interactive/theme/theme.ts";\nimport { createMainScreenTui } from "../utils/tui-runtime.ts";',
	"config selector compatibility import",
);
replaceOnce(
	"packages/coding-agent/src/cli/config-selector.ts",
	"const ui: TUI = new TuiMainScreen(new ProcessTerminal(), undefined, options.agentDir);",
	"const ui: TUI = createMainScreenTui(new ProcessTerminal(), undefined, options.agentDir);",
	"config selector TUI construction",
);

replaceOnce(
	"packages/coding-agent/src/modes/interactive/interactive-mode.ts",
	"\ttype TUI,\n\tTuiAltScreen,\n\tTuiMainScreen,\n\tvisibleWidth,",
	"\ttype TUI,\n\tvisibleWidth,",
	"interactive static TUI imports",
);
replaceOnce(
	"packages/coding-agent/src/modes/interactive/interactive-mode.ts",
	'import { openBrowser } from "../../utils/open-browser.ts";',
	'import { openBrowser } from "../../utils/open-browser.ts";\nimport { createAltScreenTui, createMainScreenTui } from "../../utils/tui-runtime.ts";',
	"interactive compatibility import",
);
replaceOnce(
	"packages/coding-agent/src/modes/interactive/interactive-mode.ts",
	'export function createInteractiveTui(options: InteractiveTuiOptions): TUI {\n\tconst terminal = options.terminal ?? new ProcessTerminal();\n\tif (options.alt) {\n\t\treturn new TuiAltScreen(terminal, options.showHardwareCursor, options.logDirectory, { openUrl: openBrowser });\n\t}\n\treturn new TuiMainScreen(terminal, options.showHardwareCursor, options.logDirectory);\n}',
	'export function createInteractiveTui(options: InteractiveTuiOptions): TUI {\n\tconst terminal = options.terminal ?? new ProcessTerminal();\n\tif (options.alt) {\n\t\treturn createAltScreenTui(terminal, options.showHardwareCursor, options.logDirectory, { openUrl: openBrowser });\n\t}\n\treturn createMainScreenTui(terminal, options.showHardwareCursor, options.logDirectory);\n}',
	"interactive TUI construction",
);

replaceOnce(
	"packages/coding-agent/src/core/agent-session.ts",
	'import { contentText, estimateContextTokens as estimateLlmContextTokens } from "@earendil-works/pi-ai";',
	'import { contentText } from "@earendil-works/pi-ai";',
	"pi-ai context estimator import",
);
replaceOnce(
	"packages/coding-agent/src/core/agent-session.ts",
	'import { stripFrontmatter } from "../utils/frontmatter.ts";',
	'import { stripFrontmatter } from "../utils/frontmatter.ts";\nimport { estimateLlmContextTokens } from "../utils/llm-context-estimate.ts";',
	"local context estimator import",
);

replaceOnce(
	"package.json",
	'\t\t"check:install-lock:coding-agent": "node scripts/generate-coding-agent-install-lock.mjs --check",',
	'\t\t"check:install-lock:coding-agent": "node scripts/generate-coding-agent-install-lock.mjs --check",\n\t\t"check:package-smoke": "node scripts/check-coding-agent-package-smoke.mjs",',
	"package smoke script",
);
replaceOnce(
	"package.json",
	'\t\t"prepublishOnly": "npm run clean && npm run build && npm run check",',
	'\t\t"prepublishOnly": "npm run clean && npm run build && npm run check && npm run check:package-smoke",',
	"release smoke gate",
);

const changelogPath = "packages/coding-agent/CHANGELOG.md";
let changelog = readFileSync(changelogPath, "utf8");
const bullet =
	"- Fixed published npm installs failing at startup when the bundled 0.83.0 runtime packages predate newer workspace exports.";
if (!changelog.includes(bullet)) {
	const fixedHeading = "### Fixed\n\n";
	const unreleasedStart = changelog.indexOf("## [Unreleased]");
	const fixedStart = changelog.indexOf(fixedHeading, unreleasedStart);
	if (unreleasedStart < 0 || fixedStart < 0) throw new Error("Unable to find Unreleased/Fixed changelog section");
	const insertAt = fixedStart + fixedHeading.length;
	changelog = `${changelog.slice(0, insertAt)}${bullet}\n${changelog.slice(insertAt)}`;
	writeFileSync(changelogPath, changelog);
}
