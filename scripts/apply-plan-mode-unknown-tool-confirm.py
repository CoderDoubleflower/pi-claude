from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path: Path, old: str, new: str) -> None:
    text = path.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"expected exactly one match in {path}, found {count}")
    path.write_text(text.replace(old, new), encoding="utf-8")


index_path = ROOT / "packages/coding-agent/src/extensions/plan-mode/index.ts"
replace_once(
    index_path,
    'const PLAN_CUSTOM_TOOLS = [ASK_USER_QUESTION_TOOL_NAME, EXIT_PLAN_MODE_TOOL_NAME] as const;',
    '''const PLAN_CUSTOM_TOOLS = [ASK_USER_QUESTION_TOOL_NAME, EXIT_PLAN_MODE_TOOL_NAME] as const;
const PLAN_ALWAYS_ALLOWED_TOOLS = new Set<string>([
\t"read",
\t"grep",
\t"find",
\t"ls",
\t"TodoWrite",
\t...PLAN_CUSTOM_TOOLS,
]);
const PLAN_TOOL_INPUT_PREVIEW_LIMIT = 1200;''',
)
replace_once(
    index_path,
    '''function unique(values: readonly string[]): string[] {
\treturn [...new Set(values)];
}''',
    '''function unique(values: readonly string[]): string[] {
\treturn [...new Set(values)];
}

function buildPlanToolInputPreview(input: Record<string, unknown>): string {
\tlet serialized: string;
\ttry {
\t\tserialized = JSON.stringify(input, null, 2);
\t} catch {
\t\tserialized = "(arguments could not be serialized)";
\t}
\treturn serialized.length > PLAN_TOOL_INPUT_PREVIEW_LIMIT
\t\t? `${serialized.slice(0, PLAN_TOOL_INPUT_PREVIEW_LIMIT)}…`
\t\t: serialized;
}''',
)
replace_once(
    index_path,
    'pi.on("tool_call", (event, ctx) => {',
    'pi.on("tool_call", async (event, ctx) => {',
)
replace_once(
    index_path,
    '''\t\t// Keep extension, MCP, web, LSP, and other custom tools available in plan mode.
\t\t// Their existing permission systems remain authoritative; this extension only
\t\t// adds hard enforcement for the built-in shell and file-write paths above.''',
    '''\t\tif (PLAN_ALWAYS_ALLOWED_TOOLS.has(event.toolName)) return;

\t\tif (!ctx.hasUI) {
\t\t\treturn {
\t\t\t\tblock: true,
\t\t\t\treason: `Plan mode could not verify that ${event.toolName} is read-only, and no interactive approval UI is available.`,
\t\t\t};
\t\t}

\t\tconst approved = await ctx.ui.confirm(
\t\t\t`Allow ${event.toolName} in plan mode?`,
\t\t\t`This tool is not known to be read-only. Allow this invocation?\\n\\nArguments:\\n${buildPlanToolInputPreview(event.input)}`,
\t\t);
\t\tif (!approved) {
\t\t\treturn {
\t\t\t\tblock: true,
\t\t\t\treason: `The user declined ${event.toolName} while plan mode is active.`,
\t\t\t};
\t\t}''',
)

test_path = ROOT / "packages/coding-agent/test/plan-mode.test.ts"
replace_once(
    test_path,
    '''\tit("does not blanket-block custom tools after entering plan mode", () => {
\t\tconst source = readFileSync(new URL("../src/extensions/plan-mode/index.ts", import.meta.url), "utf8");
\t\texpect(source).toContain("Keep extension, MCP, web, LSP, and other custom tools available");
\t\texpect(source).not.toContain("not known to be read-only");
\t});''',
    '''\tit("asks before running tools whose plan-mode safety is unknown", () => {
\t\tconst source = readFileSync(new URL("../src/extensions/plan-mode/index.ts", import.meta.url), "utf8");
\t\texpect(source).toContain("PLAN_ALWAYS_ALLOWED_TOOLS.has(event.toolName)");
\t\texpect(source).toContain("This tool is not known to be read-only. Allow this invocation?");
\t\texpect(source).toContain("no interactive approval UI is available");
\t\texpect(source).not.toContain("is unavailable in plan mode because it is not known to be read-only");
\t});''',
)
