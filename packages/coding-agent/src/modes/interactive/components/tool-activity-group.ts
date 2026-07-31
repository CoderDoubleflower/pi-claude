import { type Component, truncateToWidth } from "@earendil-works/pi-tui";
import { classifyBashDisplayKind } from "../../../core/tools/bash.ts";
import { theme } from "../theme/theme.ts";
import { keyHint } from "./keybinding-hints.ts";

export type ToolActivityKind = "read" | "search" | "list" | "bash";
type ToolActivityStatus = "queued" | "running" | "success" | "error";

type ExpandableComponent = Component & { setExpanded?(expanded: boolean): void };

type ToolActivityEntry = {
	toolCallId: string;
	toolName: string;
	args: Record<string, unknown>;
	kind: ToolActivityKind;
	component: ExpandableComponent;
	status: ToolActivityStatus;
};

const MIN_HINT_DISPLAY_MS = 700;
const MAX_HINT_CHARS = 300;

function stringArg(args: Record<string, unknown>, ...keys: string[]): string | undefined {
	for (const key of keys) {
		const value = args[key];
		if (typeof value === "string" && value.length > 0) return value;
	}
	return undefined;
}

export function getToolActivityKind(toolName: string, args: Record<string, unknown>): ToolActivityKind | undefined {
	switch (toolName) {
		case "read":
			return "read";
		case "grep":
		case "find":
			return "search";
		case "ls":
			return "list";
		case "bash":
			return classifyBashDisplayKind(stringArg(args, "command"));
		default:
			return undefined;
	}
}

function cleanCommandHint(command: string): string {
	const cleaned =
		"$ " +
		command
			.split("\n")
			.map((line) => line.replace(/\s+/g, " ").trim())
			.filter(Boolean)
			.join("\n");
	return cleaned.length > MAX_HINT_CHARS ? `${cleaned.slice(0, MAX_HINT_CHARS - 1)}…` : cleaned;
}

function getHint(toolName: string, args: Record<string, unknown>): string | undefined {
	switch (toolName) {
		case "read":
			return stringArg(args, "file_path", "path");
		case "grep": {
			const pattern = stringArg(args, "pattern");
			return pattern ? `"${pattern}"` : undefined;
		}
		case "find":
			return stringArg(args, "pattern");
		case "ls":
			return stringArg(args, "path") ?? ".";
		case "bash": {
			const command = stringArg(args, "command");
			return command ? cleanCommandHint(command) : undefined;
		}
		default:
			return undefined;
	}
}

function capitalize(value: string): string {
	return value.length === 0 ? value : `${value[0]?.toUpperCase()}${value.slice(1)}`;
}

export class ToolActivityGroupComponent implements Component {
	private readonly entries: ToolActivityEntry[] = [];
	private expanded = false;
	private displayedHint: string | undefined;
	private pendingHint: string | undefined;
	private hintVisibleSince = 0;
	private hintTimer: NodeJS.Timeout | undefined;

	private readonly requestRender: () => void;

	constructor(requestRender: () => void) {
		this.requestRender = requestRender;
	}

	addTool(entry: {
		toolCallId: string;
		toolName: string;
		args: Record<string, unknown>;
		kind: ToolActivityKind;
		component: ExpandableComponent;
	}): void {
		if (this.entries.some((item) => item.toolCallId === entry.toolCallId)) return;
		entry.component.setExpanded?.(this.expanded);
		this.entries.push({ ...entry, status: "queued" });
		this.updateHint(getHint(entry.toolName, entry.args));
	}

	updateArgs(toolCallId: string, args: Record<string, unknown>): void {
		const entry = this.entries.find((item) => item.toolCallId === toolCallId);
		if (!entry) return;
		entry.args = args;
		this.updateHint(getHint(entry.toolName, args));
	}

	markStarted(toolCallId: string): void {
		const entry = this.entries.find((item) => item.toolCallId === toolCallId);
		if (entry) entry.status = "running";
	}

	markCompleted(toolCallId: string, isError: boolean): void {
		const entry = this.entries.find((item) => item.toolCallId === toolCallId);
		if (entry) entry.status = isError ? "error" : "success";
	}

	setExpanded(expanded: boolean): void {
		this.expanded = expanded;
		for (const entry of this.entries) entry.component.setExpanded?.(expanded);
	}

	private updateHint(nextHint: string | undefined): void {
		if (!nextHint || nextHint === this.displayedHint) return;
		const now = Date.now();
		if (!this.displayedHint || now - this.hintVisibleSince >= MIN_HINT_DISPLAY_MS) {
			this.displayedHint = nextHint;
			this.hintVisibleSince = now;
			this.pendingHint = undefined;
			if (this.hintTimer) clearTimeout(this.hintTimer);
			this.hintTimer = undefined;
			return;
		}

		this.pendingHint = nextHint;
		if (this.hintTimer) return;
		const delay = MIN_HINT_DISPLAY_MS - (now - this.hintVisibleSince);
		this.hintTimer = setTimeout(() => {
			this.hintTimer = undefined;
			if (!this.pendingHint) return;
			this.displayedHint = this.pendingHint;
			this.pendingHint = undefined;
			this.hintVisibleSince = Date.now();
			this.requestRender();
		}, delay);
	}

	private isActive(): boolean {
		return this.entries.some((entry) => entry.status === "queued" || entry.status === "running");
	}

	private hasError(): boolean {
		return this.entries.some((entry) => entry.status === "error");
	}

	private getSummary(): string {
		const active = this.isActive();
		const counts: Record<ToolActivityKind, number> = { read: 0, search: 0, list: 0, bash: 0 };
		for (const entry of this.entries) counts[entry.kind] += 1;
		const parts: string[] = [];
		if (counts.search > 0) {
			parts.push(
				`${active ? "searching for" : "searched for"} ${counts.search} ${counts.search === 1 ? "pattern" : "patterns"}`,
			);
		}
		if (counts.read > 0) {
			parts.push(`${active ? "reading" : "read"} ${counts.read} ${counts.read === 1 ? "file" : "files"}`);
		}
		if (counts.list > 0) {
			parts.push(
				`${active ? "listing" : "listed"} ${counts.list} ${counts.list === 1 ? "directory" : "directories"}`,
			);
		}
		if (counts.bash > 0) {
			parts.push(`${active ? "running" : "ran"} ${counts.bash} bash ${counts.bash === 1 ? "command" : "commands"}`);
		}
		return capitalize(parts.join(", "));
	}

	render(width: number): string[] {
		if (this.expanded) return this.entries.flatMap((entry) => entry.component.render(width));
		if (this.entries.length === 0) return [];
		const active = this.isActive();
		const dot = active
			? theme.fg("toolRunning", "●")
			: this.hasError()
				? theme.fg("toolError", "●")
				: theme.fg("toolSuccess", "●");
		const summary = `${dot} ${this.getSummary()} ${keyHint("app.tools.expand", "to expand")}`;
		const lines = ["", truncateToWidth(summary, width)];
		if (active && this.displayedHint) {
			lines.push(truncateToWidth(theme.fg("muted", `  ⎿  ${this.displayedHint}`), width));
		}
		return lines;
	}

	invalidate(): void {
		for (const entry of this.entries) entry.component.invalidate?.();
	}

	dispose(): void {
		if (this.hintTimer) clearTimeout(this.hintTimer);
	}
}
