import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildPlanExecutionSessionName } from "../src/extensions/plan-mode/clean-session-wrapper.ts";

describe("clear-context plan session handoff", () => {
	it("discards persisted parent lineage and assigns the execution title during session setup", () => {
		const source = readFileSync(
			new URL("../src/extensions/plan-mode/clean-session-wrapper.ts", import.meta.url),
			"utf8",
		);
		expect(source).toContain("parentSession: _discardedParentSession");
		expect(source).toContain("...independentOptions");
		expect(source).toContain("setup: async (sessionManager) =>");
		expect(source).toContain("sessionManager.appendSessionInfo(executionSessionName);");
		expect(source).not.toContain("parentSession: parentSession");
	});

	it("registers the clean-session adapter as the native plan-mode extension", () => {
		const source = readFileSync(new URL("../src/extensions/index.ts", import.meta.url), "utf8");
		expect(source).toContain('from "./plan-mode/clean-session-wrapper.ts"');
	});

	it("prefers the planning session title and falls back to the approved plan heading", () => {
		expect(
			buildPlanExecutionSessionName(
				"# Implement the clean session handoff\n\n- Detach the execution session",
				"修复 plan 模式清空上下文后的会话",
			),
		).toBe("修复 plan 模式清空上下文后的会话");

		expect(buildPlanExecutionSessionName("# Implement the clean session handoff\n\n- Add tests")).toBe(
			"Implement the clean session handoff",
		);
	});

	it("normalizes and bounds generated session names", () => {
		const title = buildPlanExecutionSessionName(`# ${"a".repeat(160)}`);
		expect(Array.from(title)).toHaveLength(120);
		expect(title.endsWith("…")).toBe(true);
		expect(buildPlanExecutionSessionName("\n\n")).toBe("Implement approved plan");
	});
});
