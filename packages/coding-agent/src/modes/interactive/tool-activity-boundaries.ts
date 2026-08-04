import type { AssistantMessage } from "@earendil-works/pi-ai/compat";

type AssistantContent = AssistantMessage["content"][number];
type ToolCallContent = Extract<AssistantContent, { type: "toolCall" }>;

export type ToolActivityStreamAction = { type: "break" } | { type: "toolCall"; content: ToolCallContent };

export interface ToolActivityEdgeBoundaries {
	hasToolCalls: boolean;
	breakBeforeTools: boolean;
	breakAfterTools: boolean;
}

export function isVisibleAssistantContent(content: AssistantContent): boolean {
	if (content.type === "text") return content.text.trim().length > 0;
	if (content.type === "thinking") return content.thinking.trim().length > 0;
	return false;
}

export function getToolActivityStreamActions(content: readonly AssistantContent[]): ToolActivityStreamAction[] {
	const actions: ToolActivityStreamAction[] = [];
	let hasPendingVisibleBoundary = false;

	for (const item of content) {
		if (isVisibleAssistantContent(item)) {
			hasPendingVisibleBoundary = true;
			continue;
		}
		if (item.type !== "toolCall") continue;

		if (hasPendingVisibleBoundary) {
			actions.push({ type: "break" });
			hasPendingVisibleBoundary = false;
		}
		actions.push({ type: "toolCall", content: item });
	}

	if (hasPendingVisibleBoundary) actions.push({ type: "break" });
	return actions;
}

export function getToolActivityEdgeBoundaries(content: readonly AssistantContent[]): ToolActivityEdgeBoundaries {
	const firstToolIndex = content.findIndex((item) => item.type === "toolCall");
	if (firstToolIndex < 0) {
		return { hasToolCalls: false, breakBeforeTools: true, breakAfterTools: false };
	}

	let lastToolIndex = firstToolIndex;
	for (let index = content.length - 1; index > firstToolIndex; index -= 1) {
		if (content[index]?.type === "toolCall") {
			lastToolIndex = index;
			break;
		}
	}

	return {
		hasToolCalls: true,
		breakBeforeTools: content.slice(0, firstToolIndex).some(isVisibleAssistantContent),
		breakAfterTools: content.slice(lastToolIndex + 1).some(isVisibleAssistantContent),
	};
}
