#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_region(path: str, start: str, end: str, replacement: str) -> None:
    file_path = ROOT / path
    content = file_path.read_text(encoding="utf-8")
    start_index = content.index(start)
    end_index = content.index(end, start_index)
    file_path.write_text(content[:start_index] + replacement + content[end_index:], encoding="utf-8")


replace_region(
    "packages/coding-agent/src/core/tools/read.ts",
    "function formatReadResult(",
    "export function createReadToolDefinition",
    r'''function formatReadResult(
	result: { content: (TextContent | ImageContent)[]; details?: ReadToolDetails },
	theme: Theme,
	isError: boolean,
): string {
	const output = result.content
		.filter((content): content is TextContent => content.type === "text")
		.map((content) => content.text)
		.join("\n")
		.trim();
	if (isError) return output ? `\n${theme.fg("error", output)}` : "";

	const details = result.details;
	let summary: string;
	if (details?.kind === "image") {
		const mime = details.imageMimeType ? ` [${details.imageMimeType}]` : "";
		const size = details.imageBytes !== undefined ? ` (${formatSize(details.imageBytes)})` : "";
		summary = `Read image${mime}${size}`;
	} else {
		const linesRead = details?.linesRead ?? 0;
		summary = `Read ${linesRead} ${linesRead === 1 ? "line" : "lines"}`;
	}

	let text = `\n${theme.fg("toolOutput", summary)}`;
	const truncation = details?.truncation;
	if (truncation?.truncated) {
		if (truncation.firstLineExceedsLimit) {
			text += `\n${theme.fg("warning", `[First line exceeds ${formatSize(truncation.maxBytes ?? DEFAULT_MAX_BYTES)} limit]`)}`;
		} else if (truncation.truncatedBy === "lines") {
			text += `\n${theme.fg("warning", `[Truncated: read ${truncation.outputLines} of ${truncation.totalLines} lines]`)}`;
		} else {
			text += `\n${theme.fg("warning", `[Truncated at ${formatSize(truncation.maxBytes ?? DEFAULT_MAX_BYTES)}]`)}`;
		}
	}
	return text;
}

''',
)

replace_region(
    "packages/coding-agent/src/core/tools/grep.ts",
    "function formatGrepResult(",
    "export function createGrepToolDefinition",
    r'''function formatGrepResult(
	result: {
		content: Array<{ type: string; text?: string; data?: string; mimeType?: string }>;
		details?: GrepToolDetails;
	},
	options: ToolRenderResultOptions,
	theme: Theme,
	showImages: boolean,
	isError: boolean,
): string {
	const output = getTextOutput(result, showImages).trim();
	const details = result.details;
	const matchCount =
		details?.matchCount ?? (output === "No matches found" ? 0 : output ? output.split("\n").length : 0);
	const fileCount = details?.fileCount ?? 0;
	let text = `\n${theme.fg("toolOutput", `Found ${matchCount} ${matchCount === 1 ? "match" : "matches"}`)}`;
	if (fileCount > 0) {
		text += theme.fg("toolOutput", ` across ${fileCount} ${fileCount === 1 ? "file" : "files"}`);
	}
	if (!options.expanded && !isError) {
		if (matchCount > 0) text += ` ${keyHint("app.tools.expand", "to expand")}`;
	} else if (output) {
		const lines = output.split("\n");
		const maxLines = options.expanded ? lines.length : 15;
		const displayLines = lines.slice(0, maxLines);
		const remaining = lines.length - maxLines;
		text += `\n${displayLines.map((line) => theme.fg(isError ? "error" : "toolOutput", line)).join("\n")}`;
		if (remaining > 0) {
			text += `${theme.fg("muted", `\n… +${remaining} lines`)} ${keyHint("app.tools.expand", "to expand")}`;
		}
	}

	const warnings: string[] = [];
	if (details?.matchLimitReached) warnings.push(`${details.matchLimitReached} matches limit`);
	if (details?.truncation?.truncated) {
		warnings.push(`${formatSize(details.truncation.maxBytes ?? DEFAULT_MAX_BYTES)} limit`);
	}
	if (details?.linesTruncated) warnings.push("some lines truncated");
	if (warnings.length > 0) {
		text += `\n${theme.fg("warning", `[Truncated: ${warnings.join(", ")}]`)}`;
	}
	return text;
}

''',
)

replace_region(
    "packages/coding-agent/src/core/tools/find.ts",
    "function formatFindResult(",
    "export function createFindToolDefinition",
    r'''function formatFindResult(
	result: {
		content: Array<{ type: string; text?: string; data?: string; mimeType?: string }>;
		details?: FindToolDetails;
	},
	options: ToolRenderResultOptions,
	theme: Theme,
	showImages: boolean,
	isError: boolean,
): string {
	const output = getTextOutput(result, showImages).trim();
	const count =
		result.details?.resultCount ??
		(output.startsWith("No files found") ? 0 : output ? output.split("\n").length : 0);
	let text = `\n${theme.fg("toolOutput", `Found ${count} ${count === 1 ? "file" : "files"}`)}`;
	if (!options.expanded && !isError) {
		if (count > 0) text += ` ${keyHint("app.tools.expand", "to expand")}`;
	} else if (output) {
		const lines = output.split("\n");
		const maxLines = options.expanded ? lines.length : 20;
		const displayLines = lines.slice(0, maxLines);
		const remaining = lines.length - maxLines;
		text += `\n${displayLines.map((line) => theme.fg(isError ? "error" : "toolOutput", line)).join("\n")}`;
		if (remaining > 0) {
			text += `${theme.fg("muted", `\n… +${remaining} lines`)} ${keyHint("app.tools.expand", "to expand")}`;
		}
	}
	const warnings: string[] = [];
	if (result.details?.resultLimitReached) warnings.push(`${result.details.resultLimitReached} results limit`);
	if (result.details?.truncation?.truncated) {
		warnings.push(`${formatSize(result.details.truncation.maxBytes ?? DEFAULT_MAX_BYTES)} limit`);
	}
	if (warnings.length > 0) {
		text += `\n${theme.fg("warning", `[Truncated: ${warnings.join(", ")}]`)}`;
	}
	return text;
}

''',
)

replace_region(
    "packages/coding-agent/src/core/tools/ls.ts",
    "function formatLsResult(",
    "export function createLsToolDefinition",
    r'''function formatLsResult(
	result: {
		content: Array<{ type: string; text?: string; data?: string; mimeType?: string }>;
		details?: LsToolDetails;
	},
	options: ToolRenderResultOptions,
	theme: Theme,
	showImages: boolean,
	isError: boolean,
): string {
	const output = getTextOutput(result, showImages).trim();
	const count =
		result.details?.entryCount ?? (output === "(empty directory)" ? 0 : output ? output.split("\n").length : 0);
	let text = `\n${theme.fg("toolOutput", `Listed ${count} ${count === 1 ? "entry" : "entries"}`)}`;
	if (!options.expanded && !isError) {
		if (count > 0) text += ` ${keyHint("app.tools.expand", "to expand")}`;
	} else if (output) {
		const lines = output.split("\n");
		const maxLines = options.expanded ? lines.length : 20;
		const displayLines = lines.slice(0, maxLines);
		const remaining = lines.length - maxLines;
		text += `\n${displayLines.map((line) => theme.fg(isError ? "error" : "toolOutput", line)).join("\n")}`;
		if (remaining > 0) {
			text += `${theme.fg("muted", `\n… +${remaining} lines`)} ${keyHint("app.tools.expand", "to expand")}`;
		}
	}
	const warnings: string[] = [];
	if (result.details?.entryLimitReached) warnings.push(`${result.details.entryLimitReached} entries limit`);
	if (result.details?.truncation?.truncated) {
		warnings.push(`${formatSize(result.details.truncation.maxBytes ?? DEFAULT_MAX_BYTES)} limit`);
	}
	if (warnings.length > 0) {
		text += `\n${theme.fg("warning", `[Truncated: ${warnings.join(", ")}]`)}`;
	}
	return text;
}

''',
)

component_path = ROOT / "packages/coding-agent/src/modes/interactive/components/tool-activity-group.ts"
component_path.write_text(
    r'''import { type Component, truncateToWidth } from "@earendil-works/pi-tui";
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

export function getToolActivityKind(
	toolName: string,
	args: Record<string, unknown>,
): ToolActivityKind | undefined {
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

	constructor(private readonly requestRender: () => void) {}

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
			parts.push(`${active ? "searching for" : "searched for"} ${counts.search} ${counts.search === 1 ? "pattern" : "patterns"}`);
		}
		if (counts.read > 0) {
			parts.push(`${active ? "reading" : "read"} ${counts.read} ${counts.read === 1 ? "file" : "files"}`);
		}
		if (counts.list > 0) {
			parts.push(`${active ? "listing" : "listed"} ${counts.list} ${counts.list === 1 ? "directory" : "directories"}`);
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
''',
    encoding="utf-8",
)

for relative_path in (
    "packages/coding-agent/src/core/tools/grep.ts",
    "packages/coding-agent/src/core/tools/find.ts",
    "packages/coding-agent/src/core/tools/ls.ts",
):
    path = ROOT / relative_path
    content = path.read_text(encoding="utf-8")
    content = content.replace("$DEFAULT_LIMITresults", "${DEFAULT_LIMIT} results")
    content = content.replace("$DEFAULT_LIMITmatches", "${DEFAULT_LIMIT} matches")
    content = content.replace("$DEFAULT_LIMITentries", "${DEFAULT_LIMIT} entries")
    content = content.replace("$DEFAULT_MAX_BYTES / 1024KB", "${DEFAULT_MAX_BYTES / 1024}KB")
    path.write_text(content, encoding="utf-8")
