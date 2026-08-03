import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { SessionEntry } from "../src/core/session-manager.ts";
import { builtInExtensions } from "../src/extensions/index.ts";
import { getPlanModeTools, getRestoredTools } from "../src/extensions/plan-mode/index.ts";
import {
	copyPlanFile,
	createPlanIdentity,
	isCurrentPlanFile,
	isPathInsidePlansDirectory,
	readPlanFile,
	writePlanFile,
} from "../src/extensions/plan-mode/plan-store.ts";
import {
	buildFullPlanModePrompt,
	buildSparsePlanModePrompt,
	EXIT_PLAN_MODE_TOOL_NAME,
} from "../src/extensions/plan-mode/prompts.ts";
import { checkPlanReadOnlyCommand } from "../src/extensions/plan-mode/shell-policy.ts";
import {
	createDefaultPlanModeState,
	findLatestPlanModeState,
	PLAN_MODE_STATE_ENTRY,
	parsePlanModeState,
} from "../src/extensions/plan-mode/state.ts";

const temporaryDirectories: string[] = [];

function createTemporaryDirectory(): string {
	const directory = mkdtempSync(join(tmpdir(), "pi-plan-mode-test-"));
	temporaryDirectories.push(directory);
	return directory;
}

afterEach(() => {
	for (const directory of temporaryDirectories.splice(0)) {
		rmSync(directory, { recursive: true, force: true });
	}
});

describe("Claude-style plan mode", () => {
	it("is registered as a hidden built-in extension", () => {
		expect(builtInExtensions).toContainEqual(expect.objectContaining({ name: "plan-mode", hidden: true }));
	});

	it("preserves previously active tools in plan mode and restores the exact normal tool set", () => {
		const available = [
			"read",
			"bash",
			"edit",
			"write",
			"grep",
			"find",
			"ls",
			"TodoWrite",
			"EnterPlanMode",
			"ExitPlanMode",
			"AskUserQuestion",
			"external-info-tool",
		];
		const normalTools = [
			"read",
			"bash",
			"edit",
			"write",
			"TodoWrite",
			"EnterPlanMode",
			"AskUserQuestion",
			"external-info-tool",
		];
		const planning = getPlanModeTools(normalTools, available);

		expect(planning).toEqual([
			"read",
			"bash",
			"edit",
			"write",
			"TodoWrite",
			"AskUserQuestion",
			"external-info-tool",
			"ExitPlanMode",
		]);
		expect(planning).not.toContain("EnterPlanMode");
		expect(planning).not.toContain("grep");
		expect(planning).not.toContain("find");
		expect(planning).not.toContain("ls");
		expect(getRestoredTools(normalTools, planning, available)).toEqual(normalTools);

		expect(getPlanModeTools(["read", "EnterPlanMode", "AskUserQuestion"], available)).toEqual([
			"read",
			"AskUserQuestion",
			"ExitPlanMode",
		]);
	});

	it("creates stable session plan identities, replaces existing plans, and copies on fork", () => {
		const agentDir = join(createTemporaryDirectory(), "agent");
		const identity = createPlanIdentity("session-123", { agentDir });
		const repeated = createPlanIdentity("session-123", { agentDir });
		expect(repeated).toEqual(identity);
		expect(identity.planPath).toMatch(/plans[/\\][a-z]+-[a-z]+-[a-z]+\.md$/);

		writePlanFile(identity.planPath, "# Plan\n\n- Inspect the code");
		expect(readPlanFile(identity.planPath)).toContain("Inspect the code");
		writePlanFile(identity.planPath, "# Updated Plan\n\n- Verify the fix");
		expect(readPlanFile(identity.planPath)).toContain("Verify the fix");
		expect(isCurrentPlanFile(identity.planPath, identity.planPath, agentDir)).toBe(true);
		expect(isCurrentPlanFile(join(agentDir, "other.md"), identity.planPath, agentDir)).toBe(false);
		expect(isCurrentPlanFile(`${identity.planPath}.bak`, identity.planPath, agentDir)).toBe(false);

		const forked = createPlanIdentity("session-456", { agentDir });
		expect(copyPlanFile(identity.planPath, forked.planPath)).toBe(true);
		expect(readPlanFile(forked.planPath)).toBe(readPlanFile(identity.planPath));
	});

	it("checks plans-directory membership without creating the directory", () => {
		const root = createTemporaryDirectory();
		const agentDir = join(root, "agent");
		const plansDirectory = join(root, "plans");
		const planPath = join(plansDirectory, "example.md");

		expect(existsSync(plansDirectory)).toBe(false);
		expect(isPathInsidePlansDirectory(planPath, agentDir)).toBe(true);
		expect(isPathInsidePlansDirectory(join(root, "outside.md"), agentDir)).toBe(false);
		expect(existsSync(plansDirectory)).toBe(false);
	});

	it("avoids an existing plan slug instead of overwriting it", () => {
		const agentDir = join(createTemporaryDirectory(), "agent");
		const first = createPlanIdentity("session-collision", { agentDir });
		const second = createPlanIdentity("session-collision", {
			agentDir,
			pathExists: (path) => path === first.planPath,
		});
		expect(second.planPath).not.toBe(first.planPath);
		expect(second.planSlug).toMatch(/-2$/);
	});

	it.each([
		"pwd",
		"rg plan packages/coding-agent/src",
		"rg '$HOME' packages/coding-agent/src",
		"rg '(foo|bar)' packages/coding-agent/src",
		"find . -name '*.ts'",
		"git status --short",
		"git diff -- packages/coding-agent/src",
		"git branch --show-current",
		"git remote -v",
		"git config --get core.editor",
		"npm view typebox version",
		"node --version",
		"rg plan packages/coding-agent/src | head -40",
		"git show HEAD:package.json | jq '.scripts'",
		"git status --short && git diff --stat",
		"pwd; git status --short",
		"sed -n '1,40p' packages/coding-agent/src/extensions/plan-mode/index.ts",
		"gh pr view 45 --json title,state",
		"docker inspect pi-claude",
	])("allows read-only command: %s", (command) => {
		expect(checkPlanReadOnlyCommand(command)).toEqual({ safe: true });
	});

	it.each([
		"git checkout main",
		"git branch feature-plan",
		"git branch -Dmain",
		"git branch --unset-upstream",
		"git branch --edit-description",
		"git remote add mirror https://example.com/repo.git",
		"git diff --output=/tmp/patch",
		"git diff --out=/tmp/patch",
		"git diff --ext-diff",
		"git show --textconv HEAD:file",
		"git grep --open-files-in-pager='sh -c touch output' pattern",
		"git cat-file --filters HEAD:file",
		"git config --list --add core.foo bar",
		"find . -delete",
		"find . -exec touch {} ;",
		"find . $'-exec' touch {} +",
		"find . $" + "{PLAN_PRIMARY} touch {} +",
		"find . -{ex,}ec touch {} +",
		"find . -*",
		"find . @(-exec)",
		"fd . -x rm {}",
		"fd . --exec=rm",
		"rg --pre='touch output' pattern .",
		"rg --pr='touch output' pattern .",
		"sort input -o output",
		"sort --compress-program='sh -c touch output' input",
		"sort --compress-prog='sh -c touch output' input",
		"diff -oout before after",
		"uniq input output",
		"tree -o tree.txt",
		"tree -otree.txt",
		"less -Oout.txt input",
		"less --log-file=out.txt input",
		"less '+!touch output' input",
		"less --cmd='!touch output' input",
		"file --compile -m magic",
		"bat --pager='sh -c touch output' README.md",
		"bat --generate-config-file",
		"bat cache --build",
		"bat cache --clear",
		"npm audit fix",
		"date --set='2030-01-01'",
		"date --se='2030-01-01'",
		"date -s2030-01-01",
		"cat input > output",
		"echo $(touch output)",
		"rg foo | tee output",
		"git status --short && git checkout main",
		"sed -i 's/a/b/' file.txt",
		"sed -n '1w output' file.txt",
		"gh pr merge 45",
		"docker exec pi-claude touch output",
		String.raw`echo \\; touch output`,
		'python -c \'open("output", "w").write("x")\'',
	])("blocks state-changing command: %s", (command) => {
		expect(checkPlanReadOnlyCommand(command).safe).toBe(false);
	});

	it("restores the latest branch-local state and rejects malformed entries", () => {
		const initial = createDefaultPlanModeState();
		expect(parsePlanModeState({ phase: "broken" })).toBeUndefined();
		const planning = {
			...initial,
			phase: "planning" as const,
			planSlug: "calm-mapping-river",
			planPath: "/tmp/calm-mapping-river.md",
			toolsBeforePlan: ["read", "bash"],
		};
		const entries = [
			{
				type: "custom",
				id: "one",
				parentId: null,
				timestamp: new Date(0).toISOString(),
				customType: PLAN_MODE_STATE_ENTRY,
				data: initial,
			},
			{
				type: "custom",
				id: "two",
				parentId: "one",
				timestamp: new Date(1).toISOString(),
				customType: PLAN_MODE_STATE_ENTRY,
				data: planning,
			},
		] as SessionEntry[];

		expect(findLatestPlanModeState(entries)).toEqual(planning);
	});

	it("injects the plan path, hard read-only restriction, and approval protocol", () => {
		const prompt = buildFullPlanModePrompt({
			planPath: "/tmp/example-plan.md",
			planExists: false,
		});
		expect(prompt).toContain("/tmp/example-plan.md");
		expect(prompt).toContain("only file you may create or modify");
		expect(prompt).toContain("AskUserQuestion");
		expect(prompt).toContain(EXIT_PLAN_MODE_TOOL_NAME);
		expect(buildSparsePlanModePrompt("/tmp/example-plan.md")).toContain("Never request plan approval");
	});

	it("asks before running tools whose plan-mode safety is unknown", () => {
		const source = readFileSync(new URL("../src/extensions/plan-mode/index.ts", import.meta.url), "utf8");
		expect(source).toContain("PLAN_ALWAYS_ALLOWED_TOOLS.has(event.toolName)");
		expect(source).toContain("This tool is not known to be read-only. Allow this invocation?");
		expect(source).toContain("no interactive approval UI is available");
		expect(source).not.toContain("is unavailable in plan mode because it is not known to be read-only");
	});

	it("uses a guarded fresh session instead of compaction for clear-context plan approval", () => {
		const source = readFileSync(new URL("../src/extensions/plan-mode/index.ts", import.meta.url), "utf8");
		expect(source).toContain("const startFreshSession = ctx.newSession;");
		expect(source).toContain("void startFreshSession({");
		expect(source).toContain("Context clear is unavailable; starting implementation in the current context.");
		expect(source).toContain("Starting implementation with a clean context.");
		expect(source).not.toContain("ctx.compact({");
		expect(source).not.toContain("implementation will start after compaction");
		expect(source).not.toContain("Starting implementation with a compacted context.");
	});
});
