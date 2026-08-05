import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
	buildIndependentExecutionSessionOptions,
	buildPlanExecutionSessionName,
} from "../src/extensions/plan-mode/clean-session-wrapper.ts";

describe("clear-context plan session handoff", () => {
	it("discards persisted parent lineage and assigns the execution title during session setup", async () => {
		const calls: string[] = [];
		const options = buildIndependentExecutionSessionOptions(
			{
				parentSession: "/tmp/planning-session.jsonl",
				setup: async () => {
					calls.push("original-setup");
				},
			},
			"Implement clean session handoff",
		);

		expect(options).not.toHaveProperty("parentSession");
		await options.setup?.({
			getSessionName: () => undefined,
			appendSessionInfo: (name: string) => calls.push(`title:${name}`),
		} as never);
		expect(calls).toEqual(["original-setup", "title:Implement clean session handoff"]);
	});

	it("does not replace a title assigned by an earlier setup hook", async () => {
		const appendSessionInfo = vi.fn();
		const options = buildIndependentExecutionSessionOptions(undefined, "Generated title");
		await options.setup?.({
			getSessionName: () => "Existing title",
			appendSessionInfo,
		} as never);
		expect(appendSessionInfo).not.toHaveBeenCalled();
	});

	it("registers the clean-session adapter as the native plan-mode extension", () => {
		const source = readFileSync(new URL("../src/extensions/index.ts", import.meta.url), "utf8");
		expect(source).toContain('from "./plan-mode/clean-session-wrapper.ts"');
	});

	it("uses the approved plan heading and falls back to the planning-session title", () => {
		expect(
			buildPlanExecutionSessionName(
				"# Implement the clean session handoff\n\n- Detach the execution session",
				"修复 plan 模式清空上下文后的会话",
			),
		).toBe("Implement the clean session handoff");

		expect(buildPlanExecutionSessionName("# Plan\n\n", "修复 plan 模式清空上下文后的会话")).toBe(
			"修复 plan 模式清空上下文后的会话",
		);
	});

	it("normalizes and bounds generated session names", () => {
		const title = buildPlanExecutionSessionName(`# ${"a".repeat(160)}`);
		expect(Array.from(title)).toHaveLength(120);
		expect(title.endsWith("…")).toBe(true);
		expect(buildPlanExecutionSessionName("\n\n")).toBe("Implement approved plan");
	});
});
