import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { Api, Model, Usage } from "@earendil-works/pi-ai";

export const RETAINED_MESSAGE_TOKEN_BUDGET = 20_000;
export const IMAGE_CONTENT_OMITTED_PLACEHOLDER =
	"image content omitted because the model does not support image input";

export type JsonRecord = Record<string, unknown>;
export type AssistantPhase = "commentary" | "final_answer";
export type ToolResultOutputItem =
	| { type: "input_text"; text: string }
	| { type: "input_image"; image_url: string };

export type ContentPartLike = {
	type?: string;
	text?: string;
	data?: string;
	mimeType?: string;
	source?: unknown;
};

export type ResponseContentItem =
	| { type: "input_text"; text: string }
	| { type: "input_image"; image_url: string }
	| { type: "output_text"; text: string };

export type ResponseItem =
	| {
			type: "message";
			role: string;
			content: ResponseContentItem[];
			end_turn?: boolean;
			phase?: AssistantPhase;
	  }
	| {
			type: "reasoning";
			summary: Array<{ type: "summary_text"; text: string }>;
			content?: Array<{ type: "reasoning_text" | "text"; text: string }>;
			encrypted_content: string | null;
	  }
	| { type: "function_call"; name: string; arguments: string; call_id: string }
	| { type: "function_call_output"; call_id: string; output: string | ToolResultOutputItem[] }
	| { type: "compaction"; encrypted_content: string }
	| { type: "compaction_summary"; encrypted_content: string }
	| { type: "compaction_trigger" }
	| { type: string; [key: string]: unknown };

export type ResponsesReasoningConfig = {
	effort?: "none" | "minimal" | "low" | "medium" | "high" | "xhigh";
	summary?: "auto" | "concise" | "detailed" | null;
};

export type ResponsesTextConfig = Record<string, unknown>;

export type RemoteCompactionConfig = {
	enabled: boolean;
	model?: string;
};

export type RemoteCompactionDetails = {
	version: 2;
	provider: "openai-responses-compaction";
	implementation: "responses_compaction_v2";
	modelKey: string;
	compactionModelKey?: string;
	replacementHistory: ResponseItem[];
	usage?: Usage;
};

export type RemoteCompactionSessionState = {
	compactionEntryId: string;
	modelKey: string;
	replacementHistory: ResponseItem[];
	explicitHistory: ResponseItem[];
};

export type ResponsesRequestShapeState = {
	reasoning?: ResponsesReasoningConfig;
	text?: ResponsesTextConfig;
};

export type BranchEntry = {
	type: string;
	id: string;
	details?: unknown;
	message?: AgentMessage;
	thinkingLevel?: unknown;
	customType?: unknown;
	data?: unknown;
};

export type SessionContextLike = {
	sessionManager: {
		getSessionId(): string;
		getBranch(): BranchEntry[];
	};
};

export function isRecord(value: unknown): value is JsonRecord {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function cloneResponseItem(item: ResponseItem): ResponseItem {
	return structuredClone(item);
}

export function modelKey(model: Model<Api>): string {
	return `${model.provider}:${model.api}:${model.id}`;
}

export function getRemoteCompactionConfig(model: Model<Api> | undefined): RemoteCompactionConfig | undefined {
	if (!model || !isRecord(model.compat) || !isRecord(model.compat.remoteCompaction)) return undefined;
	const remoteCompaction = model.compat.remoteCompaction;
	if (typeof remoteCompaction.enabled !== "boolean") return undefined;
	const configuredModel =
		typeof remoteCompaction.model === "string" && remoteCompaction.model.trim()
			? remoteCompaction.model.trim()
			: undefined;
	return {
		enabled: remoteCompaction.enabled,
		...(configuredModel ? { model: configuredModel } : {}),
	};
}

export function supportsRemoteCompactionProtocol(model: Model<Api> | undefined): boolean {
	return model?.api === "openai-responses" || model?.api === "openai-codex-responses";
}

export function isCodexResponsesModel(model: Model<Api>): boolean {
	return model.api === "openai-codex-responses";
}
