import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path: Path, old: str, new: str) -> None:
    text = path.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"expected exactly one match in {path}, found {count}")
    path.write_text(text.replace(old, new), encoding="utf-8")


def replace_regex_once(path: Path, pattern: str, replacement: str) -> None:
    text = path.read_text(encoding="utf-8")
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.DOTALL)
    if count != 1:
        raise RuntimeError(f"expected exactly one regex match in {path}, found {count}: {pattern}")
    path.write_text(updated, encoding="utf-8")


index_path = ROOT / "packages/coding-agent/src/extensions/plan-mode/index.ts"
replace_regex_once(
    index_path,
    r'const BUILTIN_READ_ONLY_TOOLS = .*?\nconst PLAN_FILE_TOOLS = .*?\nconst PLAN_CUSTOM_TOOLS = .*?;',
    'const PLAN_CUSTOM_TOOLS = [ASK_USER_QUESTION_TOOL_NAME, EXIT_PLAN_MODE_TOOL_NAME] as const;',
)
replace_regex_once(
    index_path,
    r'export function getPlanModeTools\(.*?\n}\n\nexport function getRestoredTools',
    '''export function getPlanModeTools(toolsBeforePlan: readonly string[], availableToolNames: readonly string[]): string[] {
\tconst available = new Set(availableToolNames);
\tconst requested = [
\t\t...toolsBeforePlan.filter((name) => name !== ENTER_PLAN_MODE_TOOL_NAME),
\t\t...PLAN_CUSTOM_TOOLS,
\t];
\treturn unique(requested.filter((name) => available.has(name)));
}

export function getRestoredTools''',
)
replace_regex_once(
    index_path,
    r'\n\t\tconst allowed = new Set<string>\(\[.*?\n\t\tif \(!allowed\.has\(event\.toolName\)\) \{.*?\n\t\t\}\n',
    '''
\t\t// Keep extension, MCP, web, LSP, and other custom tools available in plan mode.
\t\t// Their existing permission systems remain authoritative; this extension only
\t\t// adds hard enforcement for the built-in shell and file-write paths above.
''',
)

shell_policy_source = ROOT / "scripts/plan-mode-shell-policy.ts.tmp"
shell_policy_target = ROOT / "packages/coding-agent/src/extensions/plan-mode/shell-policy.ts"
shell_policy_target.write_text(shell_policy_source.read_text(encoding="utf-8"), encoding="utf-8")

test_path = ROOT / "packages/coding-agent/test/plan-mode.test.ts"
replace_regex_once(
    test_path,
    r'\tit\("keeps only previously active planning-safe tools.*?\n\t}\);\n\n\tit\("creates stable',
    '''\tit("preserves previously active tools in plan mode and restores the exact normal tool set", () => {
\t\tconst available = [
\t\t\t"read",
\t\t\t"bash",
\t\t\t"edit",
\t\t\t"write",
\t\t\t"grep",
\t\t\t"find",
\t\t\t"ls",
\t\t\t"TodoWrite",
\t\t\t"EnterPlanMode",
\t\t\t"ExitPlanMode",
\t\t\t"AskUserQuestion",
\t\t\t"external-info-tool",
\t\t];
\t\tconst normalTools = [
\t\t\t"read",
\t\t\t"bash",
\t\t\t"edit",
\t\t\t"write",
\t\t\t"TodoWrite",
\t\t\t"EnterPlanMode",
\t\t\t"AskUserQuestion",
\t\t\t"external-info-tool",
\t\t];
\t\tconst planning = getPlanModeTools(normalTools, available);

\t\texpect(planning).toEqual([
\t\t\t"read",
\t\t\t"bash",
\t\t\t"edit",
\t\t\t"write",
\t\t\t"TodoWrite",
\t\t\t"AskUserQuestion",
\t\t\t"external-info-tool",
\t\t\t"ExitPlanMode",
\t\t]);
\t\texpect(planning).not.toContain("EnterPlanMode");
\t\texpect(planning).not.toContain("grep");
\t\texpect(planning).not.toContain("find");
\t\texpect(planning).not.toContain("ls");
\t\texpect(getRestoredTools(normalTools, planning, available)).toEqual(normalTools);

\t\texpect(getPlanModeTools(["read", "EnterPlanMode", "AskUserQuestion"], available)).toEqual([
\t\t\t"read",
\t\t\t"AskUserQuestion",
\t\t\t"ExitPlanMode",
\t\t]);
\t});

\tit("creates stable''',
)
replace_once(
    test_path,
    '\t\t"npm view typebox version",\n\t\t"node --version",',
    '''\t\t"npm view typebox version",
\t\t"node --version",
\t\t"rg plan packages/coding-agent/src | head -40",
\t\t"git show HEAD:package.json | jq '.scripts'",
\t\t"git status --short && git diff --stat",
\t\t"pwd; git status --short",
\t\t"sed -n '1,40p' packages/coding-agent/src/extensions/plan-mode/index.ts",
\t\t"gh pr view 45 --json title,state",
\t\t"docker inspect pi-claude",''',
)
replace_once(
    test_path,
    '\t\t"rg foo | tee output",\n\t\tString.raw`echo \\\\; touch output`,',
    '''\t\t"rg foo | tee output",
\t\t"git status --short && git checkout main",
\t\t"sed -i 's/a/b/' file.txt",
\t\t"sed -n '1w output' file.txt",
\t\t"gh pr merge 45",
\t\t"docker exec pi-claude touch output",
\t\tString.raw`echo \\\\; touch output`,''',
)
replace_once(
    test_path,
    '\tit("uses a guarded fresh session instead of compaction for clear-context plan approval", () => {',
    '''\tit("does not blanket-block custom tools after entering plan mode", () => {
\t\tconst source = readFileSync(new URL("../src/extensions/plan-mode/index.ts", import.meta.url), "utf8");
\t\texpect(source).toContain("Keep extension, MCP, web, LSP, and other custom tools available");
\t\texpect(source).not.toContain("not known to be read-only");
\t});

\tit("uses a guarded fresh session instead of compaction for clear-context plan approval", () => {''',
)
