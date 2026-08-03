import { readFileSync, writeFileSync } from "node:fs";

const toolExecutionPath = "packages/coding-agent/src/modes/interactive/components/tool-execution.ts";
const testPath = "packages/coding-agent/test/tool-execution-spacing.test.ts";

let toolExecution = readFileSync(toolExecutionPath, "utf8");

const constantsNeedle = "const TOOL_OUTPUT_PREVIEW_LINES = 5;\n\nfunction isTerminalImageSequence";
const constantsReplacement = `const TOOL_OUTPUT_PREVIEW_LINES = 5;
const BACKGROUND_TOOL_NAMES = new Set(["AskUserQuestion", "EnterPlanMode", "ExitPlanMode", "TodoWrite"]);

function isBackgroundTool(toolName: string): boolean {
\treturn BACKGROUND_TOOL_NAMES.has(toolName);
}

function isTerminalImageSequence`;

if (!toolExecution.includes(constantsNeedle)) {
	throw new Error("Could not locate tool execution constants insertion point");
}
toolExecution = toolExecution.replace(constantsNeedle, constantsReplacement);

const renderNeedle = "\toverride render(width: number): string[] {\n\t\tconst contentWidth = Math.max(1, width - 2);";
const renderReplacement = `\toverride render(width: number): string[] {
\t\tif (isBackgroundTool(this.toolName)) return [];

\t\tconst contentWidth = Math.max(1, width - 2);`;

if (!toolExecution.includes(renderNeedle)) {
	throw new Error("Could not locate tool execution render insertion point");
}
toolExecution = toolExecution.replace(renderNeedle, renderReplacement);
writeFileSync(toolExecutionPath, toolExecution);

const testContent = `import { Text, type TUI } from "@earendil-works/pi-tui";
import type { ToolDefinition } from "../src/core/extensions/types.ts";
import { describe, expect, it } from "vitest";
import { ToolExecutionComponent } from "../src/modes/interactive/components/tool-execution.ts";
import { initTheme } from "../src/modes/interactive/theme/theme.ts";
import { stripAnsi } from "../src/utils/ansi.ts";

initTheme("dark");

const ui = {
\trequestRender: () => {},
} as unknown as TUI;

const backgroundToolNames = ["TodoWrite", "EnterPlanMode", "ExitPlanMode", "AskUserQuestion"] as const;

describe("tool execution spacing", () => {
\tit.each(backgroundToolNames)("keeps %s execution out of the transcript UI", (toolName) => {
\t\tconst component = new ToolExecutionComponent(
\t\t\ttoolName,
\t\t\t\`hidden-\${toolName}\`,
\t\t\t{},
\t\t\t{ showImages: false },
\t\t\tundefined,
\t\t\tui,
\t\t\tprocess.cwd(),
\t\t);

\t\texpect(component.render(120)).toEqual([]);

\t\tcomponent.markExecutionStarted();
\t\tcomponent.setArgsComplete();
\t\tcomponent.updateResult({
\t\t\tcontent: [{ type: "text", text: "Internal tool result" }],
\t\t\tisError: false,
\t\t});

\t\texpect(component.render(120)).toEqual([]);
\t});

\tit("preserves fallback rendering for other empty self-rendered tools", () => {
\t\tconst definition = {
\t\t\trenderShell: "self",
\t\t\trenderCall: () => new Text("", 0, 0),
\t\t} as unknown as ToolDefinition<any, any>;
\t\tconst component = new ToolExecutionComponent(
\t\t\t"EmptySelfRendered",
\t\t\t"empty-self-rendered",
\t\t\t{},
\t\t\t{ showImages: false },
\t\t\tdefinition,
\t\t\tui,
\t\t\tprocess.cwd(),
\t\t);

\t\tcomponent.markExecutionStarted();
\t\tcomponent.setArgsComplete();
\t\tcomponent.updateResult({ content: [], isError: false });

\t\texpect(component.render(120).map(stripAnsi)).toEqual(["", "● EmptySelfRendered"]);
\t});

\tit("preserves terminal-image-only renderer output", () => {
\t\tconst imageSequence = "\\x1b]1337;File=name=test.png;inline=1:AAAA\\x07";
\t\tconst definition = {
\t\t\trenderShell: "self",
\t\t\trenderCall: () => new Text(imageSequence, 0, 0),
\t\t} as unknown as ToolDefinition<any, any>;

\t\tconst component = new ToolExecutionComponent(
\t\t\t"ImageOnly",
\t\t\t"image-only",
\t\t\t{},
\t\t\t{ showImages: false },
\t\t\tdefinition,
\t\t\tui,
\t\t\tprocess.cwd(),
\t\t);

\t\tconst lines = component.render(120);
\t\texpect(lines.some((line) => line.includes(imageSequence))).toBe(true);
\t\texpect(lines.map(stripAnsi).join("\\n")).toContain("ImageOnly");
\t});
});
`;

writeFileSync(testPath, testContent);
