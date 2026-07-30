import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { Api, Model } from "@earendil-works/pi-ai";
import { afterEach, describe, expect, it } from "vitest";
import { ModelConfig } from "../src/core/model-config.ts";
import {
	applyRemoteHistoryPayloadPatch,
	buildRemoteCompactionRequestBody,
	getRemoteCompactionConfig,
	reconstructRemoteCompactionStateFromBranch,
	supportsRemoteCompactionProtocol,
	type ResponseItem,
} from "../src/core/remote-compaction/index.ts";

const tempDirs: string[] = [];

afterEach(() => {
	for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function createModel(overrides: Partial<Model<Api>> = {}): Model<Api> {
	return {
		id: "gpt-test",
		name: "GPT Test",
		api: "openai-responses",
		provider: "test-openai",
		baseUrl: "https://example.com/v1",
		reasoning: true,
		input: ["text"],
		cost: { input: 1, output: 2, cacheRead: 0.1, cacheWrite: 0 },
		contextWindow: 128_000,
		maxTokens: 16_384,
		compat: {
			remoteCompaction: { enabled: true, model: "gpt-compact" },
		} as Model<Api>["compat"],
		...overrides,
	};
}

function userMessage(text: string): AgentMessage {
	return {
		role: "user",
		content: [{ type: "text", text }],
		timestamp: 1,
	} as AgentMessage;
}

function assistantMessage(text: string, provider = "test-openai", model = "gpt-test"): AgentMessage {
	return {
		role: "assistant",
		content: [{ type: "text", text }],
		provider,
		model,
		api: "openai-responses",
		usage: {
			input: 1,
			output: 1,
			cacheRead: 0,
			cacheWrite: 0,
			totalTokens: 2,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		},
		stopReason: "stop",
		timestamp: 2,
	} as AgentMessage;
}

describe("remote compaction", () => {
	it("loads the provider switch and compaction model from models.json", async () => {
		const dir = mkdtempSync(join(tmpdir(), "pi-remote-compaction-"));
		tempDirs.push(dir);
		const path = join(dir, "models.json");
		writeFileSync(
			path,
			JSON.stringify({
				providers: {
					proxy: {
						baseUrl: "https://example.com/v1",
						api: "openai-responses",
						remoteCompaction: { enabled: true, model: "gpt-compact" },
						models: [{ id: "gpt-test" }, { id: "gpt-compact" }],
					},
				},
			}),
		);

		const config = await ModelConfig.load(path);
		expect(config.getError()).toBeUndefined();
		expect(config.getProvider("proxy")?.remoteCompaction).toEqual({
			enabled: true,
			model: "gpt-compact",
		});
		const compat = config.getProvider("proxy")?.compat as Record<string, unknown>;
		expect(compat.remoteCompaction).toEqual({ enabled: true, model: "gpt-compact" });
	});

	it("resolves the projected provider configuration and validates the API", () => {
		expect(getRemoteCompactionConfig(createModel())).toEqual({ enabled: true, model: "gpt-compact" });
		expect(supportsRemoteCompactionProtocol(createModel())).toBe(true);
		expect(supportsRemoteCompactionProtocol(createModel({ api: "openai-completions" }))).toBe(false);
	});

	it("appends a compaction trigger without enabling server storage", () => {
		const input: ResponseItem[] = [
			{ type: "message", role: "user", content: [{ type: "input_text", text: "hello" }] },
		];
		const body = buildRemoteCompactionRequestBody({
			model: createModel(),
			input,
			tools: [],
			parallelToolCalls: true,
			sessionId: "session-1",
		});
		expect(body.store).toBe(false);
		expect(body.prompt_cache_key).toBe("session-1");
		expect(body.input).toEqual([...input, { type: "compaction_trigger" }]);
	});

	it("replaces normal request history with the persisted remote history", () => {
		const history: ResponseItem[] = [{ type: "compaction", encrypted_content: "opaque" }];
		const payload = applyRemoteHistoryPayloadPatch({
			payload: { model: "gpt-test", messages: [{ role: "user", content: "old" }], previous_response_id: "r1" },
			explicitHistory: history,
		});
		expect(payload.input).toEqual(history);
		expect(payload).not.toHaveProperty("messages");
		expect(payload).not.toHaveProperty("previous_response_id");
	});

	it("reconstructs matching-model turns after the latest compaction", () => {
		const replacementHistory: ResponseItem[] = [{ type: "compaction", encrypted_content: "opaque" }];
		const state = reconstructRemoteCompactionStateFromBranch({
			branchEntries: [
				{
					type: "compaction",
					id: "compact-1",
					details: {
						remoteCompaction: {
							version: 2,
							provider: "openai-responses-compaction",
							implementation: "responses_compaction_v2",
							modelKey: "test-openai:openai-responses:gpt-test",
							compactionModelKey: "test-openai:openai-responses:gpt-compact",
							replacementHistory,
						},
					},
				},
				{ type: "message", id: "user-1", message: userMessage("continue") },
				{ type: "message", id: "assistant-1", message: assistantMessage("done") },
				{ type: "message", id: "user-2", message: userMessage("wrong model") },
				{
					type: "message",
					id: "assistant-2",
					message: assistantMessage("ignored", "other", "other-model"),
				},
			],
		});
		expect(state?.compactionEntryId).toBe("compact-1");
		expect(state?.explicitHistory).toEqual([
			...replacementHistory,
			{ type: "message", role: "user", content: [{ type: "input_text", text: "continue" }] },
			{ type: "message", role: "assistant", content: [{ type: "output_text", text: "done" }] },
		]);
	});
});
