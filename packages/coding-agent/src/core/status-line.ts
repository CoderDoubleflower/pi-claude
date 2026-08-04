import { spawn } from "node:child_process";
import type { Usage } from "@earendil-works/pi-ai/compat";
import { VERSION } from "../config.ts";
import type { AgentSession } from "./agent-session.ts";
import type { ContextUsage } from "./extensions/types.ts";
import type { ReadonlyFooterDataProvider } from "./footer-data-provider.ts";
import type { StatusLineSettings } from "./settings-manager.ts";
import type { UsageTotals } from "./usage-totals.ts";

const STATUS_LINE_DEBOUNCE_MS = 300;
const STATUS_LINE_TIMEOUT_MS = 5000;
const STATUS_LINE_MAX_OUTPUT_BYTES = 64 * 1024;
const STATUS_LINE_MAX_LINES = 20;

export interface StatusLineCommandInput {
	cwd: string;
	session_id: string;
	transcript_path: string;
	session_name?: string;
	model: {
		id: string;
		display_name: string;
	};
	workspace: {
		current_dir: string;
		project_dir: string;
		added_dirs: string[];
	};
	version: string;
	output_style: {
		name: string;
	};
	cost: {
		total_cost_usd: number;
		total_duration_ms: number;
		total_api_duration_ms: number;
		total_lines_added: number;
		total_lines_removed: number;
	};
	context_window: {
		total_input_tokens: number;
		total_output_tokens: number;
		context_window_size: number;
		current_usage: {
			input_tokens: number;
			output_tokens: number;
			cache_creation_input_tokens: number;
			cache_read_input_tokens: number;
		} | null;
		used_percentage: number | null;
		remaining_percentage: number | null;
	};
	exceeds_200k_tokens: boolean;
	effort: {
		level: string | null;
	};
	thinking: {
		enabled: boolean;
	};
	pi: {
		git_branch: string | null;
		extension_statuses: Record<string, string>;
	};
}

export interface BuildStatusLineCommandInputOptions {
	session: AgentSession;
	footerData: ReadonlyFooterDataProvider;
	usageTotals: UsageTotals;
	latestUsage: Usage | undefined;
	contextUsage: ContextUsage | undefined;
	totalDurationMs: number;
}

export function buildStatusLineCommandInput({
	session,
	footerData,
	usageTotals,
	latestUsage,
	contextUsage,
	totalDurationMs,
}: BuildStatusLineCommandInputOptions): StatusLineCommandInput {
	const state = session.state;
	const cwd = session.sessionManager.getCwd();
	const modelId = state.model?.id ?? "no-model";
	const modelDisplayName = state.model?.name ?? modelId;
	const contextWindowSize = contextUsage?.contextWindow ?? state.model?.contextWindow ?? 0;
	const usedPercentage = contextUsage?.percent ?? null;
	const sessionName = session.sessionManager.getSessionName();
	const thinkingLevel = state.thinkingLevel ?? "off";

	return {
		cwd,
		session_id: session.sessionManager.getSessionId(),
		transcript_path: session.sessionManager.getSessionFile() ?? "",
		...(sessionName && { session_name: sessionName }),
		model: {
			id: modelId,
			display_name: modelDisplayName,
		},
		workspace: {
			current_dir: cwd,
			project_dir: cwd,
			added_dirs: [],
		},
		version: VERSION,
		output_style: {
			name: "default",
		},
		cost: {
			total_cost_usd: usageTotals.cost,
			total_duration_ms: Math.max(0, Math.floor(totalDurationMs)),
			total_api_duration_ms: 0,
			total_lines_added: 0,
			total_lines_removed: 0,
		},
		context_window: {
			total_input_tokens: usageTotals.input + usageTotals.cacheRead + usageTotals.cacheWrite,
			total_output_tokens: usageTotals.output,
			context_window_size: contextWindowSize,
			current_usage: latestUsage
				? {
						input_tokens: latestUsage.input,
						output_tokens: latestUsage.output,
						cache_creation_input_tokens: latestUsage.cacheWrite,
						cache_read_input_tokens: latestUsage.cacheRead,
					}
				: null,
			used_percentage: usedPercentage,
			remaining_percentage: usedPercentage === null ? null : Math.max(0, 100 - usedPercentage),
		},
		exceeds_200k_tokens: (contextUsage?.tokens ?? 0) > 200_000,
		effort: {
			level: thinkingLevel,
		},
		thinking: {
			enabled: thinkingLevel !== "off",
		},
		pi: {
			git_branch: footerData.getGitBranch(),
			extension_statuses: Object.fromEntries(footerData.getExtensionStatuses()),
		},
	};
}

export function normalizeStatusLineOutput(output: string): string[] {
	const normalized = output.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n+$/g, "");
	if (normalized.length === 0) return [""];
	return normalized.split("\n").slice(0, STATUS_LINE_MAX_LINES);
}

export interface StatusLineRequest {
	input: StatusLineCommandInput;
	cwd: string;
	columns: number;
}

export interface StatusLineRenderState {
	lines: string[];
	padding: number;
}

interface PendingStatusLineRequest extends StatusLineRequest {
	settings: StatusLineSettings;
	signature: string;
}

function arraysEqual(left: readonly string[], right: readonly string[]): boolean {
	return left.length === right.length && left.every((value, index) => value === right[index]);
}

export class StatusLineCommandRunner {
	private outputLines: string[] = [""];
	private configSignature: string | undefined;
	private scheduledSignature: string | undefined;
	private latestRequest: PendingStatusLineRequest | undefined;
	private debounceTimer: ReturnType<typeof setTimeout> | undefined;
	private refreshTimer: ReturnType<typeof setInterval> | undefined;
	private activeAbortController: AbortController | undefined;
	private executionGeneration = 0;
	private disposed = false;

	constructor(private readonly requestRender: () => void = () => {}) {}

	update(settings: undefined): undefined;
	update(settings: StatusLineSettings, request: StatusLineRequest): StatusLineRenderState;
	update(settings: StatusLineSettings | undefined, request?: StatusLineRequest): StatusLineRenderState | undefined {
		if (!settings) {
			this.disable();
			return undefined;
		}
		if (!request) {
			throw new Error("Status line request data is required when statusLine is enabled");
		}

		const configSignature = JSON.stringify(settings);
		if (configSignature !== this.configSignature) {
			this.configSignature = configSignature;
			this.outputLines = [""];
			this.scheduledSignature = undefined;
			this.configureRefresh(settings.refreshInterval);
		}

		const signature = JSON.stringify([configSignature, request.columns, request.input]);
		this.latestRequest = { settings, ...request, signature };
		if (signature !== this.scheduledSignature) {
			this.scheduledSignature = signature;
			this.scheduleExecution();
		}

		return {
			lines: [...this.outputLines],
			padding: settings.padding ?? 0,
		};
	}

	invalidate(): void {
		if (!this.latestRequest) return;
		this.scheduleExecution();
	}

	dispose(): void {
		this.disposed = true;
		this.executionGeneration += 1;
		this.activeAbortController?.abort();
		this.activeAbortController = undefined;
		if (this.debounceTimer) clearTimeout(this.debounceTimer);
		if (this.refreshTimer) clearInterval(this.refreshTimer);
		this.debounceTimer = undefined;
		this.refreshTimer = undefined;
	}

	private disable(): void {
		if (this.configSignature === undefined && !this.latestRequest) return;
		this.executionGeneration += 1;
		this.activeAbortController?.abort();
		this.activeAbortController = undefined;
		if (this.debounceTimer) clearTimeout(this.debounceTimer);
		if (this.refreshTimer) clearInterval(this.refreshTimer);
		this.debounceTimer = undefined;
		this.refreshTimer = undefined;
		this.configSignature = undefined;
		this.scheduledSignature = undefined;
		this.latestRequest = undefined;
		this.outputLines = [""];
	}

	private configureRefresh(refreshInterval: number | undefined): void {
		if (this.refreshTimer) clearInterval(this.refreshTimer);
		this.refreshTimer = undefined;
		if (refreshInterval === undefined) return;
		this.refreshTimer = setInterval(() => this.scheduleExecution(), refreshInterval * 1000);
		this.refreshTimer.unref?.();
	}

	private scheduleExecution(): void {
		if (this.disposed || !this.latestRequest) return;
		if (this.debounceTimer) clearTimeout(this.debounceTimer);
		this.debounceTimer = setTimeout(() => {
			this.debounceTimer = undefined;
			this.executeLatest();
		}, STATUS_LINE_DEBOUNCE_MS);
		this.debounceTimer.unref?.();
	}

	private executeLatest(): void {
		const request = this.latestRequest;
		if (this.disposed || !request) return;

		this.activeAbortController?.abort();
		const controller = new AbortController();
		this.activeAbortController = controller;
		const generation = ++this.executionGeneration;
		let stdout = "";
		let outputBytes = 0;
		let settled = false;

		const finish = (lines?: string[]) => {
			if (settled) return;
			settled = true;
			if (generation !== this.executionGeneration || controller.signal.aborted || this.disposed) return;
			if (this.activeAbortController === controller) this.activeAbortController = undefined;
			if (!lines || arraysEqual(lines, this.outputLines)) return;
			this.outputLines = lines;
			this.requestRender();
		};

		let child: ReturnType<typeof spawn>;
		try {
			child = spawn(request.settings.command, {
				cwd: request.cwd,
				env: {
					...process.env,
					COLUMNS: String(Math.max(1, Math.floor(request.columns))),
					LINES: String(process.stdout.rows ?? 0),
				},
				shell: true,
				signal: controller.signal,
				stdio: ["pipe", "pipe", "ignore"],
				windowsHide: true,
			});
		} catch {
			finish();
			return;
		}

		const timeout = setTimeout(() => controller.abort(), STATUS_LINE_TIMEOUT_MS);
		timeout.unref?.();
		child.stdout?.setEncoding("utf8");
		child.stdout?.on("data", (chunk: string) => {
			outputBytes += Buffer.byteLength(chunk);
			if (outputBytes > STATUS_LINE_MAX_OUTPUT_BYTES) {
				controller.abort();
				return;
			}
			stdout += chunk;
		});
		child.stdin?.on("error", () => {});
		child.once("error", () => {
			clearTimeout(timeout);
			finish();
		});
		child.once("close", (code) => {
			clearTimeout(timeout);
			finish(code === 0 ? normalizeStatusLineOutput(stdout) : undefined);
		});
		child.stdin?.end(JSON.stringify(request.input));
	}
}
