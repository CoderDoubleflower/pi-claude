import { readFileSync, writeFileSync } from "node:fs";

function replaceOnce(source, before, after, label) {
	const index = source.indexOf(before);
	if (index < 0) throw new Error(`Missing ${label}`);
	if (source.indexOf(before, index + before.length) >= 0) throw new Error(`Duplicate ${label}`);
	return `${source.slice(0, index)}${after}${source.slice(index + before.length)}`;
}

const toolPath = "packages/coding-agent/src/modes/interactive/components/tool-execution.ts";
let tool = readFileSync(toolPath, "utf8");
tool = replaceOnce(
	tool,
	`const TOOL_OUTPUT_PREVIEW_LINES = 5;
const BACKGROUND_TOOL_NAMES = new Set(["AskUserQuestion", "EnterPlanMode", "ExitPlanMode", "TodoWrite"]);

function isBackgroundTool(toolName: string): boolean {
\treturn BACKGROUND_TOOL_NAMES.has(toolName);
}`,
	`const TOOL_OUTPUT_PREVIEW_LINES = 5;
const HIDDEN_TOOL_CALL_NAMES = new Set(["AskUserQuestion", "EnterPlanMode", "ExitPlanMode", "TodoWrite"]);

function hidesToolCall(toolName: string): boolean {
\treturn HIDDEN_TOOL_CALL_NAMES.has(toolName);
}`,
	"internal tool name policy",
);
tool = replaceOnce(
	tool,
	`\toverride render(width: number): string[] {
\t\tif (isBackgroundTool(this.toolName)) return [];

\t\tconst contentWidth = Math.max(1, width - 2);`,
	`\toverride render(width: number): string[] {
\t\tif (hidesToolCall(this.toolName)) {
\t\t\tconst lines = super.render(width);
\t\t\tconst hasVisibleContent = lines.some(
\t\t\t\t(line) => isTerminalImageSequence(line) || stripAnsi(line).trim().length > 0,
\t\t\t);
\t\t\treturn hasVisibleContent ? lines : [];
\t\t}

\t\tconst contentWidth = Math.max(1, width - 2);`,
	"hidden-call render path",
);
tool = replaceOnce(
	tool,
	`\t\t\tconst callRenderer = this.getCallRenderer();
\t\t\tif (!callRenderer) {
\t\t\t\trenderContainer.addChild(this.getDisplayedCallComponent(this.createCallFallback()));
\t\t\t} else {
\t\t\t\ttry {
\t\t\t\t\tconst component = callRenderer(this.args, theme, this.getRenderContext(this.callRendererComponent));
\t\t\t\t\tthis.callRendererComponent = component;
\t\t\t\t\trenderContainer.addChild(this.getDisplayedCallComponent(component));
\t\t\t\t} catch {
\t\t\t\t\tthis.callRendererComponent = undefined;
\t\t\t\t\trenderContainer.addChild(this.getDisplayedCallComponent(this.createCallFallback()));
\t\t\t\t}
\t\t\t}`,
	`\t\t\tif (!hidesToolCall(this.toolName)) {
\t\t\t\tconst callRenderer = this.getCallRenderer();
\t\t\t\tif (!callRenderer) {
\t\t\t\t\trenderContainer.addChild(this.getDisplayedCallComponent(this.createCallFallback()));
\t\t\t\t} else {
\t\t\t\t\ttry {
\t\t\t\t\t\tconst component = callRenderer(this.args, theme, this.getRenderContext(this.callRendererComponent));
\t\t\t\t\t\tthis.callRendererComponent = component;
\t\t\t\t\t\trenderContainer.addChild(this.getDisplayedCallComponent(component));
\t\t\t\t\t} catch {
\t\t\t\t\t\tthis.callRendererComponent = undefined;
\t\t\t\t\t\trenderContainer.addChild(this.getDisplayedCallComponent(this.createCallFallback()));
\t\t\t\t\t}
\t\t\t\t}
\t\t\t}`,
	"call renderer block",
);
tool = replaceOnce(
	tool,
	`\t\t\t\tif (this.isPartial) {
\t\t\t\t\tconst textResult = this.createOutputTextComponent();
\t\t\t\t\tif (this.expanded) {
\t\t\t\t\t\tconst expandedResult = renderedResult ?? textResult;
\t\t\t\t\t\tif (expandedResult) renderContainer.addChild(expandedResult);
\t\t\t\t\t} else {
\t\t\t\t\t\tconst previewSource = textResult ?? renderedResult;
\t\t\t\t\t\tif (previewSource) renderContainer.addChild(new LatestLinesComponent(previewSource));
\t\t\t\t\t}
\t\t\t\t}`,
	`\t\t\t\tif (hidesToolCall(this.toolName)) {
\t\t\t\t\tconst hiddenResult = renderedResult ?? this.createOutputTextComponent();
\t\t\t\t\tif (hiddenResult) renderContainer.addChild(hiddenResult);
\t\t\t\t} else if (this.isPartial) {
\t\t\t\t\tconst textResult = this.createOutputTextComponent();
\t\t\t\t\tif (this.expanded) {
\t\t\t\t\t\tconst expandedResult = renderedResult ?? textResult;
\t\t\t\t\t\tif (expandedResult) renderContainer.addChild(expandedResult);
\t\t\t\t\t} else {
\t\t\t\t\t\tconst previewSource = textResult ?? renderedResult;
\t\t\t\t\t\tif (previewSource) renderContainer.addChild(new LatestLinesComponent(previewSource));
\t\t\t\t\t}
\t\t\t\t}`,
	"result renderer block",
);
writeFileSync(toolPath, tool);

const planPath = "packages/coding-agent/src/extensions/plan-mode/index.ts";
let plan = readFileSync(planPath, "utf8");
plan = replaceOnce(
	plan,
	`\t\tasync execute(_toolCallId, { plan: submittedPlan }, _signal, _onUpdate, ctx) {`,
	`\t\tasync execute(_toolCallId, { plan: submittedPlan }, _signal, onUpdate, ctx) {`,
	"ExitPlanMode update callback",
);
plan = replaceOnce(
	plan,
	`\t\t\twhile (true) {
\t\t\t\tconst choice = await ctx.ui.select("Ready to implement?", [`,
	`\t\t\twhile (true) {
\t\t\t\tonUpdate?.({
\t\t\t\t\tcontent: [],
\t\t\t\t\tdetails: {
\t\t\t\t\t\tkind: "current-plan",
\t\t\t\t\t\ttitle: "Here is Claude's plan",
\t\t\t\t\t\tsubtitle: "Review the complete plan below, then choose how to proceed.",
\t\t\t\t\t\tplanPath: state.planPath,
\t\t\t\t\t\tplan,
\t\t\t\t\t},
\t\t\t\t});
\t\t\t\tconst choice = await ctx.ui.select("Ready to implement?", [`,
	"plan approval preview",
);
writeFileSync(planPath, plan);

const spacingTestPath = "packages/coding-agent/test/tool-execution-spacing.test.ts";
writeFileSync(
	spacingTestPath,
	`import { Text, type TUI } from "@earendil-works/pi-tui";
import { describe, expect, it } from "vitest";
import type { ToolDefinition } from "../src/core/extensions/types.ts";
import { ToolExecutionComponent } from "../src/modes/interactive/components/tool-execution.ts";
import { initTheme } from "../src/modes/interactive/theme/theme.ts";
import { stripAnsi } from "../src/utils/ansi.ts";

initTheme("dark");

const ui = {
\trequestRender: () => {},
} as unknown as TUI;

const hiddenToolCallNames = ["TodoWrite", "EnterPlanMode", "ExitPlanMode", "AskUserQuestion"] as const;

describe("tool execution spacing", () => {
\tit.each(hiddenToolCallNames)("hides the %s call shell but preserves its rendered result", (toolName) => {
\t\tconst definition = {
\t\t\trenderShell: "self",
\t\t\trenderCall: () => new Text(\`SHOULD NOT RENDER: \${toolName}\`, 0, 0),
\t\t\trenderResult: () => new Text(\`Rendered result for \${toolName}\`, 0, 0),
\t\t} as unknown as ToolDefinition<any, any>;
\t\tconst component = new ToolExecutionComponent(
\t\t\ttoolName,
\t\t\t\`hidden-call-\${toolName}\`,
\t\t\t{ secretArgument: "should-not-render" },
\t\t\t{ showImages: false },
\t\t\tdefinition,
\t\t\tui,
\t\t\tprocess.cwd(),
\t\t);

\t\texpect(component.render(120)).toEqual([]);
\t\tcomponent.markExecutionStarted();
\t\tcomponent.setArgsComplete();
\t\tcomponent.updateResult({ content: [{ type: "text", text: "Internal result" }], isError: false });

\t\tconst rendered = component.render(120).map(stripAnsi).join("\\n");
\t\texpect(rendered).toContain(\`Rendered result for \${toolName}\`);
\t\texpect(rendered).not.toContain("SHOULD NOT RENDER");
\t\texpect(rendered).not.toContain("secretArgument");
\t\texpect(rendered).not.toMatch(/^● /m);
\t});

\tit("keeps successful TodoWrite updates silent but shows failures", () => {
\t\tconst component = new ToolExecutionComponent(
\t\t\t"TodoWrite",
\t\t\t"todo-result-visibility",
\t\t\t{ todos: [] },
\t\t\t{ showImages: false },
\t\t\tundefined,
\t\t\tui,
\t\t\tprocess.cwd(),
\t\t);
\t\tcomponent.markExecutionStarted();
\t\tcomponent.setArgsComplete();
\t\tcomponent.updateResult({
\t\t\tcontent: [{ type: "text", text: "Todos updated" }],
\t\t\tdetails: { oldTodos: [], newTodos: [] },
\t\t\tisError: false,
\t\t});
\t\texpect(component.render(120)).toEqual([]);

\t\tcomponent.updateResult({
\t\t\tcontent: [{ type: "text", text: "Todo update failed" }],
\t\t\tdetails: { oldTodos: [], newTodos: [] },
\t\t\tisError: true,
\t\t});
\t\tconst rendered = component.render(120).map(stripAnsi).join("\\n");
\t\texpect(rendered).toContain("Todo update failed");
\t\texpect(rendered).not.toContain("TodoWrite");
\t\texpect(rendered).not.toMatch(/^● /m);
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
`,
);

const planTestPath = "packages/coding-agent/test/plan-mode.test.ts";
let planTest = readFileSync(planTestPath, "utf8");
const close = "\n});\n";
const insertion = planTest.lastIndexOf(close);
if (insertion < 0) throw new Error("Missing final plan-mode describe close");
const test = `

\tit("streams the complete plan before opening approval choices and refreshes after edits", () => {
\t\tconst source = readFileSync(new URL("../src/extensions/plan-mode/index.ts", import.meta.url), "utf8");
\t\tconst previewIndex = source.indexOf('title: "Here is Claude\\'s plan"');
\t\tconst selectionIndex = source.indexOf('const choice = await ctx.ui.select("Ready to implement?"');
\t\texpect(source).toContain("async execute(_toolCallId, { plan: submittedPlan }, _signal, onUpdate, ctx)");
\t\texpect(source).toContain("onUpdate?.({");
\t\texpect(source).toContain("Review the complete plan below, then choose how to proceed.");
\t\texpect(previewIndex).toBeGreaterThan(-1);
\t\texpect(selectionIndex).toBeGreaterThan(previewIndex);
\t});`;
planTest = `${planTest.slice(0, insertion)}${test}${planTest.slice(insertion)}`;
writeFileSync(planTestPath, planTest);
