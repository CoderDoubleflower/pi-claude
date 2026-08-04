import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildPlanExecutionSessionName } from "../src/extensions/plan-mode/index.ts";

describe("clear-context plan session handoff", () => {
	it("creates an independent session and assigns its title before implementation starts", () => {
		const source = readFileSync(new URL("../src/extensions/plan-mode/index.ts", import.meta.url), "utf8");
		const start = source.indexOf('pi.on("agent_settled"');
		const end = source.indexOf('pi.on("session_compact"', start);

		expect(start).toBeGreaterThanOrEqual(0);
		expect(end).toBeGreaterThan(start);

		const handoff = source.slice(start, end);
		expect(handoff).not.toContain("parentSession");
		expect(handoff).toContain("setup: async (sessionManager) =>");
		expect(handoff).toContain("sessionManager.appendSessionInfo(executionSessionName);");
		expect(handoff.indexOf("setup: async (sessionManager) =>")).toBeLessThan(handoff.indexOf("withSession: async"));
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
