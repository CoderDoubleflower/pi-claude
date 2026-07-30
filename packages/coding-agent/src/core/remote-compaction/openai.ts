import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { arch, homedir, platform, release } from "node:os";
import { dirname, join } from "node:path";
import { type Api, calculateCost, type Model, type Usage } from "@earendil-works/pi-ai";
import { buildRemoteCompactionHistory, isResponseItem } from "./history.ts";
import {
	isCodexResponsesModel,
	isRecord,
	type JsonRecord,
	type ResponseItem,
	type ResponsesReasoningConfig,
	type ResponsesTextConfig,
} from "./types.ts";

const REMOTE_COMPACTION_FEATURE = "remote_compaction_v2";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeBaseUrl(baseUrl: string | undefined, fallback: string): string {
	const trimmed = baseUrl?.trim();
	return (trimmed || fallback).replace(/\/+$/, "");
}

export function resolveRemoteCompactionEndpoint(model: Model<Api>): string {
	if (model.api === "openai-responses") {
		const baseUrl = normalizeBaseUrl(model.baseUrl, "https://api.openai.com/v1");
		if (baseUrl.endsWith("/responses")) return baseUrl;
		return baseUrl.endsWith("/v1") ? `${baseUrl}/responses` : `${baseUrl}/v1/responses`;
	}
	if (model.api === "openai-codex-responses") {
		const baseUrl = normalizeBaseUrl(model.baseUrl, "https://chatgpt.com/backend-api");
		if (baseUrl.endsWith("/codex/responses")) return baseUrl;
		if (baseUrl.endsWith("/codex")) return `${baseUrl}/responses`;
		return `${baseUrl}/codex/responses`;
	}
	throw new Error("Remote compaction requires an OpenAI Responses model.");
}

function resolveCodexHome(): string {
	return process.env.CODEX_HOME?.trim() || join(homedir(), ".codex");
}

function resolveCodexInstallationId(): string {
	const path = join(resolveCodexHome(), "installation_id");
	try {
		if (existsSync(path)) {
			const existing = readFileSync(path, "utf8").trim();
			if (UUID_RE.test(existing)) return existing.toLowerCase();
		}
	} catch {
		// Regenerate below.
	}

	const installationId = randomUUID();
	try {
		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(path, installationId);
	} catch {
		// Identity headers are a compatibility hint, not a reason to fail compaction.
	}
	return installationId;
}

function buildCodexIdentityHeaders(sessionId?: string): Record<string, string> {
	const installationId = resolveCodexInstallationId();
	if (!sessionId) return { "x-codex-installation-id": installationId };
	return {
		"x-codex-installation-id": installationId,
		"x-codex-window-id": `${sessionId}:0`,
		session_id: sessionId,
	};
}

function extractCodexAccountId(token: string): string {
	const parts = token.split(".");
	if (parts.length !== 3) throw new Error("Failed to extract the ChatGPT account id from the Codex token.");
	const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as unknown;
	if (!isRecord(payload)) throw new Error("Invalid Codex token payload.");
	const auth = isRecord(payload["https://api.openai.com/auth"]) ? payload["https://api.openai.com/auth"] : undefined;
	const accountId = auth?.chatgpt_account_id;
	if (typeof accountId !== "string" || !accountId) {
		throw new Error("Failed to extract the ChatGPT account id from the Codex token.");
	}
	return accountId;
}

function withRemoteCompactionFeature(headers: Record<string, string>): Record<string, string> {
	const configuredFeatures =
		Object.entries(headers)
			.find(([name]) => name.toLowerCase() === "x-codex-beta-features")?.[1]
			?.split(",")
			.map((feature) => feature.trim())
			.filter(Boolean) ?? [];
	const headersWithoutFeature = Object.fromEntries(
		Object.entries(headers).filter(([name]) => name.toLowerCase() !== "x-codex-beta-features"),
	);
	return {
		...headersWithoutFeature,
		"x-codex-beta-features": [...new Set([...configuredFeatures, REMOTE_COMPACTION_FEATURE])].join(","),
	};
}

function buildRemoteCompactionHeaders(params: {
	model: Model<Api>;
	apiKey?: string;
	headers?: Record<string, string>;
	sessionId?: string;
}): Record<string, string> {
	const commonHeaders = withRemoteCompactionFeature({
		...(params.apiKey ? { authorization: `Bearer ${params.apiKey}` } : {}),
		...(isCodexResponsesModel(params.model) ? buildCodexIdentityHeaders(params.sessionId) : {}),
		...(params.headers ?? {}),
		accept: "text/event-stream",
		"content-type": "application/json",
	});
	if (!isCodexResponsesModel(params.model)) return commonHeaders;
	if (!params.apiKey) throw new Error("OpenAI Codex remote compaction requires an OAuth token.");
	return {
		...commonHeaders,
		"chatgpt-account-id": extractCodexAccountId(params.apiKey),
		originator: "pi-claude",
		"user-agent": `pi-claude remote-compaction (${platform()} ${release()}; ${arch()})`,
		"OpenAI-Beta": "responses=experimental",
	};
}

export function buildRemoteCompactionRequestBody(params: {
	model: Model<Api>;
	input: ResponseItem[];
	instructions?: string;
	tools: Record<string, unknown>[];
	parallelToolCalls: boolean;
	reasoning?: ResponsesReasoningConfig;
	text?: ResponsesTextConfig;
	sessionId?: string;
}): Record<string, unknown> {
	return {
		model: params.model.id,
		input: [...params.input, { type: "compaction_trigger" }],
		instructions: params.instructions,
		tools: params.tools,
		parallel_tool_calls: params.parallelToolCalls,
		tool_choice: "auto",
		stream: true,
		store: false,
		include: ["reasoning.encrypted_content"],
		...(params.sessionId ? { prompt_cache_key: params.sessionId } : {}),
		...(params.reasoning ? { reasoning: params.reasoning } : {}),
		...(params.text ? { text: params.text } : {}),
	};
}

function parseSseData(text: string): unknown[] {
	return text
		.replace(/\r\n/g, "\n")
		.split("\n\n")
		.flatMap((block) => {
			const data = block
				.split("\n")
				.filter((line) => line.startsWith("data:"))
				.map((line) => line.slice(5).trimStart())
				.join("\n")
				.trim();
			if (!data || data === "[DONE]") return [];
			try {
				return [JSON.parse(data) as unknown];
			} catch {
				return [];
			}
		});
}

function parseRemoteCompactionEvents(events: unknown[]): { compactionItem: ResponseItem; usage?: unknown } {
	let completed = false;
	let usage: unknown;
	const compactionItems: ResponseItem[] = [];
	for (const event of events) {
		if (!isRecord(event)) continue;
		if (event.type === "error") {
			throw new Error(typeof event.message === "string" ? event.message : "Unknown Responses API error.");
		}
		if (event.type === "response.failed") {
			const response = isRecord(event.response) ? event.response : undefined;
			const error = response && isRecord(response.error) ? response.error : undefined;
			throw new Error(typeof error?.message === "string" ? error.message : "The compaction response failed.");
		}
		if (event.type === "response.output_item.done" && isResponseItem(event.item)) {
			if (event.item.type === "compaction") compactionItems.push(event.item);
			continue;
		}
		if (event.type === "response.completed") {
			completed = true;
			const response = isRecord(event.response) ? event.response : undefined;
			usage = response?.usage;
		}
	}
	if (!completed) throw new Error("The remote compaction stream ended before response.completed.");
	if (compactionItems.length !== 1) {
		throw new Error(`Expected exactly one remote compaction item, received ${compactionItems.length}.`);
	}
	return { compactionItem: compactionItems[0], usage };
}

function extractCacheWriteTokens(value: unknown): number {
	if (!isRecord(value)) return 0;
	if (typeof value.cache_creation_tokens === "number" && Number.isFinite(value.cache_creation_tokens)) {
		return value.cache_creation_tokens;
	}
	return typeof value.cache_write_tokens === "number" && Number.isFinite(value.cache_write_tokens)
		? value.cache_write_tokens
		: 0;
}

function extractRemoteCompactionUsage(model: Model<Api>, value: unknown): Usage | undefined {
	if (!isRecord(value)) return undefined;
	const inputTokens =
		typeof value.input_tokens === "number" && Number.isFinite(value.input_tokens) ? value.input_tokens : 0;
	const outputTokens =
		typeof value.output_tokens === "number" && Number.isFinite(value.output_tokens) ? value.output_tokens : 0;
	const totalTokens =
		typeof value.total_tokens === "number" && Number.isFinite(value.total_tokens)
			? value.total_tokens
			: inputTokens + outputTokens;
	const details = isRecord(value.input_tokens_details) ? value.input_tokens_details : undefined;
	const cachedTokens =
		typeof details?.cached_tokens === "number" && Number.isFinite(details.cached_tokens) ? details.cached_tokens : 0;
	const cacheWriteTokens = extractCacheWriteTokens(details);
	const usage: Usage = {
		input: Math.max(0, inputTokens - cachedTokens - cacheWriteTokens),
		output: outputTokens,
		cacheRead: cachedTokens,
		cacheWrite: cacheWriteTokens,
		totalTokens,
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
	};
	calculateCost(model, usage);
	return usage;
}

export async function callRemoteCompactionEndpoint(params: {
	model: Model<Api>;
	apiKey?: string;
	headers?: Record<string, string>;
	sessionId?: string;
	input: ResponseItem[];
	instructions?: string;
	tools: Record<string, unknown>[];
	parallelToolCalls: boolean;
	reasoning?: ResponsesReasoningConfig;
	text?: ResponsesTextConfig;
	signal?: AbortSignal;
}): Promise<{ output: ResponseItem[]; usage?: Usage }> {
	const response = await fetch(resolveRemoteCompactionEndpoint(params.model), {
		method: "POST",
		headers: buildRemoteCompactionHeaders(params),
		body: JSON.stringify(
			buildRemoteCompactionRequestBody({
				model: params.model,
				input: params.input,
				instructions: params.instructions,
				tools: params.tools,
				parallelToolCalls: params.parallelToolCalls,
				reasoning: params.reasoning,
				text: params.text,
				sessionId: params.sessionId,
			}),
		),
		signal: params.signal,
	});
	if (!response.ok) {
		const text = await response.text().catch(() => "");
		throw new Error(`Remote compaction failed (${response.status}): ${text || response.statusText}`);
	}
	const parsed = parseRemoteCompactionEvents(parseSseData(await response.text()));
	return {
		output: buildRemoteCompactionHistory(params.input, parsed.compactionItem),
		usage: extractRemoteCompactionUsage(params.model, parsed.usage),
	};
}

export function looksLikeResponsesPayload(payload: JsonRecord): boolean {
	return "input" in payload || "messages" in payload || "model" in payload;
}

export function extractResponsesReasoningConfig(payload: unknown): ResponsesReasoningConfig | undefined {
	if (!isRecord(payload) || !isRecord(payload.reasoning)) return undefined;
	const effort = payload.reasoning.effort;
	const summary = payload.reasoning.summary;
	const config: ResponsesReasoningConfig = {
		...(typeof effort === "string" ? { effort: effort as ResponsesReasoningConfig["effort"] } : {}),
		...(summary === null || typeof summary === "string"
			? { summary: summary as ResponsesReasoningConfig["summary"] }
			: {}),
	};
	return Object.keys(config).length > 0 ? config : undefined;
}

export function extractResponsesTextConfig(payload: unknown): ResponsesTextConfig | undefined {
	return isRecord(payload) && isRecord(payload.text) ? payload.text : undefined;
}

export function thinkingLevelToResponsesReasoning(thinkingLevel: unknown): ResponsesReasoningConfig | undefined {
	if (thinkingLevel === "minimal") return { effort: "minimal", summary: "auto" };
	if (thinkingLevel === "low") return { effort: "low", summary: "auto" };
	if (thinkingLevel === "medium") return { effort: "medium", summary: "auto" };
	if (thinkingLevel === "high") return { effort: "high", summary: "auto" };
	if (thinkingLevel === "xhigh") return { effort: "xhigh", summary: "auto" };
	return undefined;
}

export function applyRemoteHistoryPayloadPatch(params: {
	payload: JsonRecord;
	explicitHistory: ResponseItem[];
}): JsonRecord {
	const nextPayload: JsonRecord = { ...params.payload, input: params.explicitHistory };
	delete nextPayload.messages;
	delete nextPayload.previous_response_id;
	return nextPayload;
}
