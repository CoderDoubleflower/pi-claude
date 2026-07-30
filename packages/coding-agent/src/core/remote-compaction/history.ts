import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { Api, Model, Usage } from "@earendil-works/pi-ai";
import type { ToolInfo } from "../extensions/index.ts";
import {
	cloneResponseItem,
	IMAGE_CONTENT_OMITTED_PLACEHOLDER,
	isRecord,
	modelKey,
	RETAINED_MESSAGE_TOKEN_BUDGET,
	type AssistantPhase,
	type BranchEntry,
	type ContentPartLike,
	type RemoteCompactionDetails,
	type RemoteCompactionSessionState,
	type ResponseContentItem,
	type ResponseItem,
	type ToolResultOutputItem,
} from "./types.ts";

function isAssistantPhase(value: unknown): value is AssistantPhase {
	return value === "commentary" || value === "final_answer";
}

function parseTextSignaturePhase(value: unknown): AssistantPhase | undefined {
	if (typeof value !== "string" || !value.trim()) return undefined;
	try {
		const parsed = JSON.parse(value) as unknown;
		return isRecord(parsed) && isAssistantPhase(parsed.phase) ? parsed.phase : undefined;
	} catch {
		return undefined;
	}
}

function contentToResponseContentItems(content: unknown): ResponseContentItem[] {
	if (typeof content === "string") return content ? [{ type: "input_text", text: content }] : [];
	if (!Array.isArray(content)) return [];

	const items: ResponseContentItem[] = [];
	for (const part of content as ContentPartLike[]) {
		if (
			(part.type === "text" || part.type === "input_text" || part.type === "output_text") &&
			typeof part.text === "string"
		) {
			items.push({ type: "input_text", text: part.text });
			continue;
		}
		if (part.type === "image" && typeof part.data === "string" && typeof part.mimeType === "string") {
			items.push({ type: "input_image", image_url: `data:${part.mimeType};base64,${part.data}` });
			continue;
		}
		if (
			part.type === "input_image" &&
			isRecord(part.source) &&
			part.source.type === "url" &&
			typeof part.source.url === "string"
		) {
			items.push({ type: "input_image", image_url: part.source.url });
		}
	}
	return items;
}

function toolResultContentToOutput(content: unknown): string | ToolResultOutputItem[] {
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return "";

	const output: ToolResultOutputItem[] = [];
	for (const item of content) {
		if (!isRecord(item)) continue;
		if (item.type === "text" && typeof item.text === "string") {
			output.push({ type: "input_text", text: item.text });
		} else if (item.type === "image" && typeof item.data === "string" && typeof item.mimeType === "string") {
			output.push({ type: "input_image", image_url: `data:${item.mimeType};base64,${item.data}` });
		}
	}
	return output;
}

function parseThinkingSignature(value: unknown): ResponseItem | undefined {
	if (typeof value !== "string" || !value.trim()) return undefined;
	try {
		const parsed = JSON.parse(value) as unknown;
		if (!isRecord(parsed) || parsed.type !== "reasoning") return undefined;
		const summary = Array.isArray(parsed.summary)
			? parsed.summary
					.map((item) =>
						isRecord(item) && typeof item.text === "string"
							? { type: "summary_text" as const, text: item.text }
							: undefined,
					)
					.filter((item): item is { type: "summary_text"; text: string } => item !== undefined)
			: [];
		const content = Array.isArray(parsed.content)
			? parsed.content
					.map((item) => {
						if (!isRecord(item) || typeof item.text !== "string") return undefined;
						return {
							type: item.type === "reasoning_text" ? ("reasoning_text" as const) : ("text" as const),
							text: item.text,
						};
					})
					.filter(
						(item): item is { type: "reasoning_text" | "text"; text: string } => item !== undefined,
					)
			: undefined;
		return {
			type: "reasoning",
			summary,
			...(content && content.length > 0 ? { content } : {}),
			encrypted_content: typeof parsed.encrypted_content === "string" ? parsed.encrypted_content : null,
		};
	} catch {
		return undefined;
	}
}

export function isResponseItem(value: unknown): value is ResponseItem {
	return isRecord(value) && typeof value.type === "string";
}

export function messageToResponseItems(message: AgentMessage): ResponseItem[] {
	const items: ResponseItem[] = [];
	if (message.role === "user") {
		const content = contentToResponseContentItems(message.content);
		if (content.length > 0) items.push({ type: "message", role: "user", content });
		return items;
	}
	if (message.role === "assistant") {
		let phase: AssistantPhase | undefined;
		const textBlocks: string[] = [];
		const flushText = (): void => {
			if (textBlocks.length === 0) return;
			items.push({
				type: "message",
				role: "assistant",
				content: [{ type: "output_text", text: textBlocks.join("") }],
				...(phase ? { phase } : {}),
			});
			textBlocks.length = 0;
		};
		for (const block of message.content) {
			if (block.type === "text") {
				phase ??= parseTextSignaturePhase(block.textSignature);
				textBlocks.push(block.text);
				continue;
			}
			if (block.type === "thinking") {
				flushText();
				const reasoning = parseThinkingSignature(block.thinkingSignature);
				if (reasoning) items.push(reasoning);
				continue;
			}
			if (block.type !== "toolCall") continue;
			flushText();
			const callId = typeof block.id === "string" ? block.id.split("|", 1)[0] : String(block.id);
			items.push({
				type: "function_call",
				name: block.name,
				call_id: callId,
				arguments: JSON.stringify(block.arguments ?? {}),
			});
		}
		flushText();
		return items;
	}
	if (message.role === "toolResult") {
		items.push({
			type: "function_call_output",
			call_id: message.toolCallId.split("|", 1)[0],
			output: toolResultContentToOutput(message.content),
		});
	}
	return items;
}

export function messagesToResponseItems(messages: AgentMessage[]): ResponseItem[] {
	return messages.flatMap(messageToResponseItems);
}

function responseItemCallId(item: ResponseItem): string | undefined {
	const callId = (item as Record<string, unknown>).call_id;
	return typeof callId === "string" && callId ? callId : undefined;
}

function syntheticOutputForCall(item: ResponseItem): ResponseItem | undefined {
	const callId = responseItemCallId(item);
	if (!callId) return undefined;
	if (item.type === "function_call" || item.type === "local_shell_call") {
		return { type: "function_call_output", call_id: callId, output: "aborted" };
	}
	if (item.type === "custom_tool_call") {
		return { type: "custom_tool_call_output", call_id: callId, output: "aborted" };
	}
	return undefined;
}

function outputTypeForCallType(type: string): string | undefined {
	if (type === "function_call" || type === "local_shell_call") return "function_call_output";
	if (type === "custom_tool_call") return "custom_tool_call_output";
	return undefined;
}

function ensureCallOutputsPresent(items: ResponseItem[]): ResponseItem[] {
	const normalized: ResponseItem[] = [];
	for (const item of items) {
		normalized.push(item);
		const outputType = outputTypeForCallType(item.type);
		const callId = responseItemCallId(item);
		if (!outputType || !callId) continue;
		const hasOutput = items.some(
			(candidate) => candidate.type === outputType && responseItemCallId(candidate) === callId,
		);
		if (!hasOutput) {
			const synthetic = syntheticOutputForCall(item);
			if (synthetic) normalized.push(synthetic);
		}
	}
	return normalized;
}

function removeOrphanOutputs(items: ResponseItem[]): ResponseItem[] {
	const functionCallIds = new Set<string>();
	const customToolCallIds = new Set<string>();
	for (const item of items) {
		const callId = responseItemCallId(item);
		if (!callId) continue;
		if (item.type === "function_call" || item.type === "local_shell_call") functionCallIds.add(callId);
		if (item.type === "custom_tool_call") customToolCallIds.add(callId);
	}
	return items.filter((item) => {
		const callId = responseItemCallId(item);
		if (item.type === "function_call_output") return Boolean(callId && functionCallIds.has(callId));
		if (item.type === "custom_tool_call_output") return Boolean(callId && customToolCallIds.has(callId));
		return true;
	});
}

function stripImagesWhenUnsupported(items: ResponseItem[], model: Model<Api>): ResponseItem[] {
	if (model.input.includes("image")) return items;
	return items.map((item) => {
		const next = cloneResponseItem(item);
		if (next.type === "message" && Array.isArray(next.content)) {
			next.content = next.content.map((part) =>
				part.type === "input_image"
					? { type: "input_text", text: IMAGE_CONTENT_OMITTED_PLACEHOLDER }
					: part,
			);
		} else if (next.type === "function_call_output" && Array.isArray(next.output)) {
			next.output = next.output.map((part) =>
				part.type === "input_image"
					? { type: "input_text", text: IMAGE_CONTENT_OMITTED_PLACEHOLDER }
					: part,
			);
		}
		return next;
	});
}

export function normalizeResponseItemsForPrompt(items: ResponseItem[], model: Model<Api>): ResponseItem[] {
	const withoutGhostSnapshots = items.filter((item) => item.type !== "ghost_snapshot").map(cloneResponseItem);
	return stripImagesWhenUnsupported(removeOrphanOutputs(ensureCallOutputsPresent(withoutGhostSnapshots)), model);
}

function isRealUserMessage(item: ResponseItem): boolean {
	return item.type === "message" && item.role === "user" && Array.isArray(item.content) && item.content.length > 0;
}

function responseMessageText(item: ResponseItem): string {
	if (item.type !== "message" || !Array.isArray(item.content)) return "";
	return item.content
		.filter(
			(part): part is Extract<ResponseContentItem, { type: "input_text" | "output_text" }> =>
				part.type === "input_text" || part.type === "output_text",
		)
		.map((part) => part.text)
		.join("");
}

function truncateMessageToTokenBudget(item: ResponseItem, maxTokens: number): ResponseItem | undefined {
	if (item.type !== "message" || !Array.isArray(item.content)) return cloneResponseItem(item);
	let remainingCharacters = Math.max(0, maxTokens * 4);
	const content = item.content.flatMap((part) => {
		if (part.type === "input_image") return [part];
		if (remainingCharacters === 0) return [];
		const text = part.text.slice(0, remainingCharacters);
		remainingCharacters -= text.length;
		return text ? [{ ...part, text }] : [];
	});
	return content.length > 0 ? { ...cloneResponseItem(item), content } : undefined;
}

function truncateRetainedMessages(items: ResponseItem[], maxTokens: number): ResponseItem[] {
	let remainingTokens = maxTokens;
	const retainedReversed: ResponseItem[] = [];
	for (const item of [...items].reverse()) {
		if (remainingTokens === 0) break;
		const tokenCount = Math.max(1, Math.ceil(responseMessageText(item).length / 4));
		if (tokenCount <= remainingTokens) {
			retainedReversed.push(cloneResponseItem(item));
			remainingTokens -= tokenCount;
			continue;
		}
		const truncated = truncateMessageToTokenBudget(item, remainingTokens);
		if (truncated) retainedReversed.push(truncated);
		remainingTokens = 0;
	}
	return retainedReversed.reverse();
}

export function buildRemoteCompactionHistory(input: ResponseItem[], compactionItem: ResponseItem): ResponseItem[] {
	if (compactionItem.type !== "compaction") {
		throw new Error("The remote compaction response did not contain a compaction item.");
	}
	const retainedUserMessages = input.filter(isRealUserMessage);
	return [
		...truncateRetainedMessages(retainedUserMessages, RETAINED_MESSAGE_TOKEN_BUDGET),
		cloneResponseItem(compactionItem),
	];
}

function toolInfoToResponseTool(tool: ToolInfo): Record<string, unknown> {
	return { type: "function", name: tool.name, description: tool.description, parameters: tool.parameters };
}

export function buildToolsPayload(allTools: ToolInfo[], activeToolNames: string[]): Record<string, unknown>[] {
	const active = new Set(activeToolNames);
	return allTools.filter((tool) => active.has(tool.name)).map(toolInfoToResponseTool);
}

export function buildRemoteCompactionDetails(
	model: Model<Api>,
	replacementHistory: ResponseItem[],
	usage?: Usage,
): RemoteCompactionDetails {
	return {
		version: 2,
		provider: "openai-responses-compaction",
		implementation: "responses_compaction_v2",
		modelKey: modelKey(model),
		replacementHistory,
		...(usage ? { usage } : {}),
	};
}

function parseUsageCost(value: unknown): Usage["cost"] | undefined {
	if (!isRecord(value)) return undefined;
	const input = typeof value.input === "number" ? value.input : 0;
	const output = typeof value.output === "number" ? value.output : 0;
	const cacheRead = typeof value.cacheRead === "number" ? value.cacheRead : 0;
	const cacheWrite = typeof value.cacheWrite === "number" ? value.cacheWrite : 0;
	const total = typeof value.total === "number" ? value.total : input + output + cacheRead + cacheWrite;
	return { input, output, cacheRead, cacheWrite, total };
}

function parseUsage(value: unknown): Usage | undefined {
	if (!isRecord(value)) return undefined;
	const input = typeof value.input === "number" ? value.input : 0;
	const output = typeof value.output === "number" ? value.output : 0;
	const cacheRead = typeof value.cacheRead === "number" ? value.cacheRead : 0;
	const cacheWrite = typeof value.cacheWrite === "number" ? value.cacheWrite : 0;
	const totalTokens = typeof value.totalTokens === "number" ? value.totalTokens : input + output + cacheRead + cacheWrite;
	return {
		input,
		output,
		cacheRead,
		cacheWrite,
		totalTokens,
		cost: parseUsageCost(value.cost) ?? { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
	};
}

function extractRemoteCompactionDetails(details: unknown): RemoteCompactionDetails | undefined {
	if (!isRecord(details)) return undefined;
	const remote = isRecord(details.remoteCompaction) ? details.remoteCompaction : details;
	if (
		!isRecord(remote) ||
		remote.version !== 2 ||
		remote.provider !== "openai-responses-compaction" ||
		!Array.isArray(remote.replacementHistory)
	) {
		return undefined;
	}
	const replacementHistory = remote.replacementHistory.filter(isResponseItem);
	if (replacementHistory.length === 0) return undefined;
	const usage = parseUsage(remote.usage);
	return {
		version: 2,
		provider: "openai-responses-compaction",
		implementation: "responses_compaction_v2",
		modelKey: typeof remote.modelKey === "string" ? remote.modelKey : "",
		replacementHistory,
		...(usage ? { usage } : {}),
	};
}

function parseModelKey(value: string): { provider: string; id: string } | undefined {
	const [provider, _api, id] = value.split(":", 3);
	return provider && id ? { provider, id } : undefined;
}

export function assistantMessageMatchesModelKey(message: AgentMessage, targetModelKey: string): boolean {
	const target = parseModelKey(targetModelKey);
	if (!target || message.role !== "assistant") return false;
	return message.provider === target.provider && message.model === target.id;
}

export function reconstructRemoteCompactionStateFromBranch(params: {
	branchEntries: BranchEntry[];
}): RemoteCompactionSessionState | undefined {
	let latestCompactionIndex = -1;
	let latestCompactionEntryId = "";
	let latestDetails: RemoteCompactionDetails | undefined;
	params.branchEntries.forEach((entry, index) => {
		if (entry.type !== "compaction") return;
		latestCompactionIndex = index;
		latestCompactionEntryId = entry.id;
		latestDetails = extractRemoteCompactionDetails(entry.details);
	});
	if (!latestDetails || latestCompactionIndex < 0) return undefined;

	const trailingMessages: ResponseItem[] = [];
	let pendingTurnItems: ResponseItem[] = [];
	for (const entry of params.branchEntries.slice(latestCompactionIndex + 1)) {
		if (entry.type !== "message" || !entry.message) continue;
		const items = messageToResponseItems(entry.message);
		if (items.length === 0) continue;
		if (entry.message.role === "assistant") {
			if (assistantMessageMatchesModelKey(entry.message, latestDetails.modelKey)) {
				trailingMessages.push(...pendingTurnItems, ...items);
			}
			pendingTurnItems = [];
			continue;
		}
		pendingTurnItems.push(...items);
	}
	return {
		compactionEntryId: latestCompactionEntryId,
		modelKey: latestDetails.modelKey,
		replacementHistory: latestDetails.replacementHistory,
		explicitHistory: [...latestDetails.replacementHistory, ...trailingMessages],
	};
}

export function getBranchMessages(branchEntries: BranchEntry[]): AgentMessage[] {
	return branchEntries.flatMap((entry) => (entry.type === "message" && entry.message ? [entry.message] : []));
}

export function getBranchThinkingLevel(branchEntries: BranchEntry[]): string | undefined {
	for (let index = branchEntries.length - 1; index >= 0; index--) {
		const entry = branchEntries[index];
		if (entry?.type === "thinking_level_change" && typeof entry.thinkingLevel === "string") {
			return entry.thinkingLevel;
		}
	}
	return undefined;
}
