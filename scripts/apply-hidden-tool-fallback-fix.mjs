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
	`\t\t} else {
\t\t\tthis.contentBox.clear();
\t\t\tthis.contentBox.addChild(new Text(this.formatFallbackCall(), 0, 0));
\t\t\tif (this.isPartial) {
\t\t\t\tconst outputComponent = this.createOutputTextComponent();
\t\t\t\tif (outputComponent) {
\t\t\t\t\tthis.contentBox.addChild(this.expanded ? outputComponent : new LatestLinesComponent(outputComponent));
\t\t\t\t}
\t\t\t}
\t\t}`,
	`\t\t} else {
\t\t\tthis.contentBox.clear();
\t\t\tif (hidesToolCall(this.toolName)) {
\t\t\t\tif (this.result) {
\t\t\t\t\tconst outputComponent = this.createOutputTextComponent();
\t\t\t\t\tif (outputComponent) this.contentBox.addChild(outputComponent);
\t\t\t\t}
\t\t\t} else {
\t\t\t\tthis.contentBox.addChild(new Text(this.formatFallbackCall(), 0, 0));
\t\t\t\tif (this.isPartial) {
\t\t\t\t\tconst outputComponent = this.createOutputTextComponent();
\t\t\t\t\tif (outputComponent) {
\t\t\t\t\t\tthis.contentBox.addChild(this.expanded ? outputComponent : new LatestLinesComponent(outputComponent));
\t\t\t\t\t}
\t\t\t\t}
\t\t\t}
\t\t}`,
	"renderer-less fallback block",
);
writeFileSync(toolPath, tool);

const testPath = "packages/coding-agent/test/tool-execution-spacing.test.ts";
let test = readFileSync(testPath, "utf8");
const marker = `
\tit("keeps successful TodoWrite updates silent but shows failures", () => {`;
const addition = `
\tit("hides fallback call details when an internal tool renderer is unavailable", () => {
\t\tconst component = new ToolExecutionComponent(
\t\t\t"ExitPlanMode",
\t\t\t"renderer-unavailable",
\t\t\t{ plan: "sensitive call argument" },
\t\t\t{ showImages: false },
\t\t\tundefined,
\t\t\tui,
\t\t\tprocess.cwd(),
\t\t);

\t\texpect(component.render(120)).toEqual([]);
\t\tcomponent.markExecutionStarted();
\t\tcomponent.setArgsComplete();
\t\tcomponent.updateResult({ content: [{ type: "text", text: "Plan result remains visible" }], isError: false });

\t\tconst rendered = component.render(120).map(stripAnsi).join("\\n");
\t\texpect(rendered).toContain("Plan result remains visible");
\t\texpect(rendered).not.toContain("ExitPlanMode");
\t\texpect(rendered).not.toContain("sensitive call argument");
\t\texpect(rendered).not.toMatch(/^● /m);
\t});
`;
test = replaceOnce(test, marker, `${addition}${marker}`, "TodoWrite test marker");
writeFileSync(testPath, test);
