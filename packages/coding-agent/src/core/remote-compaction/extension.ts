import type { AgentMessage, ThinkingLevel } from "@earendil-works/pi-agent-core";
import type { Api, Model } from "@earendil-works/pi-ai";
import { compact, type CompactionResult } from "../compaction/index.ts";
import type { ExtensionAPI } from "../extensions/index.ts";
import {
	buildRemoteCompactionDetails,
	buildToolsPayload,
	getBranchMessages,
	getBranchThinkingLevel,
	messageToResponseItems,
	messagesToResponseItems,
	normalizeResponseItemsForPrompt,
	reconstructRemoteCompactionStateFromBranch,
} from "./history.ts";
import {
	applyRemoteHistoryPayloadPatch,
	callRemoteCompactionEndpoint,
	extractResponsesReasoningConfig,
	extractResponsesTextConfig,
	looksLikeResponsesPayload,
	thinkingLevelToResponsesReasoning,
} from "./openai.ts";
import { stripImagesFromRemoteHistory } from "./sanitize.ts";
import {
	clearAllRemoteCompactionState,
	clearRemoteCompactionState,
	clearResponsesRequestShapeState,
	getRemoteCompactionState,
	getResponsesRequestShapeState,
	setRemoteCompactionState,
	setResponsesRequestShapeState,
} from "./state.ts";
import {
	getRemoteCompactionConfig,
	isRecord,
	modelKey,
	supportsRemoteCompactionProtocol,
	type BranchEntry,
	type RemoteCompactionSessionState,
	type SessionContextLike,
} from "./types.ts";

function getSessionId(ctx: SessionContextLike): string {
	return ctx.sessionManager.getSessionId();
}

function syncRemoteState(ctx: SessionContextLike): void {
	const sessionId = getSessionId(ctx);
	const state = reconstructRemoteCompactionStateFromBranch({
		branchEntries: ctx.sessionManager.getBranch(),
	});
	if (state) setRemoteCompactionState(sessionId, state);
	else clearRemoteCompactionState(sessionId);
}

function getMatchingRemoteState(
	sessionId: string,
	model: Model<Api> | undefined,
): RemoteCompactionSessionState | undefined {
	if (!model) return undefined;
	const state = getRemoteCompactionState(sessionId);
	return state?.modelKey === modelKey(model) ? state : undefined;
}

function extendRemoteHistoryIfCompatible(params: {
	sessionId: string;
	model: Model<Api> | undefined;
	message: AgentMessage;
}): void {
	const state = getMatchingRemoteState(params.sessionId, params.model);
	if (!state || !params.model) return;
	if (params.message.role === "assistant" && params.message.stopReason === "error") {
		clearRemoteCompactionState(params.sessionId);
		return;
	}
	if (
		params.message.role === "assistant" &&
		(params.message.provider !== params.model.provider || params.message.model !== params.model.id)
	) {
		return;
	}
	const items = messageToResponseItems(params.message);
	if (items.length === 0) return;
	setRemoteCompactionState(params.sessionId, {
		...state,
		explicitHistory: [...state.explicitHistory, ...items],
	});
}

function buildRemoteSummaryText(activeModel: Model<Api>, compactionModel: Model<Api>): string {
	const compactionSuffix =
		activeModel.id === compactionModel.id
			? ""
			: ` using ${compactionModel.provider}/${compactionModel.id} as the compaction model`;
	return `Remote compaction applied for ${activeModel.provider}/${activeModel.id}${compactionSuffix}. A provider-native artifact is stored in this session for compatible future turns.`;
}

function resolveCompactionModel(
	activeModel: Model<Api>,
	configuredModelId: string | undefined,
	findModel: (provider: string, modelId: string) => Model<Api> | undefined,
): Model<Api> | undefined {
	return configuredModelId ? findModel(activeModel.provider, configuredModelId) : activeModel;
}

export default function remoteCompactionExtension(pi: ExtensionAPI): void {
	pi.on("session_start", (_event, ctx) => {
		clearResponsesRequestShapeState(getSessionId(ctx));
		syncRemoteState(ctx);
	});

	const clearBeforeSessionChange = (_event: unknown, ctx: SessionContextLike): void => {
		const sessionId = getSessionId(ctx);
		clearRemoteCompactionState(sessionId);
		clearResponsesRequestShapeState(sessionId);
	};
	pi.on("session_before_switch", clearBeforeSessionChange);
	pi.on("session_before_fork", clearBeforeSessionChange);
	pi.on("session_before_tree", clearBeforeSessionChange);

	const syncAfterSessionChange = (_event: unknown, ctx: SessionContextLike): void => {
		clearResponsesRequestShapeState(getSessionId(ctx));
		syncRemoteState(ctx);
	};
	pi.on("session_tree", syncAfterSessionChange);
	pi.on("session_compact", syncAfterSessionChange);

	pi.on("model_select", (_event, ctx) => {
		clearResponsesRequestShapeState(getSessionId(ctx));
	});

	pi.on("session_shutdown", () => {
		clearAllRemoteCompactionState();
	});

	pi.on("session_before_compact", async (event, ctx) => {
		const activeModel = ctx.model;
		const config = getRemoteCompactionConfig(activeModel);
		if (!activeModel || !config?.enabled || !supportsRemoteCompactionProtocol(activeModel)) return undefined;

		const compactionModel = resolveCompactionModel(
			activeModel,
			config.model,
			(provider, modelId) => ctx.modelRegistry.find(provider, modelId),
		);
		if (!compactionModel) {
			if (ctx.hasUI) {
				ctx.ui.notify(
					`Remote compaction model ${activeModel.provider}/${config.model} was not found; using native compaction.`,
					"warning",
				);
			}
			return undefined;
		}
		if (!supportsRemoteCompactionProtocol(compactionModel)) {
			if (ctx.hasUI) {
				ctx.ui.notify(
					`Remote compaction model ${compactionModel.provider}/${compactionModel.id} does not use an OpenAI Responses API; using native compaction.`,
					"warning",
				);
			}
			return undefined;
		}

		const auth = await ctx.modelRegistry.getApiKeyAndHeaders(compactionModel);
		if (!auth.ok) {
			if (ctx.hasUI) ctx.ui.notify(`Remote compaction is unavailable: ${auth.error}`, "warning");
			return undefined;
		}

		const sessionId = getSessionId(ctx);
		const branchEntries = event.branchEntries as BranchEntry[];
		const fullBranchMessages = getBranchMessages(branchEntries);
		const existingState = getMatchingRemoteState(sessionId, activeModel);
		const input = normalizeResponseItemsForPrompt(
			existingState ? existingState.explicitHistory : messagesToResponseItems(fullBranchMessages),
			compactionModel,
		);
		const observedShape = getResponsesRequestShapeState(sessionId);
		const thinkingLevel = (pi.getThinkingLevel() ?? getBranchThinkingLevel(branchEntries)) as
			| ThinkingLevel
			| undefined;
		const reasoning =
			observedShape?.reasoning ??
			(compactionModel.reasoning ? thinkingLevelToResponsesReasoning(thinkingLevel) : undefined);
		const tools = buildToolsPayload(pi.getAllTools(), pi.getActiveTools());

		const [localResult, remoteResult] = await Promise.allSettled([
			compact(
				event.preparation,
				compactionModel,
				auth.apiKey,
				auth.headers,
				event.customInstructions,
				event.signal,
				thinkingLevel,
				undefined,
				auth.env,
			),
			callRemoteCompactionEndpoint({
				model: compactionModel,
				apiKey: auth.apiKey,
				headers: auth.headers,
				sessionId,
				input,
				instructions: ctx.getSystemPrompt(),
				tools,
				parallelToolCalls: true,
				reasoning,
				text: observedShape?.text,
				signal: event.signal,
			}),
		]);

		if (remoteResult.status !== "fulfilled") {
			if (localResult.status === "fulfilled") return { compaction: localResult.value };
			if (!event.signal.aborted && ctx.hasUI) {
				const message =
					remoteResult.reason instanceof Error ? remoteResult.reason.message : String(remoteResult.reason);
				ctx.ui.notify(`Remote compaction failed; using native compaction. ${message}`, "warning");
			}
			return undefined;
		}

		const remoteDetails = {
			...buildRemoteCompactionDetails(
				activeModel,
				stripImagesFromRemoteHistory(remoteResult.value.output),
				remoteResult.value.usage,
			),
			compactionModelKey: modelKey(compactionModel),
		};
		const localCompaction: CompactionResult =
			localResult.status === "fulfilled"
				? localResult.value
				: {
						summary: buildRemoteSummaryText(activeModel, compactionModel),
						firstKeptEntryId: event.preparation.firstKeptEntryId,
						tokensBefore: event.preparation.tokensBefore,
					};
		return {
			compaction: {
				summary: localCompaction.summary,
				firstKeptEntryId: localCompaction.firstKeptEntryId,
				tokensBefore: localCompaction.tokensBefore,
				estimatedTokensAfter: localCompaction.estimatedTokensAfter,
				usage: localCompaction.usage,
				details: {
					...(localCompaction.details !== undefined
						? { localSummaryDetails: localCompaction.details }
						: {}),
					remoteCompaction: remoteDetails,
				},
			},
		};
	});

	pi.on("message_end", (event, ctx) => {
		extendRemoteHistoryIfCompatible({
			sessionId: getSessionId(ctx),
			model: ctx.model,
			message: event.message,
		});
	});

	pi.on("before_provider_request", (event, ctx) => {
		const model = ctx.model;
		const config = getRemoteCompactionConfig(model);
		if (!model || !config?.enabled || !supportsRemoteCompactionProtocol(model)) return undefined;
		if (!isRecord(event.payload) || !looksLikeResponsesPayload(event.payload)) return undefined;

		const sessionId = getSessionId(ctx);
		setResponsesRequestShapeState(sessionId, {
			reasoning: extractResponsesReasoningConfig(event.payload),
			text: extractResponsesTextConfig(event.payload),
		});
		const state = getMatchingRemoteState(sessionId, model);
		if (!state) return undefined;
		return applyRemoteHistoryPayloadPatch({
			payload: event.payload,
			explicitHistory: normalizeResponseItemsForPrompt(state.explicitHistory, model),
		});
	});

	pi.on("after_provider_response", (event, ctx) => {
		if (event.status < 400) return;
		const sessionId = getSessionId(ctx);
		if (!getMatchingRemoteState(sessionId, ctx.model)) return;
		clearRemoteCompactionState(sessionId);
		if (ctx.hasUI) {
			ctx.ui.notify(
				"The provider rejected remote compaction history; retrying with the portable local summary.",
				"warning",
			);
		}
	});
}
