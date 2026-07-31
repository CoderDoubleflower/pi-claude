import { type Component, Text } from "@earendil-works/pi-tui";
import type { CustomEntry } from "../../../core/session-manager.ts";
import {
	CLAUDE_TURN_DURATION_GLYPH,
	createClaudeTurnCompletionMessage,
	formatClaudeTurnDuration,
} from "./claude-working.ts";
import { MessageMarkerComponent } from "./message-marker.ts";

export const CLAUDE_TURN_DURATION_ENTRY_TYPE = "pi-claude.turn-duration";

export interface ClaudeTurnDurationEntryData {
	durationMs: number;
}

function dim(text: string): string {
	return "\u001b[2m" + text + "\u001b[22m";
}

export function getClaudeTurnDurationMs(entry: CustomEntry): number | undefined {
	if (entry.customType !== CLAUDE_TURN_DURATION_ENTRY_TYPE || typeof entry.data !== "object" || entry.data === null) {
		return undefined;
	}
	const durationMs = (entry.data as { durationMs?: unknown }).durationMs;
	if (typeof durationMs !== "number" || !Number.isFinite(durationMs) || durationMs < 0) {
		return undefined;
	}
	return durationMs;
}

export class ClaudeTurnDurationMessageComponent implements Component {
	private readonly content: MessageMarkerComponent;

	constructor(durationMs: number) {
		const message = createClaudeTurnCompletionMessage() + " for " + formatClaudeTurnDuration(durationMs);
		this.content = new MessageMarkerComponent(new Text(dim(message), 0, 0), dim(CLAUDE_TURN_DURATION_GLYPH));
	}

	render(width: number): string[] {
		return ["", ...this.content.render(width)];
	}

	invalidate(): void {
		this.content.invalidate();
	}
}
