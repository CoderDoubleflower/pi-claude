import type { AssistantMessage } from "@earendil-works/pi-ai/compat";
import type { TUI } from "@earendil-works/pi-tui";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { AgentSessionEvent } from "../src/core/agent-session.ts";
import { createCompactionSummaryMessage } from "../src/core/messages.ts";
import type { CustomEntry } from "../src/core/session-manager.ts";
import {
	CLAUDE_TURN_DURATION_ENTRY_TYPE,
	ClaudeTurnDurationMessageComponent,
	getClaudeTurnDurationMs,
} from "../src/modes/interactive/components/claude-turn-duration.ts";
import {
	CLAUDE_TURN_DURATION_THRESHOLD_MS,
	formatClaudeTurnDuration,
	shouldShowClaudeTurnDuration,
} from "../src/modes/interactive/components/claude-working.ts";
import { CompactionSummaryMessageComponent } from "../src/modes/interactive/components/compaction-summary-message.ts";
import {
	CompactionStatusIndicator,
	WorkingStatusIndicator,
} from "../src/modes/interactive/components/status-indicator.ts";
import { InteractiveMode } from "../src/modes/interactive/interactive-mode.ts";
import { getEditorTheme, initTheme, theme } from "../src/modes/interactive/theme/theme.ts";
import { stripAnsi } from "../src/utils/ansi.ts";

type BorderColor = (text: string) => string;
type EditorBorderHost = {
	isBashMode: boolean;
	editor: { borderColor: BorderColor };
	ui: { requestRender(): void };
};

function createTui(): TUI {
	return { requestRender() {} } as unknown as TUI;
}

function applyEditorBorderColor(host: EditorBorderHost): void {
	const updateEditorBorderColor = (
		InteractiveMode.prototype as unknown as {
			updateEditorBorderColor(this: EditorBorderHost): void;
		}
	).updateEditorBorderColor;
	updateEditorBorderColor.call(host);
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe("Claude status display", () => {
	test("aligns the working glyph with tool markers in column zero", () => {
		initTheme("dark");
		const indicator = new WorkingStatusIndicator(createTui(), "Testing…", { frames: ["✻"] });
		const line = indicator
			.render(40)
			.map(stripAnsi)
			.find((entry) => entry.trim().length > 0);
		indicator.dispose();

		expect(line?.trimEnd()).toBe("✻ Testing…");
		expect(line?.indexOf("✻")).toBe(0);
	});

	test("renders the turn duration as a dim transcript row", () => {
		vi.spyOn(Math, "random").mockReturnValue(0);
		const component = new ClaudeTurnDurationMessageComponent(66_000);
		const rendered = component.render(40);
		const line = rendered.map(stripAnsi).find((entry) => entry.trim().length > 0);

		expect(rendered[0]).toBe("");
		expect(rendered.join("")).toContain("\u001b[2m");
		expect(line?.trimEnd()).toBe("✻ Baked for 1m 6s");
		expect(line?.indexOf("✻")).toBe(0);
	});

	test("indents wrapped duration text beneath the message column", () => {
		vi.spyOn(Math, "random").mockReturnValue(0);
		const lines = new ClaudeTurnDurationMessageComponent(66_000)
			.render(12)
			.map(stripAnsi)
			.filter((line) => line.trim().length > 0);

		expect(lines[0]?.startsWith("✻ ")).toBe(true);
		expect(lines[1]?.startsWith("  ")).toBe(true);
	});

	test("matches Claude Code duration formatting", () => {
		expect(formatClaudeTurnDuration(0)).toBe("0s");
		expect(formatClaudeTurnDuration(500)).toBe("0s");
		expect(formatClaudeTurnDuration(59_999)).toBe("59s");
		expect(formatClaudeTurnDuration(60_000)).toBe("1m 0s");
		expect(formatClaudeTurnDuration(66_000)).toBe("1m 6s");
		expect(formatClaudeTurnDuration(3_600_000)).toBe("1h 0m 0s");
		expect(formatClaudeTurnDuration(93_784_000)).toBe("1d 2h 3m");
	});

	test("only shows duration rows after 30 seconds for completed turns", () => {
		expect(CLAUDE_TURN_DURATION_THRESHOLD_MS).toBe(30_000);
		expect(shouldShowClaudeTurnDuration({ durationMs: 30_000, aborted: false, willRetry: false })).toBe(false);
		expect(shouldShowClaudeTurnDuration({ durationMs: 30_001, aborted: false, willRetry: false })).toBe(true);
		expect(shouldShowClaudeTurnDuration({ durationMs: 60_000, aborted: true, willRetry: false })).toBe(false);
		expect(shouldShowClaudeTurnDuration({ durationMs: 60_000, aborted: false, willRetry: true })).toBe(false);
	});

	test("validates persisted turn duration entries", () => {
		const entry: CustomEntry = {
			type: "custom",
			customType: CLAUDE_TURN_DURATION_ENTRY_TYPE,
			data: { durationMs: 66_000 },
			id: "duration",
			parentId: null,
			timestamp: new Date(0).toISOString(),
		};

		expect(getClaudeTurnDurationMs(entry)).toBe(66_000);
		expect(getClaudeTurnDurationMs({ ...entry, data: { durationMs: -1 } })).toBeUndefined();
	});

	test("matches Claude Code's active compaction spinner", () => {
		initTheme("dark");
		const indicator = new CompactionStatusIndicator(createTui(), "threshold");
		const line = indicator
			.render(60)
			.map(stripAnsi)
			.find((entry) => entry.trim().length > 0);
		indicator.dispose();

		expect(indicator.kind).toBe("compaction");
		expect(line?.trimEnd().endsWith("Compacting conversation…")).toBe(true);
		expect(line?.startsWith(" ")).toBe(false);
	});

	test("matches Claude Code's compact summary transcript row", () => {
		initTheme("dark");
		const message = createCompactionSummaryMessage("Retained summary", 120_000, new Date(0).toISOString());
		const component = new CompactionSummaryMessageComponent(message);
		const collapsed = component.render(80).map(stripAnsi);

		expect(collapsed[0]).toBe("");
		expect(collapsed[1]?.startsWith("● Compact summary (")).toBe(true);
		expect(collapsed[1]?.trimEnd().endsWith(" to expand)")).toBe(true);
		expect(collapsed.join(" ")).not.toContain("[compaction]");
		expect(collapsed.join(" ")).not.toContain("120,000");

		component.setExpanded(true);
		const expanded = component.render(80).map(stripAnsi);
		expect(expanded[1]?.trimEnd()).toBe("● Compact summary");
		expect(expanded[2]?.trimEnd()).toBe("  ⎿  Retained summary");
	});
});

describe("Interactive task lifecycle", () => {
	test("finalizes duration and terminal progress only when the outer task settles", async () => {
		vi.spyOn(Date, "now").mockReturnValue(40_001);
		const progress: boolean[] = [];
		const clearedKinds: Array<string | undefined> = [];
		const renderedEntries: CustomEntry[] = [];
		const persistedEntry: CustomEntry = {
			type: "custom",
			customType: CLAUDE_TURN_DURATION_ENTRY_TYPE,
			data: { durationMs: 40_001 },
			id: "duration",
			parentId: null,
			timestamp: new Date(0).toISOString(),
		};
		const assistantMessage = {
			role: "assistant",
			content: [],
			api: "anthropic-messages",
			provider: "anthropic",
			model: "claude",
			usage: {
				input: 1,
				output: 1,
				cacheRead: 0,
				cacheWrite: 0,
				totalTokens: 2,
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
			},
			stopReason: "stop",
			timestamp: 1,
		} as unknown as AssistantMessage;

		type LifecycleHost = {
			isInitialized: boolean;
			footer: { invalidate(): void };
			settingsManager: { getShowTerminalProgress(): boolean };
			ui: { terminal: { setProgress(active: boolean): void }; requestRender(): void };
			agentStartedAt: number | undefined;
			lastAgentEndAssistantMessage: AssistantMessage | undefined;
			streamingComponent: undefined;
			streamingMessage: undefined;
			pendingTools: Map<string, never>;
			resetToolActivityState(): void;
			clearStatusIndicator(kind?: string): void;
			sessionManager: {
				appendCustomEntry(customType: string, data: unknown): string;
				getEntry(id: string): CustomEntry | undefined;
			};
			addCustomEntryToChat(entry: CustomEntry): void;
			checkShutdownRequested(): Promise<void>;
		};

		const host: LifecycleHost = {
			isInitialized: true,
			footer: { invalidate() {} },
			settingsManager: { getShowTerminalProgress: () => true },
			ui: {
				terminal: { setProgress: (active) => progress.push(active) },
				requestRender() {},
			},
			agentStartedAt: 0,
			lastAgentEndAssistantMessage: undefined,
			streamingComponent: undefined,
			streamingMessage: undefined,
			pendingTools: new Map<string, never>(),
			resetToolActivityState() {},
			clearStatusIndicator: (kind) => clearedKinds.push(kind),
			sessionManager: {
				appendCustomEntry: () => "duration",
				getEntry: () => persistedEntry,
			},
			addCustomEntryToChat: (entry) => renderedEntries.push(entry),
			async checkShutdownRequested() {},
		};
		const handleEvent = (
			InteractiveMode.prototype as unknown as {
				handleEvent(this: LifecycleHost, event: AgentSessionEvent): Promise<void>;
			}
		).handleEvent;

		await handleEvent.call(host, { type: "agent_end", messages: [assistantMessage], willRetry: false });
		expect(progress).toEqual([]);
		expect(clearedKinds).toEqual([]);
		expect(host.agentStartedAt).toBe(0);
		expect(host.lastAgentEndAssistantMessage).toBe(assistantMessage);

		await handleEvent.call(host, { type: "agent_settled" });
		expect(progress).toEqual([false]);
		expect(clearedKinds).toEqual([undefined]);
		expect(host.agentStartedAt).toBeUndefined();
		expect(host.lastAgentEndAssistantMessage).toBeUndefined();
		expect(renderedEntries).toEqual([persistedEntry]);
	});
});

describe("Interactive editor border color", () => {
	test("uses the active theme border instead of the thinking level", () => {
		initTheme("dark");
		let renderRequests = 0;
		const host: EditorBorderHost = {
			isBashMode: false,
			editor: { borderColor: (text) => theme.fg("thinkingHigh", text) },
			ui: {
				requestRender() {
					renderRequests++;
				},
			},
		};

		applyEditorBorderColor(host);

		expect(host.editor.borderColor("─")).toBe(getEditorTheme().borderColor("─"));
		expect(host.editor.borderColor("─")).toBe(theme.fg("borderMuted", "─"));
		expect(renderRequests).toBe(1);
	});

	test("preserves the dedicated bash-mode border", () => {
		initTheme("dark");
		const host: EditorBorderHost = {
			isBashMode: true,
			editor: { borderColor: getEditorTheme().borderColor },
			ui: { requestRender() {} },
		};

		applyEditorBorderColor(host);

		expect(host.editor.borderColor("─")).toBe(theme.getBashModeBorderColor()("─"));
	});
});
