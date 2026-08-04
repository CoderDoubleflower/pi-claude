import type { AssistantMessage } from "@earendil-works/pi-ai/compat";
import { describe, expect, it } from "vitest";
import {
	getToolActivityEdgeBoundaries,
	getToolActivityStreamActions,
} from "../src/modes/interactive/tool-activity-boundaries.ts";

type AssistantContent = AssistantMessage["content"][number];

function toolCall(id: string): AssistantContent {
	return { type: "toolCall", id, name: "bash", arguments: { command: `echo ${id}` } };
}

function actionLabels(content: AssistantContent[]): string[] {
	return getToolActivityStreamActions(content).map((action) =>
		action.type === "break" ? "break" : `tool:${action.content.id}`,
	);
}

describe("tool activity boundaries", () => {
	it("separates a later tool call from an earlier group when thinking is visible", () => {
		expect(
			actionLabels([toolCall("before"), { type: "thinking", thinking: "inspect the result" }, toolCall("after")]),
		).toEqual(["tool:before", "break", "tool:after"]);
	});

	it("keeps consecutive tools after one thinking block in the same group", () => {
		expect(
			actionLabels([{ type: "thinking", thinking: "plan both calls" }, toolCall("one"), toolCall("two")]),
		).toEqual(["break", "tool:one", "tool:two"]);
	});

	it("breaks the active group after trailing visible assistant content", () => {
		expect(actionLabels([toolCall("one"), { type: "text", text: "done" }])).toEqual(["tool:one", "break"]);
	});

	it("ignores empty thinking blocks", () => {
		expect(actionLabels([toolCall("one"), { type: "thinking", thinking: "  " }, toolCall("two")])).toEqual([
			"tool:one",
			"tool:two",
		]);
	});

	it("uses thinking as a history boundary before and after tools", () => {
		expect(
			getToolActivityEdgeBoundaries([
				{ type: "thinking", thinking: "before" },
				toolCall("one"),
				{ type: "thinking", thinking: "after" },
			]),
		).toEqual({ hasToolCalls: true, breakBeforeTools: true, breakAfterTools: true });
	});
});
