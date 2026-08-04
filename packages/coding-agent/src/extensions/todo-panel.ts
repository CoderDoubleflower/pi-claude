import type { AssistantMessage, AssistantMessageEvent } from "@earendil-works/pi-ai";
import { type Component, truncateToWidth } from "@earendil-works/pi-tui";
import type { ExtensionAPI, ExtensionContext } from "../core/extensions/types.ts";
import type { SessionEntry } from "../core/session-manager.ts";
import {
	getLatestTodoWriteTodos,
	parseTodoWriteDetails,
	TODO_WRITE_TOOL_NAME,
	type TodoItem,
} from "../core/tools/todo-write.ts";
import {
	type ClaudeThinkingStatus,
	type ClaudeWorkingMode,
	encodeClaudeRunningMessage,
	ensureClaudeWorkingEllipsis,
} from "../modes/interactive/components/claude-running-status.ts";
import type { Theme } from "../modes/interactive/theme/theme.ts";

export const TODO_PANEL_WIDGET_KEY = "native.todo-panel";
export const TODO_PANEL_HIDE_DELAY_MS = 5000;
export const TODO_PANEL_RECENT_COMPLETED_TTL_MS = 30_000;

const CLAUDE_STATUS_UPDATE_INTERVAL_MS = 50;
const CLAUDE_THINKING_MINIMUM_DISPLAY_MS = 2000;
const CLAUDE_THOUGHT_DURATION_DISPLAY_MS = 2000;

interface TodoFigures {
	tick: string;
	squareSmall: string;
	squareSmallFilled: string;
}

function isUnicodeSupported(): boolean {
	const { TERM, TERM_PROGRAM } = process.env;
	if (process.platform !== "win32") {
		return TERM !== "linux";
	}
	return (
		Boolean(process.env.WT_SESSION) ||
		Boolean(process.env.TERMINUS_SUBLIME) ||
		process.env.ConEmuTask === "{cmd::Cmder}" ||
		TERM_PROGRAM === "Terminus-Sublime" ||
		TERM_PROGRAM === "vscode" ||
		TERM === "xterm-256color" ||
		TERM === "alacritty" ||
		TERM === "rxvt-unicode" ||
		TERM === "rxvt-unicode-256color" ||
		process.env.TERMINAL_EMULATOR === "JetBrains-JediTerm"
	);
}

const TODO_FIGURES: TodoFigures = isUnicodeSupported()
	? { tick: "✔", squareSmall: "◻", squareSmallFilled: "◼" }
	: { tick: "√", squareSmall: "□", squareSmallFilled: "■" };

function cloneTodos(todos: readonly TodoItem[]): TodoItem[] {
	return todos.map((todo) => ({ ...todo }));
}

function todoIdentity(todo: TodoItem): string {
	return `${todo.content}\u0000${todo.activeForm}`;
}

function countStatus(todos: readonly TodoItem[], status: TodoItem["status"]): number {
	let count = 0;
	for (const todo of todos) {
		if (todo.status === status) count += 1;
	}
	return count;
}

function formatHiddenSummary(todos: readonly TodoItem[]): string {
	const parts: string[] = [];
	const inProgress = countStatus(todos, "in_progress");
	const pending = countStatus(todos, "pending");
	const completed = countStatus(todos, "completed");
	if (inProgress > 0) parts.push(`${inProgress} in progress`);
	if (pending > 0) parts.push(`${pending} pending`);
	if (completed > 0) parts.push(`${completed} completed`);
	return parts.length > 0 ? ` … +${parts.join(", ")}` : "";
}

function formatStandaloneSummary(todos: readonly TodoItem[], theme: Theme): string {
	const completed = countStatus(todos, "completed");
	const pending = countStatus(todos, "pending");
	const inProgress = todos.length - completed - pending;
	let summary = `${theme.bold(String(todos.length))} tasks (${theme.bold(String(completed))} done, `;
	if (inProgress > 0) {
		summary += `${theme.bold(String(inProgress))} in progress, `;
	}
	summary += `${theme.bold(String(pending))} open)`;
	return `  ${theme.fg("dim", summary)}`;
}

function formatTodoContent(todo: TodoItem, width: number, theme: Theme): string {
	const maxSubjectWidth = Math.max(15, width - 15);
	const subject = truncateToWidth(todo.content, maxSubjectWidth);
	if (todo.status === "completed") {
		return `${theme.fg("success", TODO_FIGURES.tick)} ${theme.fg("dim", theme.strikethrough(subject))}`;
	}
	if (todo.status === "in_progress") {
		return `${theme.fg("accent", TODO_FIGURES.squareSmallFilled)} ${theme.bold(subject)}`;
	}
	return `${TODO_FIGURES.squareSmall} ${subject}`;
}

function isAssistantMessage(message: unknown): message is AssistantMessage {
	return typeof message === "object" && message !== null && "role" in message && message.role === "assistant";
}

function estimateAssistantResponseCharacters(message: AssistantMessage | undefined): number {
	if (!message) return 0;
	let characters = 0;
	for (const content of message.content) {
		if (content.type === "text") {
			characters += content.text.length;
		} else if (content.type === "thinking") {
			characters += content.thinking.length;
		} else if (content.type === "toolCall") {
			characters += content.name.length;
			try {
				characters += JSON.stringify(content.arguments).length;
			} catch {
				// Tool arguments are expected to be serializable; ignore malformed custom values.
			}
		}
	}
	return characters;
}

function getAssistantEventMessage(event: AssistantMessageEvent): AssistantMessage | undefined {
	if ("partial" in event) return event.partial;
	if ("message" in event && isAssistantMessage(event.message)) return event.message;
	return undefined;
}

export class TodoPanelComponent implements Component {
	private readonly todos: TodoItem[];
	private readonly theme: Theme;
	private readonly getTerminalRows: () => number;
	private readonly standalone: boolean;
	private readonly completionTimestamps: ReadonlyMap<string, number>;

	constructor(
		todos: readonly TodoItem[],
		theme: Theme,
		getTerminalRows: () => number,
		standalone: boolean,
		completionTimestamps: ReadonlyMap<string, number> = new Map(),
	) {
		this.todos = cloneTodos(todos);
		this.theme = theme;
		this.getTerminalRows = getTerminalRows;
		this.standalone = standalone;
		this.completionTimestamps = new Map(completionTimestamps);
	}

	render(width: number): string[] {
		if (this.todos.length === 0 || width <= 0) return [];

		const rows = this.getTerminalRows();
		const maxDisplay = rows <= 10 ? 0 : Math.min(10, Math.max(3, rows - 14));
		let visibleTodos: TodoItem[];
		let hiddenTodos: TodoItem[];

		if (this.todos.length > maxDisplay) {
			const now = Date.now();
			const recentCompleted: TodoItem[] = [];
			const olderCompleted: TodoItem[] = [];
			const inProgress: TodoItem[] = [];
			const pending: TodoItem[] = [];

			for (const todo of this.todos) {
				if (todo.status === "in_progress") {
					inProgress.push(todo);
				} else if (todo.status === "pending") {
					pending.push(todo);
				} else {
					const completedAt = this.completionTimestamps.get(todoIdentity(todo));
					if (completedAt !== undefined && now - completedAt < TODO_PANEL_RECENT_COMPLETED_TTL_MS) {
						recentCompleted.push(todo);
					} else {
						olderCompleted.push(todo);
					}
				}
			}

			const prioritized = [...recentCompleted, ...inProgress, ...pending, ...olderCompleted];
			visibleTodos = prioritized.slice(0, maxDisplay);
			hiddenTodos = prioritized.slice(maxDisplay);
		} else {
			visibleTodos = this.todos;
			hiddenTodos = [];
		}

		const lines: string[] = [];
		if (this.standalone) {
			lines.push(truncateToWidth(formatStandaloneSummary(this.todos, this.theme), width));
		}
		for (const [index, todo] of visibleTodos.entries()) {
			const prefix = this.standalone ? "  " : index === 0 ? "  ⎿ " : "    ";
			lines.push(truncateToWidth(`${prefix}${formatTodoContent(todo, width, this.theme)}`, width));
		}
		if (maxDisplay > 0 && hiddenTodos.length > 0) {
			const prefix = this.standalone ? "  " : "    ";
			lines.push(truncateToWidth(`${prefix}${this.theme.fg("dim", formatHiddenSummary(hiddenTodos))}`, width));
		}
		return lines;
	}

	invalidate(): void {}
}

export class TodoPanelManager {
	private todos: TodoItem[] = [];
	private completionTimestamps = new Map<string, number>();
	private hideTimer: ReturnType<typeof setTimeout> | undefined;
	private recentCompletionTimer: ReturnType<typeof setTimeout> | undefined;
	private statusTimer: ReturnType<typeof setInterval> | undefined;
	private context: ExtensionContext | undefined;
	private activityStartedAt: number | undefined;
	private responseCharacters = 0;
	private displayedResponseCharacters = 0;
	private activityMode: ClaudeWorkingMode = "requesting";
	private thinkingStartedAt: number | undefined;
	private thinkingEndedAt: number | undefined;
	private thinkingDurationMs: number | undefined;

	restore(ctx: ExtensionContext, entries: readonly SessionEntry[]): void {
		this.stopStatusTimer();
		this.resetActivityState();
		this.applyTodos(ctx, getLatestTodoWriteTodos(entries) ?? [], false);
	}

	update(ctx: ExtensionContext, todos: readonly TodoItem[]): void {
		this.applyTodos(ctx, todos, true);
	}

	/** Compatibility path used by existing callers and tests. Runtime lifecycle uses startActivity/finishActivity. */
	renderForActivity(ctx: ExtensionContext): void {
		this.context = ctx;
		this.render();
		this.syncWorkingMessage();
	}

	startActivity(ctx: ExtensionContext): void {
		this.context = ctx;
		this.stopStatusTimer();
		this.resetActivityState();
		this.activityStartedAt = Date.now();
		this.render();
		this.syncWorkingMessage();
		if (ctx.mode !== "tui") return;
		this.statusTimer = setInterval(() => {
			this.advanceDisplayedResponseCharacters();
			this.syncWorkingMessage();
		}, CLAUDE_STATUS_UPDATE_INTERVAL_MS);
		this.statusTimer.unref?.();
	}

	finishActivity(ctx: ExtensionContext): void {
		this.context = ctx;
		this.stopStatusTimer();
		this.resetActivityState();
		this.render();
		if (ctx.mode === "tui") ctx.ui.setWorkingMessage();
	}

	startTurn(ctx: ExtensionContext): void {
		if (this.activityStartedAt === undefined) return;
		this.context = ctx;
		this.activityMode = "requesting";
		this.responseCharacters = 0;
		this.displayedResponseCharacters = 0;
		this.resetThinkingState();
		this.syncWorkingMessage();
	}

	startMessage(ctx: ExtensionContext, message: unknown): void {
		if (this.activityStartedAt === undefined || !isAssistantMessage(message)) return;
		this.context = ctx;
		this.activityMode = "responding";
		this.responseCharacters = estimateAssistantResponseCharacters(message);
		this.displayedResponseCharacters = 0;
		this.resetThinkingState();
		this.syncWorkingMessage();
	}

	updateMessage(ctx: ExtensionContext, event: AssistantMessageEvent): void {
		if (this.activityStartedAt === undefined) return;
		this.context = ctx;
		this.responseCharacters = estimateAssistantResponseCharacters(getAssistantEventMessage(event));
		const now = Date.now();
		switch (event.type) {
			case "thinking_start":
			case "thinking_delta":
				if (this.thinkingStartedAt === undefined || this.thinkingEndedAt !== undefined) {
					this.thinkingStartedAt = now;
					this.thinkingEndedAt = undefined;
					this.thinkingDurationMs = undefined;
				}
				this.activityMode = "thinking";
				break;
			case "thinking_end":
				this.endThinking(now);
				this.activityMode = "responding";
				break;
			case "text_start":
			case "text_delta":
			case "text_end":
				this.endThinking(now);
				this.activityMode = "responding";
				break;
			case "toolcall_start":
			case "toolcall_delta":
			case "toolcall_end":
				this.endThinking(now);
				this.activityMode = "tool-use";
				break;
			case "done":
				this.endThinking(now);
				this.activityMode = event.reason === "toolUse" ? "tool-use" : "responding";
				break;
			default:
				break;
		}
		this.advanceDisplayedResponseCharacters();
		this.syncWorkingMessage();
	}

	endMessage(ctx: ExtensionContext, message: unknown): void {
		if (this.activityStartedAt === undefined || !isAssistantMessage(message)) return;
		this.context = ctx;
		this.responseCharacters = estimateAssistantResponseCharacters(message);
		this.endThinking(Date.now());
		const lastContent = message.content.at(-1);
		this.activityMode = lastContent?.type === "toolCall" ? "tool-use" : "responding";
		this.syncWorkingMessage();
	}

	startToolExecution(ctx: ExtensionContext): void {
		if (this.activityStartedAt === undefined) return;
		this.context = ctx;
		this.activityMode = "tool-use";
		this.syncWorkingMessage();
	}

	endToolExecution(ctx: ExtensionContext): void {
		if (this.activityStartedAt === undefined) return;
		this.context = ctx;
		this.activityMode = "requesting";
		this.syncWorkingMessage();
	}

	dispose(ctx?: ExtensionContext): void {
		this.clearTodoTimers();
		this.stopStatusTimer();
		const activeContext = ctx ?? this.context;
		if (activeContext?.mode === "tui") {
			activeContext.ui.setWidget(TODO_PANEL_WIDGET_KEY, undefined, { placement: "aboveEditor" });
			activeContext.ui.setWorkingMessage();
		}
		this.context = undefined;
		this.todos = [];
		this.completionTimestamps.clear();
		this.resetActivityState();
	}

	private applyTodos(ctx: ExtensionContext, todos: readonly TodoItem[], trackTransitions: boolean): void {
		this.context = ctx;
		this.clearHideTimer();
		this.updateCompletionTimestamps(todos, trackTransitions);
		this.todos = cloneTodos(todos);

		if (this.todos.length === 0) {
			this.hide();
			return;
		}

		this.render();
		this.syncWorkingMessage();
		this.scheduleRecentCompletionRefresh();

		if (this.todos.every((todo) => todo.status === "completed")) {
			this.hideTimer = setTimeout(() => this.hide(), TODO_PANEL_HIDE_DELAY_MS);
			this.hideTimer.unref?.();
		}
	}

	private updateCompletionTimestamps(todos: readonly TodoItem[], trackTransitions: boolean): void {
		const previousStatuses = new Map(this.todos.map((todo) => [todoIdentity(todo), todo.status]));
		const currentIdentities = new Set<string>();
		const now = Date.now();

		for (const todo of todos) {
			const identity = todoIdentity(todo);
			currentIdentities.add(identity);
			if (todo.status !== "completed") {
				this.completionTimestamps.delete(identity);
				continue;
			}
			if (trackTransitions && previousStatuses.get(identity) !== "completed") {
				this.completionTimestamps.set(identity, now);
			}
		}

		for (const identity of this.completionTimestamps.keys()) {
			if (!currentIdentities.has(identity)) this.completionTimestamps.delete(identity);
		}
	}

	private syncWorkingMessage(): void {
		const ctx = this.context;
		if (!ctx || ctx.mode !== "tui") return;
		const current = this.todos.find((todo) => todo.status === "in_progress");
		if (this.activityStartedAt === undefined) {
			ctx.ui.setWorkingMessage(ctx.isIdle() ? undefined : current?.activeForm);
			return;
		}

		const now = Date.now();
		const thinkingStatus = this.getThinkingStatus(now);
		ctx.ui.setWorkingMessage(
			encodeClaudeRunningMessage(
				{
					elapsedMs: Math.max(0, now - this.activityStartedAt),
					responseCharacters: this.displayedResponseCharacters,
					mode: thinkingStatus === "thinking" ? "thinking" : this.activityMode,
					thinkingStatus,
					effortLevel: ctx.thinkingLevel,
					todos: cloneTodos(this.todos),
					completionTimestamps: [...this.completionTimestamps.entries()],
				},
				ensureClaudeWorkingEllipsis(current?.activeForm),
			),
		);
	}

	private advanceDisplayedResponseCharacters(): void {
		const gap = this.responseCharacters - this.displayedResponseCharacters;
		if (gap <= 0) return;
		let increment: number;
		if (gap < 70) {
			increment = 3;
		} else if (gap < 200) {
			increment = Math.max(8, Math.ceil(gap * 0.15));
		} else {
			increment = 50;
		}
		this.displayedResponseCharacters = Math.min(
			this.displayedResponseCharacters + increment,
			this.responseCharacters,
		);
	}

	private endThinking(now: number): void {
		if (this.thinkingStartedAt === undefined || this.thinkingEndedAt !== undefined) return;
		this.thinkingEndedAt = now;
		this.thinkingDurationMs = Math.max(0, now - this.thinkingStartedAt);
	}

	private getThinkingStatus(now: number): ClaudeThinkingStatus {
		if (this.thinkingStartedAt === undefined) return null;
		if (this.thinkingEndedAt === undefined) return "thinking";
		const durationDisplayStart = Math.max(
			this.thinkingEndedAt,
			this.thinkingStartedAt + CLAUDE_THINKING_MINIMUM_DISPLAY_MS,
		);
		if (now < durationDisplayStart) return "thinking";
		if (now < durationDisplayStart + CLAUDE_THOUGHT_DURATION_DISPLAY_MS) {
			return this.thinkingDurationMs ?? 0;
		}
		return null;
	}

	private resetThinkingState(): void {
		this.thinkingStartedAt = undefined;
		this.thinkingEndedAt = undefined;
		this.thinkingDurationMs = undefined;
	}

	private resetActivityState(): void {
		this.activityStartedAt = undefined;
		this.responseCharacters = 0;
		this.displayedResponseCharacters = 0;
		this.activityMode = "requesting";
		this.resetThinkingState();
	}

	private render(): void {
		const ctx = this.context;
		if (!ctx || ctx.mode !== "tui" || this.todos.length === 0) return;
		if (this.activityStartedAt !== undefined) {
			ctx.ui.setWidget(TODO_PANEL_WIDGET_KEY, undefined, { placement: "aboveEditor" });
			return;
		}
		const todos = cloneTodos(this.todos);
		const standalone = ctx.isIdle();
		const completionTimestamps = new Map(this.completionTimestamps);
		ctx.ui.setWidget(
			TODO_PANEL_WIDGET_KEY,
			(tui, theme) =>
				new TodoPanelComponent(todos, theme, () => tui.terminal.rows, standalone, completionTimestamps),
			{ placement: "aboveEditor" },
		);
	}

	private scheduleRecentCompletionRefresh(): void {
		if (this.recentCompletionTimer) clearTimeout(this.recentCompletionTimer);
		this.recentCompletionTimer = undefined;
		if (this.completionTimestamps.size === 0) return;

		const now = Date.now();
		let earliestExpiry = Number.POSITIVE_INFINITY;
		for (const timestamp of this.completionTimestamps.values()) {
			const expiry = timestamp + TODO_PANEL_RECENT_COMPLETED_TTL_MS;
			if (expiry > now && expiry < earliestExpiry) earliestExpiry = expiry;
		}
		if (!Number.isFinite(earliestExpiry)) return;

		this.recentCompletionTimer = setTimeout(() => {
			this.recentCompletionTimer = undefined;
			this.render();
		}, earliestExpiry - now);
		this.recentCompletionTimer.unref?.();
	}

	private hide(): void {
		this.clearTodoTimers();
		const ctx = this.context;
		if (ctx?.mode === "tui") {
			ctx.ui.setWidget(TODO_PANEL_WIDGET_KEY, undefined, { placement: "aboveEditor" });
		}
		this.todos = [];
		this.completionTimestamps.clear();
		this.syncWorkingMessage();
	}

	private clearHideTimer(): void {
		if (this.hideTimer) clearTimeout(this.hideTimer);
		this.hideTimer = undefined;
	}

	private clearTodoTimers(): void {
		this.clearHideTimer();
		if (this.recentCompletionTimer) clearTimeout(this.recentCompletionTimer);
		this.recentCompletionTimer = undefined;
	}

	private stopStatusTimer(): void {
		if (this.statusTimer) clearInterval(this.statusTimer);
		this.statusTimer = undefined;
	}
}

export default function todoPanelExtension(pi: ExtensionAPI): void {
	const panel = new TodoPanelManager();

	pi.on("session_start", (_event, ctx) => panel.restore(ctx, ctx.sessionManager.getBranch()));
	pi.on("session_tree", (_event, ctx) => panel.restore(ctx, ctx.sessionManager.getBranch()));
	pi.on("agent_start", (_event, ctx) => panel.startActivity(ctx));
	pi.on("agent_settled", (_event, ctx) => panel.finishActivity(ctx));
	pi.on("turn_start", (_event, ctx) => panel.startTurn(ctx));
	pi.on("message_start", (event, ctx) => panel.startMessage(ctx, event.message));
	pi.on("message_update", (event, ctx) => panel.updateMessage(ctx, event.assistantMessageEvent));
	pi.on("message_end", (event, ctx) => panel.endMessage(ctx, event.message));
	pi.on("tool_execution_start", (_event, ctx) => panel.startToolExecution(ctx));
	pi.on("tool_execution_end", (event, ctx) => {
		panel.endToolExecution(ctx);
		if (event.toolName !== TODO_WRITE_TOOL_NAME || event.isError) return;
		const result = event.result as { details?: unknown };
		const details = parseTodoWriteDetails(result.details);
		if (details) panel.update(ctx, details.newTodos);
	});
	pi.on("session_shutdown", (_event, ctx) => panel.dispose(ctx));
}
