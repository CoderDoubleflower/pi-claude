import { type Component, type MarkdownTheme, Text, visibleWidth } from "@earendil-works/pi-tui";
import type { CompactionSummaryMessage } from "../../../core/messages.ts";
import { theme } from "../theme/theme.ts";
import { keyText } from "./keybinding-hints.ts";
import { MessageMarkerComponent } from "./message-marker.ts";

const COMPACT_SUMMARY_MARKER = "●";
const MESSAGE_RESPONSE_PREFIX = "  ⎿  ";

/** Render Claude Code's compact-summary transcript row. */
export class CompactionSummaryMessageComponent implements Component {
	private expanded = false;
	private readonly message: CompactionSummaryMessage;

	constructor(message: CompactionSummaryMessage, _markdownTheme?: MarkdownTheme) {
		this.message = message;
	}

	setExpanded(expanded: boolean): void {
		this.expanded = expanded;
	}

	render(width: number): string[] {
		const hint = this.expanded ? "" : theme.fg("dim", ` (${keyText("app.tools.expand")} to expand)`);
		const heading = new MessageMarkerComponent(
			new Text(theme.bold(theme.fg("text", "Compact summary")) + hint, 0, 0),
			theme.fg("text", COMPACT_SUMMARY_MARKER),
		);
		const lines = ["", ...heading.render(width)];
		if (!this.expanded) return lines;

		const prefix = theme.fg("dim", MESSAGE_RESPONSE_PREFIX);
		const prefixWidth = visibleWidth(prefix);
		const continuationPrefix = " ".repeat(prefixWidth);
		const body = new Text(this.message.summary, 0, 0).render(Math.max(1, width - prefixWidth));
		lines.push(...body.map((line, index) => `${index === 0 ? prefix : continuationPrefix}${line}`));
		return lines;
	}

	invalidate(): void {}
}
