import { type Component, Loader, type TUI } from "@earendil-works/pi-tui";
import type { WorkingIndicatorOptions } from "../../../core/extensions/index.ts";
import { theme } from "../theme/theme.ts";
import { CLAUDE_WORKING_INDICATOR, colorClaudeWorkingText, createClaudeWorkingMessage } from "./claude-working.ts";
import { CountdownTimer } from "./countdown-timer.ts";
import { keyText } from "./keybinding-hints.ts";

const LEGACY_DEFAULT_WORKING_MESSAGE = "Working...";
const CLAUDE_COMPACTION_MESSAGE = "Compacting conversation…";

function resolveWorkingMessage(message: string | undefined, defaultMessage: string): string {
	if (message === undefined || message === LEGACY_DEFAULT_WORKING_MESSAGE) {
		return defaultMessage;
	}
	if (message.startsWith(`${LEGACY_DEFAULT_WORKING_MESSAGE} (`)) {
		return `${defaultMessage}${message.slice(LEGACY_DEFAULT_WORKING_MESSAGE.length)}`;
	}
	return message;
}

export type StatusIndicatorKind = "working" | "retry" | "compaction" | "branchSummary";

export class StatusIndicator extends Loader {
	readonly kind: StatusIndicatorKind;

	constructor(
		kind: StatusIndicatorKind,
		ui: TUI,
		spinnerColorFn: (str: string) => string,
		messageColorFn: (str: string) => string,
		message: string,
		indicator?: WorkingIndicatorOptions,
	) {
		super(ui, spinnerColorFn, messageColorFn, message, indicator);
		this.kind = kind;
	}

	override render(width: number): string[] {
		return super.render(width).map((line) => (line.startsWith(" ") ? `${line.slice(1)} ` : line));
	}

	dispose(): void {
		this.stop();
	}
}

export class WorkingStatusIndicator extends StatusIndicator {
	private readonly defaultMessage: string;

	constructor(ui: TUI, message?: string, indicator?: WorkingIndicatorOptions) {
		const defaultMessage = createClaudeWorkingMessage();
		super(
			"working",
			ui,
			colorClaudeWorkingText,
			colorClaudeWorkingText,
			resolveWorkingMessage(message, defaultMessage),
			indicator ?? CLAUDE_WORKING_INDICATOR,
		);
		this.defaultMessage = defaultMessage;
	}

	override setMessage(message: string): void {
		super.setMessage(resolveWorkingMessage(message, this.defaultMessage));
	}
}

export class RetryStatusIndicator extends StatusIndicator {
	private countdown: CountdownTimer | undefined;

	constructor(ui: TUI, attempt: number, maxAttempts: number, delayMs: number) {
		const retryMessage = (seconds: number) =>
			`Retrying (${attempt}/${maxAttempts}) in ${seconds}s... (${keyText("app.interrupt")} to cancel)`;
		super(
			"retry",
			ui,
			(spinner) => theme.fg("warning", spinner),
			(text) => theme.fg("muted", text),
			retryMessage(Math.ceil(delayMs / 1000)),
		);
		this.countdown = new CountdownTimer(
			delayMs,
			ui,
			(seconds) => {
				this.setMessage(retryMessage(seconds));
			},
			() => {
				this.countdown = undefined;
			},
		);
	}

	override dispose(): void {
		this.countdown?.dispose();
		this.countdown = undefined;
		super.dispose();
	}
}

export type CompactionStatusReason = "manual" | "threshold" | "overflow";

export class CompactionStatusIndicator extends StatusIndicator {
	constructor(ui: TUI, _reason: CompactionStatusReason) {
		super(
			"compaction",
			ui,
			colorClaudeWorkingText,
			colorClaudeWorkingText,
			CLAUDE_COMPACTION_MESSAGE,
			CLAUDE_WORKING_INDICATOR,
		);
	}
}

export class BranchSummaryStatusIndicator extends StatusIndicator {
	constructor(ui: TUI) {
		super(
			"branchSummary",
			ui,
			(spinner) => theme.fg("accent", spinner),
			(text) => theme.fg("muted", text),
			`Summarizing branch... (${keyText("app.interrupt")} to cancel)`,
		);
	}
}

export class IdleStatus implements Component {
	invalidate(): void {
		// No cached state to invalidate.
	}

	render(width: number): string[] {
		const emptyLine = " ".repeat(width);
		return [emptyLine, emptyLine];
	}
}
