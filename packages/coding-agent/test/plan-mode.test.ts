import { mkdtempSync, rmSync } from "node:fs";
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

	it("exposes only planning-safe tools and restores the previous tool set", () => {
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
			"dangerous-extension-tool",
		];
		const planning = getPlanModeTools(["read", "bash", "edit", "write", "TodoWrite"], available);

		expect(planning).toEqual([
			"read",
			"grep",
			"find",
			"ls",
			"bash",
			"edit",
			"write",
			"AskUserQuestion",
			"ExitPlanMode",
		]);
		expect(planning).not.toContain("TodoWrite");
		expect(planning).not.toContain("dangerous-extension-tool");

		expect(getRestoredTools(["read", "bash", "TodoWrite"], planning, available)).toEqual([
			"read",
			"bash",
			"TodoWrite",
			"EnterPlanMode",
			"AskUserQuestion",
		]);
	});

	it("creates stable session plan identities, writes atomically, and copies on fork", () => {
		const agentDir = join(createTemporaryDirectory(), "agent");
		const identity = createPlanIdentity("session-123", { agentDir });
		const repeated = createPlanIdentity("session-123", { agentDir });
		expect(repeated).toEqual(identity);
		expect(identity.planPath).toMatch(/plans[/\\][a-z]+-[a-z]+-[a-z]+\.md$/);

		writePlanFile(identity.planPath, "# Plan\n\n- Inspect the code");
		expect(readPlanFile(identity.planPath)).toContain("Inspect the code");
		expect(isCurrentPlanFile(identity.planPath, identity.planPath, agentDir)).toBe(true);
		expect(isCurrentPlanFile(join(agentDir, "other.md"), identity.planPath, agentDir)).toBe(false);
		expect(isCurrentPlanFile(`${identity.planPath}.bak`, identity.planPath, agentDir)).toBe(false);

		const forked = createPlanIdentity("session-456", { agentDir });
		expect(copyPlanFile(identity.planPath, forked.planPath)).toBe(true);
		expect(readPlanFile(forked.planPath)).toBe(readPlanFile(identity.planPath));
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
		"find . -name '*.ts'",
		"git status --short",
		"git diff -- packages/coding-agent/src",
		"git branch --show-current",
		"npm view typebox version",
		"node --version",
	])("allows read-only command: %s", (command) => {
		expect(checkPlanReadOnlyCommand(command)).toEqual({ safe: true });
	});

	it.each([
		"git checkout main",
		"git branch feature-plan",
		"git remote add mirror https://example.com/repo.git",
		"git diff --output=/tmp/patch",
		"find . -delete",
		"find . -exec touch {} ;",
		"fd . -x rm {}",
		"sort input -o output",
		"uniq input output",
		"tree -o tree.txt",
		"npm audit fix",
		"date --set='2030-01-01'",
		"cat input > output",
		"echo $(touch output)",
		"rg foo | tee output",
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
});