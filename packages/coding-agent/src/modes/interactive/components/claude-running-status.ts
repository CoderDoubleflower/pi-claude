import { visibleWidth } from "@earendil-works/pi-tui";
import chalk from "chalk";
import { formatClaudeTurnDuration } from "./claude-working.ts";

const CLAUDE_ORANGE = "#d77757";
const CLAUDE_RUNNING_STATUS_MARKER = "\u001fpi-claude-running-status:";
const STATUS_SEPARATOR = " · ";
const THINKING_BARE_TEXT = "thinking";

export type ClaudeWorkingMode = "requesting" | "responding" | "thinking" | "tool-use";
export type ClaudeThinkingStatus = "thinking" | number | null;

export interface ClaudeRunningTodo {
	content: string;
	status: "pending" | "in_progress" | "completed";
	activeForm: string;
}

export interface ClaudeRunningStatusSnapshot {
	elapsedMs: number;
	responseCharacters: number;
	mode: ClaudeWorkingMode;
	thinkingStatus: ClaudeThinkingStatus;
	effortLevel?: string;
	todos?: ClaudeRunningTodo[];
	completionTimestamps?: [string, number][];
}

export interface DecodedClaudeRunningMessage {
	message: string | undefined;
	status: ClaudeRunningStatusSnapshot | undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function isWorkingMode(value: unknown): value is ClaudeWorkingMode {
	return value === "requesting" || value === "responding" || value === "thinking" || value === "tool-use";
}

function parseThinkingStatus(value: unknown): ClaudeThinkingStatus | undefined {
	if (value === null || value === "thinking") return value;
	if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value;
	return undefined;
}

function parseTodo(value: unknown): ClaudeRunningTodo | undefined {
	if (!isRecord(value)) return undefined;
	if (
		typeof value.content !== "string" ||
		typeof value.activeForm !== "string" ||
		(value.status !== "pending" && value.status !== "in_progress" && value.status !== "completed")
	) {
		return undefined;
	}
	return {
		content: value.content,
		status: value.status,
		activeForm: value.activeForm,
	};
}

function parseTodos(value: unknown): ClaudeRunningTodo[] | undefined {
	if (value === undefined) return undefined;
	if (!Array.isArray(value)) return undefined;
	const todos: ClaudeRunningTodo[] = [];
	for (const item of value) {
		const todo = parseTodo(item);
		if (!todo) return undefined;
		todos.push(todo);
	}
	return todos;
}

function parseCompletionTimestamps(value: unknown): [string, number][] | undefined {
	if (value === undefined) return undefined;
	if (!Array.isArray(value)) return undefined;
	const timestamps: [string, number][] = [];
	for (const entry of value) {
		if (
			!Array.isArray(entry) ||
			entry.length !== 2 ||
			typeof entry[0] !== "string" ||
			typeof entry[1] !== "number" ||
			!Number.isFinite(entry[1])
		) {
			return undefined;
		}
		timestamps.push([entry[0], entry[1]]);
	}
	return timestamps;
}

function parseSnapshot(value: unknown): ClaudeRunningStatusSnapshot | undefined {
	if (!isRecord(value)) return undefined;
	const elapsedMs = value.elapsedMs;
	const responseCharacters = value.responseCharacters;
	const mode = value.mode;
	const thinkingStatus = parseThinkingStatus(value.thinkingStatus);
	if (
		typeof elapsedMs !== "number" ||
		!Number.isFinite(elapsedMs) ||
		elapsedMs < 0 ||
		typeof responseCharacters !== "number" ||
		!Number.isFinite(responseCharacters) ||
		responseCharacters < 0 ||
		!isWorkingMode(mode) ||
		thinkingStatus === undefined
	) {
		return undefined;
	}
	return {
		elapsedMs,
		responseCharacters,
		mode,
		thinkingStatus,
		effortLevel:
			typeof value.effortLevel === "string" && value.effortLevel.length > 0 ? value.effortLevel : undefined,
		todos: parseTodos(value.todos),
		completionTimestamps: parseCompletionTimestamps(value.completionTimestamps),
	};
}

export function encodeClaudeRunningMessage(status: ClaudeRunningStatusSnapshot, message?: string): string {
	return `${message ?? ""}${CLAUDE_RUNNING_STATUS_MARKER}${JSON.stringify(status)}`;
}

export function decodeClaudeRunningMessage(message: string): DecodedClaudeRunningMessage {
	const markerIndex = message.lastIndexOf(CLAUDE_RUNNING_STATUS_MARKER);
	if (markerIndex === -1) return { message, status: undefined };
	const baseMessage = message.slice(0, markerIndex) || undefined;
	const payload = message.slice(markerIndex + CLAUDE_RUNNING_STATUS_MARKER.length);
	try {
		return { message: baseMessage, status: parseSnapshot(JSON.parse(payload)) };
	} catch {
		return { message: baseMessage, status: undefined };
	}
}

export function ensureClaudeWorkingEllipsis(message: string | undefined): string | undefined {
	if (!message) return undefined;
	if (message.endsWith("…")) return message;
	if (message.endsWith("...")) return `${message.slice(0, -3)}…`;
	return `${message}…`;
}

function formatTokenCount(count: number): string {
	if (count < 1000) return count.toString();
	if (count < 10_000) return `${(count / 1000).toFixed(1)}k`;
	if (count < 1_000_000) return `${Math.round(count / 1000)}k`;
	if (count < 10_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
	return `${Math.round(count / 1_000_000)}M`;
}

export function formatClaudeRunningMessage(
	message: string,
	status: ClaudeRunningStatusSnapshot | undefined,
	columns: number,
): string {
	if (!status) return message;

	const totalTokens = Math.round(status.responseCharacters / 4);
	const timerText = formatClaudeTurnDuration(status.elapsedMs);
	const tokensText = `${status.mode === "requesting" ? "↑" : "↓"} ${formatTokenCount(totalTokens)} tokens`;

	let thinkingText =
		status.thinkingStatus === "thinking"
			? `thinking${status.effortLevel ? ` with ${status.effortLevel} effort` : ""}`
			: typeof status.thinkingStatus === "number"
				? `thought for ${Math.max(1, Math.round(status.thinkingStatus / 1000))}s`
				: undefined;

	const availableSpace = columns - visibleWidth(message) - 5;
	const wantsThinking = thinkingText !== undefined;
	// pi-claude intentionally follows Claude Code's verbose branch: elapsed time
	// and the cumulative output-token estimate are eligible from the first frame.
	const wantsTimerAndTokens = true;

	let thinkingWidth = thinkingText ? visibleWidth(thinkingText) : 0;
	let showThinking = wantsThinking && availableSpace > thinkingWidth;
	if (!showThinking && status.thinkingStatus === "thinking" && status.effortLevel) {
		const bareWidth = visibleWidth(THINKING_BARE_TEXT);
		if (availableSpace > bareWidth) {
			thinkingText = THINKING_BARE_TEXT;
			thinkingWidth = bareWidth;
			showThinking = true;
		}
	}

	const separatorWidth = visibleWidth(STATUS_SEPARATOR);
	const usedAfterThinking = showThinking ? thinkingWidth + separatorWidth : 0;
	const timerWidth = visibleWidth(timerText);
	const showTimer = wantsTimerAndTokens && availableSpace > usedAfterThinking + timerWidth;
	const usedAfterTimer = usedAfterThinking + (showTimer ? timerWidth + separatorWidth : 0);
	const tokensWidth = visibleWidth(tokensText);
	const showTokens = wantsTimerAndTokens && totalTokens > 0 && availableSpace > usedAfterTimer + tokensWidth;

	const parts: string[] = [];
	if (showTimer) parts.push(timerText);
	if (showTokens) parts.push(tokensText);
	if (showThinking && thinkingText) parts.push(thinkingText);
	return parts.length > 0 ? `${message} (${parts.join(STATUS_SEPARATOR)})` : message;
}

export function colorClaudeRunningMessage(message: string): string {
	const statusIndex = message.lastIndexOf(" (");
	if (statusIndex === -1) return chalk.hex(CLAUDE_ORANGE)(message);
	return `${chalk.hex(CLAUDE_ORANGE)(message.slice(0, statusIndex))}${chalk.dim(message.slice(statusIndex))}`;
}
