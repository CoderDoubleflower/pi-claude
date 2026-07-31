#!/usr/bin/env python3
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    (ROOT / path).write_text(content, encoding="utf-8")


def replace_once(path: str, old: str, new: str) -> None:
    content = read(path)
    count = content.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected one exact match, found {count}")
    write(path, content.replace(old, new, 1))


def replace_regex_once(path: str, pattern: str, replacement: str) -> None:
    content = read(path)
    updated, count = re.subn(pattern, replacement, content, count=1, flags=re.S)
    if count != 1:
        raise RuntimeError(f"{path}: expected one regex match, found {count}: {pattern[:80]}")
    write(path, updated)


def patch_index() -> None:
    path = "packages/coding-agent/src/core/tools/index.ts"
    replace_regex_once(
        path,
        r"const TOOL_CALL_PREVIEW_MAX_WIDTH = 120;.*?\nfunction createBashDisplayToolDefinition",
        r'''const BASH_CALL_PREVIEW_MAX_LINES = 2;
const BASH_CALL_PREVIEW_MAX_WIDTH = 160;

class ClaudeBashCallComponent implements Component {
	private readonly component: Component;

	constructor(component: Component) {
		this.component = component;
	}

	getInnerComponent(): Component {
		return this.component;
	}

	render(width: number): string[] {
		const lines = this.component.render(width).filter((line) => stripAnsi(line).trim().length > 0);
		if (lines.length === 0) return [];

		const maxLineWidth = Math.max(1, Math.min(width, BASH_CALL_PREVIEW_MAX_WIDTH));
		const rendered: string[] = [];
		let remainingWidth = BASH_CALL_PREVIEW_MAX_WIDTH;
		let truncated = lines.length > BASH_CALL_PREVIEW_MAX_LINES;

		for (const line of lines.slice(0, BASH_CALL_PREVIEW_MAX_LINES)) {
			const allowedWidth = Math.max(1, Math.min(maxLineWidth, remainingWidth));
			if (visibleWidth(line) > allowedWidth) {
				rendered.push(truncateToWidth(line, allowedWidth, "…"));
				truncated = true;
				break;
			}
			rendered.push(line);
			remainingWidth -= visibleWidth(line);
			if (remainingWidth <= 0) {
				truncated = lines.length > rendered.length;
				break;
			}
		}

		if (truncated && rendered.length > 0) {
			const lastIndex = rendered.length - 1;
			const lastLine = rendered[lastIndex] ?? "";
			if (!stripAnsi(lastLine).endsWith("…")) {
				rendered[lastIndex] = truncateToWidth(`${lastLine}…`, maxLineWidth, "…");
			}
		}
		return rendered;
	}

	invalidate(): void {
		this.component.invalidate?.();
	}
}

function createBashDisplayToolDefinition''',
    )

    replace_once(
        path,
        '''\t\trenderCall(args, activeTheme, context) {
\t\t\tconst state = context.state as typeof context.state & BashDisplayState;
\t\t\tconst executionArgs = getToolExecutionArguments<BashToolInput>(context.toolCallId);
\t\t\tif (executionArgs !== undefined) {
\t\t\t\tstate.canonicalExecutionArgs = executionArgs;
\t\t\t}

\t\t\t// Keep streamed command fragments hidden, then reveal the complete event
\t\t\t// arguments as soon as execution starts. Canonical runtime arguments win
\t\t\t// once the execution wrapper has recorded them.
\t\t\tconst displayArgs: BashToolInput =
\t\t\t\tstate.canonicalExecutionArgs ?? (context.executionStarted || !context.isPartial ? args : { command: "" });
\t\t\treturn renderCall(displayArgs, activeTheme, context);
\t\t},''',
        '''\t\trenderCall(args, activeTheme, context) {
\t\t\tconst state = context.state as typeof context.state & BashDisplayState;
\t\t\tconst executionArgs = getToolExecutionArguments<BashToolInput>(context.toolCallId);
\t\t\tif (executionArgs !== undefined) {
\t\t\t\tstate.canonicalExecutionArgs = executionArgs;
\t\t\t}

\t\t\t// Keep streamed command fragments hidden, then reveal the complete event
\t\t\t// arguments as soon as execution starts. Canonical runtime arguments win
\t\t\t// once the execution wrapper has recorded them.
\t\t\tconst displayArgs: BashToolInput =
\t\t\t\tstate.canonicalExecutionArgs ?? (context.executionStarted || !context.isPartial ? args : { command: "" });
\t\t\tconst lastComponent =
\t\t\t\tcontext.lastComponent instanceof ClaudeBashCallComponent
\t\t\t\t\t? context.lastComponent.getInnerComponent()
\t\t\t\t\t: context.lastComponent;
\t\t\tconst component = renderCall(displayArgs, activeTheme, { ...context, lastComponent });
\t\t\tif (!context.executionStarted || context.expanded) return component;
\t\t\treturn new ClaudeBashCallComponent(component);
\t\t},''',
    )

    replacements = {
        'return withCompactCallDisplay(createReadToolDefinition(cwd, options?.read));': 'return createReadToolDefinition(cwd, options?.read);',
        'return withCompactCallDisplay(createBashDisplayToolDefinition(cwd, options?.bash));': 'return createBashDisplayToolDefinition(cwd, options?.bash);',
        'return withCompactCallDisplay(createEditToolDefinition(cwd, options?.edit));': 'return createEditToolDefinition(cwd, options?.edit);',
        'return withCompactCallDisplay(createWriteToolDefinition(cwd, options?.write));': 'return createWriteToolDefinition(cwd, options?.write);',
        'return withCompactCallDisplay(createGrepToolDefinition(cwd, options?.grep));': 'return createGrepToolDefinition(cwd, options?.grep);',
        'return withCompactCallDisplay(createFindToolDefinition(cwd, options?.find));': 'return createFindToolDefinition(cwd, options?.find);',
        'return withCompactCallDisplay(createLsToolDefinition(cwd, options?.ls));': 'return createLsToolDefinition(cwd, options?.ls);',
    }
    content = read(path)
    for old, new in replacements.items():
        if content.count(old) != 1:
            raise RuntimeError(f"{path}: expected one switch match for {old}")
        content = content.replace(old, new, 1)
    write(path, content)


def patch_bash() -> None:
    path = "packages/coding-agent/src/core/tools/bash.ts"
    replace_once(path, 'import { truncateToVisualLines } from "../../modes/interactive/components/visual-truncate.ts";\n', '')
    replace_once(path, 'const BASH_PREVIEW_LINES = 5;', 'const BASH_PREVIEW_LINES = 3;')

    replace_once(
        path,
        '''export interface BashToolDetails {
\ttruncation?: TruncationResult;
\tfullOutputPath?: string;
}
''',
        '''export interface BashToolDetails {
\ttruncation?: TruncationResult;
\tfullOutputPath?: string;
}

export type BashDisplayKind = "search" | "read" | "list" | "bash";

const BASH_SEARCH_COMMANDS = new Set(["find", "grep", "rg", "ag", "ack", "locate", "which", "whereis"]);
const BASH_READ_COMMANDS = new Set([
\t"cat",
\t"head",
\t"tail",
\t"less",
\t"more",
\t"wc",
\t"stat",
\t"file",
\t"strings",
\t"jq",
\t"awk",
\t"cut",
\t"sort",
\t"uniq",
\t"tr",
]);
const BASH_LIST_COMMANDS = new Set(["ls", "tree", "du"]);
const BASH_NEUTRAL_COMMANDS = new Set(["echo", "printf", "true", "false", ":", "cd", "export", "unset"]);
const BASH_WRAPPER_COMMANDS = new Set(["sudo", "env", "command", "builtin", "nohup", "time"]);
const BASH_SILENT_COMMANDS = new Set([
\t"mv",
\t"cp",
\t"rm",
\t"mkdir",
\t"rmdir",
\t"chmod",
\t"chown",
\t"chgrp",
\t"touch",
\t"ln",
\t"cd",
\t"export",
\t"unset",
\t"wait",
]);

function getBaseCommand(segment: string): string | undefined {
\tconst words = segment.trim().split(/\\s+/).filter(Boolean);
\twhile (words[0] && /^[A-Za-z_][A-Za-z0-9_]*=/.test(words[0])) words.shift();
\twhile (words[0] && BASH_WRAPPER_COMMANDS.has(words[0])) words.shift();
\tconst command = words[0];
\tif (!command) return undefined;
\treturn command.split(/[\\\\/]/).at(-1);
}

export function classifyBashDisplayKind(command: string | undefined): BashDisplayKind {
\tif (!command?.trim()) return "bash";
\tlet sawSearch = false;
\tlet sawRead = false;
\tlet sawList = false;
\tlet sawCommand = false;

\tfor (const segment of command.split(/(?:&&|\\|\\||[|;\\n])/)) {
\t\tconst baseCommand = getBaseCommand(segment);
\t\tif (!baseCommand || BASH_NEUTRAL_COMMANDS.has(baseCommand)) continue;
\t\tsawCommand = true;
\t\tif (BASH_SEARCH_COMMANDS.has(baseCommand)) sawSearch = true;
\t\telse if (BASH_READ_COMMANDS.has(baseCommand)) sawRead = true;
\t\telse if (BASH_LIST_COMMANDS.has(baseCommand)) sawList = true;
\t\telse return "bash";
\t}

\tif (!sawCommand) return "bash";
\tif (sawSearch) return "search";
\tif (sawRead) return "read";
\tif (sawList) return "list";
\treturn "bash";
}

function isSilentBashCommand(command: string): boolean {
\tlet sawCommand = false;
\tfor (const segment of command.split(/(?:&&|\\|\\||[|;\\n])/)) {
\t\tconst baseCommand = getBaseCommand(segment);
\t\tif (!baseCommand || BASH_NEUTRAL_COMMANDS.has(baseCommand)) continue;
\t\tsawCommand = true;
\t\tif (!BASH_SILENT_COMMANDS.has(baseCommand)) return false;
\t}
\treturn sawCommand;
}
''',
    )

    replace_once(
        path,
        'function rebuildBashResultRenderComponent(\n',
        '''function truncateToLeadingVisualLines(text: string, maxVisualLines: number, width: number): {
\tvisualLines: string[];
\tskippedCount: number;
} {
\tconst allVisualLines = new Text(text, 0, 0).render(width);
\tif (allVisualLines.length <= maxVisualLines) {
\t\treturn { visualLines: allVisualLines, skippedCount: 0 };
\t}
\tconst remaining = allVisualLines.length - maxVisualLines;
\tif (remaining === 1) {
\t\treturn { visualLines: allVisualLines.slice(0, maxVisualLines + 1), skippedCount: 0 };
\t}
\treturn {
\t\tvisualLines: allVisualLines.slice(0, maxVisualLines),
\t\tskippedCount: remaining,
\t};
}

function rebuildBashResultRenderComponent(
''',
    )
    replace_once(
        path,
        'const preview = truncateToVisualLines(styledOutput, BASH_PREVIEW_LINES, width);',
        'const preview = truncateToLeadingVisualLines(styledOutput, BASH_PREVIEW_LINES, width);',
    )
    replace_once(
        path,
        '''theme.fg("muted", `... (${state.cachedSkipped} earlier lines,`) +
\t\t\t\t\t\t\t` ${keyHint("app.tools.expand", "to expand")}${theme.fg("muted", ")")}`;''',
        '''theme.fg("muted", `… +${state.cachedSkipped} lines`) +
\t\t\t\t\t\t\t` ${keyHint("app.tools.expand", "to expand")}`;''',
    )
    replace_once(
        path,
        'const { text: outputText, details } = formatOutput(snapshot);',
        'const { text: outputText, details } = formatOutput(snapshot, isSilentBashCommand(command) ? "Done" : "(no output)");',
    )


def patch_read() -> None:
    path = "packages/coding-agent/src/core/tools/read.ts"
    replace_once(
        path,
        'import { keyHint, keyText } from "../../modes/interactive/components/keybinding-hints.ts";',
        'import { keyText } from "../../modes/interactive/components/keybinding-hints.ts";',
    )
    replace_once(
        path,
        'import { getLanguageFromPath, highlightCode, type Theme } from "../../modes/interactive/theme/theme.ts";',
        'import type { Theme } from "../../modes/interactive/theme/theme.ts";',
    )
    replace_once(
        path,
        'import { getTextOutput, renderToolPath, replaceTabs, str } from "./render-utils.ts";',
        'import { renderToolPath, str } from "./render-utils.ts";',
    )
    replace_once(
        path,
        '''export interface ReadToolDetails {
\ttruncation?: TruncationResult;
}''',
        '''export interface ReadToolDetails {
\ttruncation?: TruncationResult;
\tkind?: "text" | "image";
\tlinesRead?: number;
\timageMimeType?: string;
\timageBytes?: number;
}''',
    )
    replace_regex_once(path, r"\nfunction trimTrailingEmptyLines\(lines: string\[\]\): string\[\] \{.*?\n\}\n", "\n")
    replace_regex_once(
        path,
        r"function formatReadResult\(.*?\n\}\n\nexport function createReadToolDefinition",
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

export function createReadToolDefinition''',
    )
    replace_once(
        path,
        'const processed = await processImage(buffer, mimeType, { autoResizeImages });',
        '''const processed = await processImage(buffer, mimeType, { autoResizeImages });
\t\t\t\t\t\t\t\tdetails = {
\t\t\t\t\t\t\t\t\tkind: "image",
\t\t\t\t\t\t\t\t\timageMimeType: processed.ok ? processed.mimeType : mimeType,
\t\t\t\t\t\t\t\t\timageBytes: buffer.byteLength,
\t\t\t\t\t\t\t\t};''',
    )
    replace_once(
        path,
        '\t\t\t\t\t\t\t\tcontent = [{ type: "text", text: outputText }];',
        '''\t\t\t\t\t\t\t\tdetails = {
\t\t\t\t\t\t\t\t\t...details,
\t\t\t\t\t\t\t\t\tkind: "text",
\t\t\t\t\t\t\t\t\tlinesRead: truncation.firstLineExceedsLimit ? 0 : truncation.outputLines,
\t\t\t\t\t\t\t\t};
\t\t\t\t\t\t\t\tcontent = [{ type: "text", text: outputText }];''',
    )
    replace_once(
        path,
        '''\t\t\ttext.setText(
\t\t\t\tformatReadResult(context.args, result, options, theme, context.showImages, context.cwd, context.isError),
\t\t\t);''',
        '''\t\t\ttext.setText(formatReadResult(result, theme, context.isError));''',
    )


def summary_renderer(
    path: str,
    function_name: str,
    details_type: str,
    count_fields: str,
    singular: str,
    plural: str,
    verb: str,
    expanded_limit: int,
) -> None:
    pattern = rf"function {function_name}\(.*?\n\}}\n\nexport function"
    replacement = f'''function {function_name}(
\tresult: {{
\t\tcontent: Array<{{ type: string; text?: string; data?: string; mimeType?: string }}>;
\t\tdetails?: {details_type};
\t}},
\toptions: ToolRenderResultOptions,
\ttheme: Theme,
\tshowImages: boolean,
\tisError: boolean,
): string {{
\tconst output = getTextOutput(result, showImages).trim();
\tconst details = result.details;
\t{count_fields}
\tlet text = `\\n${{theme.fg("toolOutput", `{verb} ${{count}} ${{count === 1 ? "{singular}" : "{plural}"}}`)}}`;
\tif (!options.expanded && !isError) {{
\t\tif (count > 0) text += ` ${{keyHint("app.tools.expand", "to expand")}}`;
\t}} else if (output) {{
\t\tconst lines = output.split("\\n");
\t\tconst maxLines = options.expanded ? lines.length : {expanded_limit};
\t\tconst displayLines = lines.slice(0, maxLines);
\t\tconst remaining = lines.length - maxLines;
\t\ttext += `\\n${{displayLines.map((line) => theme.fg(isError ? "error" : "toolOutput", line)).join("\\n")}}`;
\t\tif (remaining > 0) {{
\t\t\ttext += `${{theme.fg("muted", `\\n… +${{remaining}} lines`)}} ${{keyHint("app.tools.expand", "to expand")}}`;
\t\t}}
\t}}

\tconst warnings: string[] = [];
\tif (details?.truncation?.truncated) warnings.push(`${{formatSize(details.truncation.maxBytes ?? DEFAULT_MAX_BYTES)}} limit`);
\tif (warnings.length > 0) text += `\\n${{theme.fg("warning", `[Truncated: ${{warnings.join(", ")}}]`)}}`;
\treturn text;
}}

export function'''
    replace_regex_once(path, pattern, replacement)


def patch_grep() -> None:
    path = "packages/coding-agent/src/core/tools/grep.ts"
    replace_once(
        path,
        '''export interface GrepToolDetails {
\ttruncation?: TruncationResult;
\tmatchLimitReached?: number;
\tlinesTruncated?: boolean;
}''',
        '''export interface GrepToolDetails {
\ttruncation?: TruncationResult;
\tmatchLimitReached?: number;
\tlinesTruncated?: boolean;
\tmatchCount?: number;
\tfileCount?: number;
}''',
    )
    replace_regex_once(
        path,
        r"function formatGrepResult\(.*?\n\}\n\nexport function createGrepToolDefinition",
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
	const matchCount = details?.matchCount ?? (output === "No matches found" ? 0 : output ? output.split("\n").length : 0);
	const fileCount = details?.fileCount ?? 0;
	let text = `\n${theme.fg("toolOutput", `Found ${matchCount} ${matchCount === 1 ? "match" : "matches"}`)}`;
	if (fileCount > 0) text += theme.fg("toolOutput", ` across ${fileCount} ${fileCount === 1 ? "file" : "files"}`);
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
	if (details?.truncation?.truncated) warnings.push(`${formatSize(details.truncation.maxBytes ?? DEFAULT_MAX_BYTES)} limit`);
	if (details?.linesTruncated) warnings.push("some lines truncated");
	if (warnings.length > 0) text += `\n${theme.fg("warning", `[Truncated: ${warnings.join(", ")}]`)}`;
	return text;
}

export function createGrepToolDefinition''',
    )
    replace_once(
        path,
        'resolve({ content: [{ type: "text", text: "No matches found" }], details: undefined })',
        'resolve({ content: [{ type: "text", text: "No matches found" }], details: { matchCount: 0, fileCount: 0 } })',
    )
    replace_once(
        path,
        'const details: GrepToolDetails = {};',
        '''const details: GrepToolDetails = {
\t\t\t\t\t\t\t\tmatchCount,
\t\t\t\t\t\t\t\tfileCount: new Set(matches.map((match) => match.filePath)).size,
\t\t\t\t\t\t\t};''',
    )
    replace_once(
        path,
        'text.setText(formatGrepResult(result as any, options, theme, context.showImages));',
        'text.setText(formatGrepResult(result as any, options, theme, context.showImages, context.isError));',
    )


def patch_find() -> None:
    path = "packages/coding-agent/src/core/tools/find.ts"
    replace_once(
        path,
        '''export interface FindToolDetails {
\ttruncation?: TruncationResult;
\tresultLimitReached?: number;
}''',
        '''export interface FindToolDetails {
\ttruncation?: TruncationResult;
\tresultLimitReached?: number;
\tresultCount?: number;
}''',
    )
    replace_regex_once(
        path,
        r"function formatFindResult\(.*?\n\}\n\nexport function createFindToolDefinition",
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
	const count = result.details?.resultCount ?? (output.startsWith("No files found") ? 0 : output ? output.split("\n").length : 0);
	let text = `\n${theme.fg("toolOutput", `Found ${count} ${count === 1 ? "file" : "files"}`)}`;
	if (!options.expanded && !isError) {
		if (count > 0) text += ` ${keyHint("app.tools.expand", "to expand")}`;
	} else if (output) {
		const lines = output.split("\n");
		const maxLines = options.expanded ? lines.length : 20;
		const displayLines = lines.slice(0, maxLines);
		const remaining = lines.length - maxLines;
		text += `\n${displayLines.map((line) => theme.fg(isError ? "error" : "toolOutput", line)).join("\n")}`;
		if (remaining > 0) text += `${theme.fg("muted", `\n… +${remaining} lines`)} ${keyHint("app.tools.expand", "to expand")}`;
	}
	const warnings: string[] = [];
	if (result.details?.resultLimitReached) warnings.push(`${result.details.resultLimitReached} results limit`);
	if (result.details?.truncation?.truncated) warnings.push(`${formatSize(result.details.truncation.maxBytes ?? DEFAULT_MAX_BYTES)} limit`);
	if (warnings.length > 0) text += `\n${theme.fg("warning", `[Truncated: ${warnings.join(", ")}]`)}`;
	return text;
}

export function createFindToolDefinition''',
    )
    content = read(path)
    content = content.replace('content: [{ type: "text", text: "No files found matching pattern" }],\n\t\t\t\t\t\t\t\t\t\tdetails: undefined,', 'content: [{ type: "text", text: "No files found matching pattern" }],\n\t\t\t\t\t\t\t\t\t\tdetails: { resultCount: 0 },')
    if content.count('const details: FindToolDetails = {};') != 2:
        raise RuntimeError("find.ts: expected two details initializers")
    content = content.replace('const details: FindToolDetails = {};', 'const details: FindToolDetails = { resultCount: relativized.length };')
    content = content.replace(
        'text.setText(formatFindResult(result as any, options, theme, context.showImages));',
        'text.setText(formatFindResult(result as any, options, theme, context.showImages, context.isError));',
        1,
    )
    write(path, content)


def patch_ls() -> None:
    path = "packages/coding-agent/src/core/tools/ls.ts"
    replace_once(
        path,
        '''export interface LsToolDetails {
\ttruncation?: TruncationResult;
\tentryLimitReached?: number;
}''',
        '''export interface LsToolDetails {
\ttruncation?: TruncationResult;
\tentryLimitReached?: number;
\tentryCount?: number;
}''',
    )
    replace_regex_once(
        path,
        r"function formatLsResult\(.*?\n\}\n\nexport function createLsToolDefinition",
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
	const count = result.details?.entryCount ?? (output === "(empty directory)" ? 0 : output ? output.split("\n").length : 0);
	let text = `\n${theme.fg("toolOutput", `Listed ${count} ${count === 1 ? "entry" : "entries"}`)}`;
	if (!options.expanded && !isError) {
		if (count > 0) text += ` ${keyHint("app.tools.expand", "to expand")}`;
	} else if (output) {
		const lines = output.split("\n");
		const maxLines = options.expanded ? lines.length : 20;
		const displayLines = lines.slice(0, maxLines);
		const remaining = lines.length - maxLines;
		text += `\n${displayLines.map((line) => theme.fg(isError ? "error" : "toolOutput", line)).join("\n")}`;
		if (remaining > 0) text += `${theme.fg("muted", `\n… +${remaining} lines`)} ${keyHint("app.tools.expand", "to expand")}`;
	}
	const warnings: string[] = [];
	if (result.details?.entryLimitReached) warnings.push(`${result.details.entryLimitReached} entries limit`);
	if (result.details?.truncation?.truncated) warnings.push(`${formatSize(result.details.truncation.maxBytes ?? DEFAULT_MAX_BYTES)} limit`);
	if (warnings.length > 0) text += `\n${theme.fg("warning", `[Truncated: ${warnings.join(", ")}]`)}`;
	return text;
}

export function createLsToolDefinition''',
    )
    replace_once(
        path,
        'resolve({ content: [{ type: "text", text: "(empty directory)" }], details: undefined });',
        'resolve({ content: [{ type: "text", text: "(empty directory)" }], details: { entryCount: 0 } });',
    )
    replace_once(path, 'const details: LsToolDetails = {};', 'const details: LsToolDetails = { entryCount: results.length };')
    replace_once(
        path,
        'text.setText(formatLsResult(result as any, options, theme, context.showImages));',
        'text.setText(formatLsResult(result as any, options, theme, context.showImages, context.isError));',
    )


def create_group_component() -> None:
    path = ROOT / "packages/coding-agent/src/modes/interactive/components/tool-activity-group.ts"
    path.write_text(
        '''import { type Component, truncateToWidth } from "@earendil-works/pi-tui";
import { classifyBashDisplayKind } from "../../../core/tools/bash.ts";
import { keyHint } from "./keybinding-hints.ts";
import { theme } from "../theme/theme.ts";

export type ToolActivityKind = "read" | "search" | "list" | "bash";
type ToolActivityStatus = "queued" | "running" | "success" | "error";

type ToolActivityEntry = {
\ttoolCallId: string;
\ttoolName: string;
\targs: Record<string, unknown>;
\tkind: ToolActivityKind;
\tcomponent: Component & { setExpanded?(expanded: boolean): void };
\tstatus: ToolActivityStatus;
};

const MIN_HINT_DISPLAY_MS = 700;
const MAX_HINT_CHARS = 300;

function stringArg(args: Record<string, unknown>, ...keys: string[]): string | undefined {
\tfor (const key of keys) {
\t\tconst value = args[key];
\t\tif (typeof value === "string" && value.length > 0) return value;
\t}
\treturn undefined;
}

export function getToolActivityKind(toolName: string, args: Record<string, unknown>): ToolActivityKind | undefined {
\tswitch (toolName) {
\t\tcase "read":
\t\t\treturn "read";
\t\tcase "grep":
\t\tcase "find":
\t\t\treturn "search";
\t\tcase "ls":
\t\t\treturn "list";
\t\tcase "bash":
\t\t\treturn classifyBashDisplayKind(stringArg(args, "command"));
\t\tdefault:
\t\t\treturn undefined;
\t}
}

function cleanCommandHint(command: string): string {
\tconst cleaned =
\t\t"$ " +
\t\tcommand
\t\t\t.split("\n")
\t\t\t.map((line) => line.replace(/\s+/g, " ").trim())
\t\t\t.filter(Boolean)
\t\t\t.join("\n");
\treturn cleaned.length > MAX_HINT_CHARS ? `${cleaned.slice(0, MAX_HINT_CHARS - 1)}…` : cleaned;
}

function getHint(toolName: string, args: Record<string, unknown>): string | undefined {
\tswitch (toolName) {
\t\tcase "read":
\t\t\treturn stringArg(args, "file_path", "path");
\t\tcase "grep": {
\t\t\tconst pattern = stringArg(args, "pattern");
\t\t\treturn pattern ? `"${pattern}"` : undefined;
\t\t}
\t\tcase "find":
\t\t\treturn stringArg(args, "pattern");
\t\tcase "ls":
\t\t\treturn stringArg(args, "path") ?? ".";
\t\tcase "bash": {
\t\t\tconst command = stringArg(args, "command");
\t\t\treturn command ? cleanCommandHint(command) : undefined;
\t\t}
\t\tdefault:
\t\t\treturn undefined;
\t}
}

function capitalize(value: string): string {
\treturn value.length === 0 ? value : `${value[0]?.toUpperCase()}${value.slice(1)}`;
}

export class ToolActivityGroupComponent implements Component {
\tprivate readonly entries: ToolActivityEntry[] = [];
\tprivate expanded = false;
\tprivate displayedHint: string | undefined;
\tprivate pendingHint: string | undefined;
\tprivate hintVisibleSince = 0;
\tprivate hintTimer: NodeJS.Timeout | undefined;

\tconstructor(private readonly requestRender: () => void) {}

\taddTool(entry: {
\t\ttoolCallId: string;
\t\ttoolName: string;
\t\targs: Record<string, unknown>;
\t\tkind: ToolActivityKind;
\t\tcomponent: Component & { setExpanded?(expanded: boolean): void };
\t}): void {
\t\tif (this.entries.some((item) => item.toolCallId === entry.toolCallId)) return;
\t\tentry.component.setExpanded?.(this.expanded);
\t\tthis.entries.push({ ...entry, status: "queued" });
\t\tthis.updateHint(getHint(entry.toolName, entry.args));
\t}

\tupdateArgs(toolCallId: string, args: Record<string, unknown>): void {
\t\tconst entry = this.entries.find((item) => item.toolCallId === toolCallId);
\t\tif (!entry) return;
\t\tentry.args = args;
\t\tthis.updateHint(getHint(entry.toolName, args));
\t}

\tmarkStarted(toolCallId: string): void {
\t\tconst entry = this.entries.find((item) => item.toolCallId === toolCallId);
\t\tif (entry) entry.status = "running";
\t}

\tmarkCompleted(toolCallId: string, isError: boolean): void {
\t\tconst entry = this.entries.find((item) => item.toolCallId === toolCallId);
\t\tif (entry) entry.status = isError ? "error" : "success";
\t}

\tsetExpanded(expanded: boolean): void {
\t\tthis.expanded = expanded;
\t\tfor (const entry of this.entries) entry.component.setExpanded?.(expanded);
\t}

\tprivate updateHint(nextHint: string | undefined): void {
\t\tif (!nextHint || nextHint === this.displayedHint) return;
\t\tconst now = Date.now();
\t\tif (!this.displayedHint || now - this.hintVisibleSince >= MIN_HINT_DISPLAY_MS) {
\t\t\tthis.displayedHint = nextHint;
\t\t\tthis.hintVisibleSince = now;
\t\t\tthis.pendingHint = undefined;
\t\t\tif (this.hintTimer) clearTimeout(this.hintTimer);
\t\t\tthis.hintTimer = undefined;
\t\t\treturn;
\t\t}
\n\t\tthis.pendingHint = nextHint;
\t\tif (this.hintTimer) return;
\t\tconst delay = MIN_HINT_DISPLAY_MS - (now - this.hintVisibleSince);
\t\tthis.hintTimer = setTimeout(() => {
\t\t\tthis.hintTimer = undefined;
\t\t\tif (!this.pendingHint) return;
\t\t\tthis.displayedHint = this.pendingHint;
\t\t\tthis.pendingHint = undefined;
\t\t\tthis.hintVisibleSince = Date.now();
\t\t\tthis.requestRender();
\t\t}, delay);
\t}

\tprivate isActive(): boolean {
\t\treturn this.entries.some((entry) => entry.status === "queued" || entry.status === "running");
\t}

\tprivate hasError(): boolean {
\t\treturn this.entries.some((entry) => entry.status === "error");
\t}

\tprivate getSummary(): string {
\t\tconst active = this.isActive();
\t\tconst counts: Record<ToolActivityKind, number> = { read: 0, search: 0, list: 0, bash: 0 };
\t\tfor (const entry of this.entries) counts[entry.kind] += 1;
\t\tconst parts: string[] = [];
\t\tif (counts.search > 0) parts.push(`${active ? "searching for" : "searched for"} ${counts.search} ${counts.search === 1 ? "pattern" : "patterns"}`);
\t\tif (counts.read > 0) parts.push(`${active ? "reading" : "read"} ${counts.read} ${counts.read === 1 ? "file" : "files"}`);
\t\tif (counts.list > 0) parts.push(`${active ? "listing" : "listed"} ${counts.list} ${counts.list === 1 ? "directory" : "directories"}`);
\t\tif (counts.bash > 0) parts.push(`${active ? "running" : "ran"} ${counts.bash} bash ${counts.bash === 1 ? "command" : "commands"}`);
\t\treturn capitalize(parts.join(", "));
\t}

\trender(width: number): string[] {
\t\tif (this.expanded) return this.entries.flatMap((entry) => entry.component.render(width));
\t\tif (this.entries.length === 0) return [];
\t\tconst active = this.isActive();
\t\tconst dot = active
\t\t\t? theme.fg("toolRunning", "●")
\t\t\t: this.hasError()
\t\t\t\t? theme.fg("toolError", "●")
\t\t\t\t: theme.fg("toolSuccess", "●");
\t\tconst summary = `${dot} ${this.getSummary()} ${keyHint("app.tools.expand", "to expand")}`;
\t\tconst lines = ["", truncateToWidth(summary, width, "…")];
\t\tif (active && this.displayedHint) {
\t\t\tlines.push(truncateToWidth(theme.fg("dim", `  ⎿  ${this.displayedHint}`), width, "…"));
\t\t}
\t\treturn lines;
\t}

\tinvalidate(): void {
\t\tfor (const entry of this.entries) entry.component.invalidate?.();
\t}

\tdispose(): void {
\t\tif (this.hintTimer) clearTimeout(this.hintTimer);
\t}
}
''',
        encoding="utf-8",
    )


def patch_interactive_mode() -> None:
    path = "packages/coding-agent/src/modes/interactive/interactive-mode.ts"
    replace_once(
        path,
        'import { ToolExecutionComponent } from "./components/tool-execution.ts";',
        '''import {
\tgetToolActivityKind,
\tToolActivityGroupComponent,
} from "./components/tool-activity-group.ts";
import { ToolExecutionComponent } from "./components/tool-execution.ts";''',
    )
    replace_once(
        path,
        '''\t// Tool execution tracking: toolCallId -> component
\tprivate pendingTools = new Map<string, ToolExecutionComponent>();
''',
        '''\t// Tool execution tracking: toolCallId -> component
\tprivate pendingTools = new Map<string, ToolExecutionComponent>();
\tprivate toolActivityGroups = new Map<string, ToolActivityGroupComponent>();
\tprivate activeToolActivityGroup: ToolActivityGroupComponent | undefined;
''',
    )
    replace_once(
        path,
        '\tprivate subscribeToAgent(): void {',
        '''\tprivate breakToolActivityGroup(): void {
\t\tthis.activeToolActivityGroup = undefined;
\t}

\tprivate resetToolActivityState(): void {
\t\tthis.toolActivityGroups.clear();
\t\tthis.activeToolActivityGroup = undefined;
\t}

\tprivate addToolExecutionToChat(
\t\ttoolName: string,
\t\ttoolCallId: string,
\t\targs: Record<string, unknown>,
\t\tcomponent: ToolExecutionComponent,
\t): void {
\t\tconst kind = getToolActivityKind(toolName, args);
\t\tif (!kind) {
\t\t\tthis.breakToolActivityGroup();
\t\t\tthis.chatContainer.addChild(component);
\t\t\treturn;
\t\t}

\t\tlet group = this.activeToolActivityGroup;
\t\tif (!group) {
\t\t\tgroup = new ToolActivityGroupComponent(() => this.ui.requestRender());
\t\t\tgroup.setExpanded(this.toolOutputExpanded);
\t\t\tthis.chatContainer.addChild(group);
\t\t\tthis.activeToolActivityGroup = group;
\t\t}
\t\tgroup.addTool({ toolCallId, toolName, args, kind, component });
\t\tthis.toolActivityGroups.set(toolCallId, group);
\t}

\tprivate updateToolActivityArgs(toolCallId: string, args: Record<string, unknown>): void {
\t\tconst group = this.toolActivityGroups.get(toolCallId);
\t\tif (!group) {
\t\t\tthis.breakToolActivityGroup();
\t\t\treturn;
\t\t}
\t\tgroup.updateArgs(toolCallId, args);
\t\tthis.activeToolActivityGroup = group;
\t}

\tprivate markToolActivityStarted(toolCallId: string): void {
\t\tthis.toolActivityGroups.get(toolCallId)?.markStarted(toolCallId);
\t}

\tprivate markToolActivityCompleted(toolCallId: string, isError: boolean): void {
\t\tthis.toolActivityGroups.get(toolCallId)?.markCompleted(toolCallId, isError);
\t}

\tprivate subscribeToAgent(): void {''',
    )

    replace_once(
        path,
        '''\t\t\tcase "agent_start":
\t\t\t\tthis.agentStartedAt = Date.now();
\t\t\t\tthis.pendingTools.clear();''',
        '''\t\t\tcase "agent_start":
\t\t\t\tthis.agentStartedAt = Date.now();
\t\t\t\tthis.pendingTools.clear();
\t\t\t\tthis.resetToolActivityState();''',
    )
    replace_once(
        path,
        '''\t\t\tcase "message_start":
\t\t\t\tif (event.message.role === "custom") {
\t\t\t\t\tthis.addMessageToChat(event.message);''',
        '''\t\t\tcase "message_start":
\t\t\t\tif (event.message.role === "custom") {
\t\t\t\t\tthis.breakToolActivityGroup();
\t\t\t\t\tthis.addMessageToChat(event.message);''',
    )
    replace_once(
        path,
        '''\t\t\t\t} else if (event.message.role === "user") {
\t\t\t\t\tthis.addMessageToChat(event.message);''',
        '''\t\t\t\t} else if (event.message.role === "user") {
\t\t\t\t\tthis.breakToolActivityGroup();
\t\t\t\t\tthis.addMessageToChat(event.message);''',
    )

    replace_once(
        path,
        '''\t\t\t\t\tfor (const content of this.streamingMessage.content) {
\t\t\t\t\t\tif (content.type === "toolCall") {
\t\t\t\t\t\t\tif (!this.pendingTools.has(content.id)) {
\t\t\t\t\t\t\t\tconst component = new ToolExecutionComponent(
\t\t\t\t\t\t\t\t\tcontent.name,
\t\t\t\t\t\t\t\t\tcontent.id,
\t\t\t\t\t\t\t\t\tcontent.arguments,
\t\t\t\t\t\t\t\t\t{
\t\t\t\t\t\t\t\t\t\tshowImages: this.settingsManager.getShowImages(),
\t\t\t\t\t\t\t\t\t\timageWidthCells: this.settingsManager.getImageWidthCells(),
\t\t\t\t\t\t\t\t\t},
\t\t\t\t\t\t\t\t\tthis.getRegisteredToolDefinition(content.name),
\t\t\t\t\t\t\t\t\tthis.ui,
\t\t\t\t\t\t\t\t\tthis.sessionManager.getCwd(),
\t\t\t\t\t\t\t\t);
\t\t\t\t\t\t\t\tcomponent.setExpanded(this.toolOutputExpanded);
\t\t\t\t\t\t\t\tthis.chatContainer.addChild(component);
\t\t\t\t\t\t\t\tthis.pendingTools.set(content.id, component);
\t\t\t\t\t\t\t} else {
\t\t\t\t\t\t\t\tconst component = this.pendingTools.get(content.id);
\t\t\t\t\t\t\t\tif (component) {
\t\t\t\t\t\t\t\t\tcomponent.updateArgs(content.arguments);
\t\t\t\t\t\t\t\t}
\t\t\t\t\t\t\t}
\t\t\t\t\t\t}
\t\t\t\t\t}''',
        '''\t\t\t\t\tfor (const content of this.streamingMessage.content) {
\t\t\t\t\t\tif (content.type === "text" && content.text.trim().length > 0) {
\t\t\t\t\t\t\tthis.breakToolActivityGroup();
\t\t\t\t\t\t\tcontinue;
\t\t\t\t\t\t}
\t\t\t\t\t\tif (content.type === "toolCall") {
\t\t\t\t\t\t\tif (!this.pendingTools.has(content.id)) {
\t\t\t\t\t\t\t\tconst component = new ToolExecutionComponent(
\t\t\t\t\t\t\t\t\tcontent.name,
\t\t\t\t\t\t\t\t\tcontent.id,
\t\t\t\t\t\t\t\t\tcontent.arguments,
\t\t\t\t\t\t\t\t\t{
\t\t\t\t\t\t\t\t\t\tshowImages: this.settingsManager.getShowImages(),
\t\t\t\t\t\t\t\t\t\timageWidthCells: this.settingsManager.getImageWidthCells(),
\t\t\t\t\t\t\t\t\t},
\t\t\t\t\t\t\t\t\tthis.getRegisteredToolDefinition(content.name),
\t\t\t\t\t\t\t\t\tthis.ui,
\t\t\t\t\t\t\t\t\tthis.sessionManager.getCwd(),
\t\t\t\t\t\t\t\t);
\t\t\t\t\t\t\t\tcomponent.setExpanded(this.toolOutputExpanded);
\t\t\t\t\t\t\t\tthis.addToolExecutionToChat(content.name, content.id, content.arguments, component);
\t\t\t\t\t\t\t\tthis.pendingTools.set(content.id, component);
\t\t\t\t\t\t\t} else {
\t\t\t\t\t\t\t\tconst component = this.pendingTools.get(content.id);
\t\t\t\t\t\t\t\tif (component) {
\t\t\t\t\t\t\t\t\tcomponent.updateArgs(content.arguments);
\t\t\t\t\t\t\t\t\tthis.updateToolActivityArgs(content.id, content.arguments);
\t\t\t\t\t\t\t\t}
\t\t\t\t\t\t\t}
\t\t\t\t\t\t}
\t\t\t\t\t}''',
    )

    replace_once(
        path,
        '''\t\t\t\t\t\tfor (const [, component] of this.pendingTools.entries()) {
\t\t\t\t\t\t\tcomponent.updateResult({
\t\t\t\t\t\t\t\tcontent: [{ type: "text", text: errorMessage }],
\t\t\t\t\t\t\t\tisError: true,
\t\t\t\t\t\t\t});
\t\t\t\t\t\t}''',
        '''\t\t\t\t\t\tfor (const [toolCallId, component] of this.pendingTools.entries()) {
\t\t\t\t\t\t\tcomponent.updateResult({
\t\t\t\t\t\t\t\tcontent: [{ type: "text", text: errorMessage }],
\t\t\t\t\t\t\t\tisError: true,
\t\t\t\t\t\t\t});
\t\t\t\t\t\t\tthis.markToolActivityCompleted(toolCallId, true);
\t\t\t\t\t\t}''',
    )
    replace_once(
        path,
        '''\t\t\t\t\tcomponent.setExpanded(this.toolOutputExpanded);
\t\t\t\t\tthis.chatContainer.addChild(component);
\t\t\t\t\tthis.pendingTools.set(event.toolCallId, component);''',
        '''\t\t\t\t\tcomponent.setExpanded(this.toolOutputExpanded);
\t\t\t\t\tthis.addToolExecutionToChat(event.toolName, event.toolCallId, event.args, component);
\t\t\t\t\tthis.pendingTools.set(event.toolCallId, component);''',
    )
    replace_once(
        path,
        '''\t\t\t\tcomponent.markExecutionStarted();
\t\t\t\tthis.ui.requestRender();''',
        '''\t\t\t\tcomponent.markExecutionStarted();
\t\t\t\tthis.markToolActivityStarted(event.toolCallId);
\t\t\t\tthis.ui.requestRender();''',
    )
    replace_once(
        path,
        '''\t\t\t\tif (component) {
\t\t\t\t\tcomponent.updateResult({ ...event.result, isError: event.isError });
\t\t\t\t\tthis.pendingTools.delete(event.toolCallId);''',
        '''\t\t\t\tif (component) {
\t\t\t\t\tcomponent.updateResult({ ...event.result, isError: event.isError });
\t\t\t\t\tthis.markToolActivityCompleted(event.toolCallId, event.isError);
\t\t\t\t\tthis.pendingTools.delete(event.toolCallId);''',
    )
    replace_once(
        path,
        '''\t\t\t\tthis.pendingTools.clear();

\t\t\t\tthis.ui.requestRender();''',
        '''\t\t\t\tthis.pendingTools.clear();
\t\t\t\tthis.resetToolActivityState();

\t\t\t\tthis.ui.requestRender();''',
    )

    replace_once(
        path,
        '''\tprivate renderSessionItems(
\t\titems: readonly RenderSessionItem[],
\t\toptions: { updateFooter?: boolean; populateHistory?: boolean } = {},
\t): void {
\t\tthis.pendingTools.clear();''',
        '''\tprivate renderSessionItems(
\t\titems: readonly RenderSessionItem[],
\t\toptions: { updateFooter?: boolean; populateHistory?: boolean } = {},
\t): void {
\t\tthis.pendingTools.clear();
\t\tthis.resetToolActivityState();''',
    )
    replace_once(
        path,
        '''\t\tfor (const item of items) {
\t\t\tif (isCustomSessionEntry(item)) {
\t\t\t\tthis.addCustomEntryToChat(item);''',
        '''\t\tfor (const item of items) {
\t\t\tif (isCustomSessionEntry(item)) {
\t\t\t\tthis.breakToolActivityGroup();
\t\t\t\tthis.addCustomEntryToChat(item);''',
    )

    replace_regex_once(
        path,
        r'''\t\t\tif \(message\.role === "assistant"\) \{.*?\t\t\t\} else if \(message\.role === "toolResult"\) \{.*?\t\t\t\} else \{
\t\t\t\t// All other messages use standard rendering
\t\t\t\tthis\.addMessageToChat\(message, options\);
\t\t\t\}''',
        r'''\t\t\tif (message.role === "assistant") {
\t\t\t\tconst firstToolIndex = message.content.findIndex((content) => content.type === "toolCall");
\t\t\t\tlet lastToolIndex = -1;
\t\t\t\tfor (let index = message.content.length - 1; index >= 0; index -= 1) {
\t\t\t\t\tif (message.content[index]?.type === "toolCall") {
\t\t\t\t\t\tlastToolIndex = index;
\t\t\t\t\t\tbreak;
\t\t\t\t\t}
\t\t\t\t}
\t\t\t\tconst hasTextBeforeTools = message.content
\t\t\t\t\t.slice(0, firstToolIndex < 0 ? message.content.length : firstToolIndex)
\t\t\t\t\t.some((content) => content.type === "text" && content.text.trim().length > 0);
\t\t\t\tconst hasTextAfterTools =
\t\t\t\t\tlastToolIndex >= 0 &&
\t\t\t\t\tmessage.content
\t\t\t\t\t\t.slice(lastToolIndex + 1)
\t\t\t\t\t\t.some((content) => content.type === "text" && content.text.trim().length > 0);
\t\t\t\tif (firstToolIndex < 0 || hasTextBeforeTools) this.breakToolActivityGroup();
\t\t\t\tthis.addMessageToChat(message);
\t\t\t\tfor (const content of message.content) {
\t\t\t\t\tif (content.type === "toolCall") {
\t\t\t\t\t\tconst component = new ToolExecutionComponent(
\t\t\t\t\t\t\tcontent.name,
\t\t\t\t\t\t\tcontent.id,
\t\t\t\t\t\t\tcontent.arguments,
\t\t\t\t\t\t\t{
\t\t\t\t\t\t\t\tshowImages: this.settingsManager.getShowImages(),
\t\t\t\t\t\t\t\timageWidthCells: this.settingsManager.getImageWidthCells(),
\t\t\t\t\t\t\t},
\t\t\t\t\t\t\tthis.getRegisteredToolDefinition(content.name),
\t\t\t\t\t\t\tthis.ui,
\t\t\t\t\t\t\tthis.sessionManager.getCwd(),
\t\t\t\t\t\t);
\t\t\t\t\t\tcomponent.setExpanded(this.toolOutputExpanded);
\t\t\t\t\t\tthis.addToolExecutionToChat(content.name, content.id, content.arguments, component);

\t\t\t\t\t\tif (message.stopReason === "aborted" || message.stopReason === "error") {
\t\t\t\t\t\t\tlet errorMessage: string;
\t\t\t\t\t\t\tif (message.stopReason === "aborted") {
\t\t\t\t\t\t\t\tconst retryAttempt = this.session.retryAttempt;
\t\t\t\t\t\t\t\terrorMessage =
\t\t\t\t\t\t\t\t\tretryAttempt > 0
\t\t\t\t\t\t\t\t\t\t? `Aborted after ${retryAttempt} retry attempt${retryAttempt > 1 ? "s" : ""}`
\t\t\t\t\t\t\t\t\t\t: "Operation aborted";
\t\t\t\t\t\t\t} else {
\t\t\t\t\t\t\t\terrorMessage = message.errorMessage || "Error";
\t\t\t\t\t\t\t}
\t\t\t\t\t\t\tcomponent.updateResult({ content: [{ type: "text", text: errorMessage }], isError: true });
\t\t\t\t\t\t\tthis.markToolActivityCompleted(content.id, true);
\t\t\t\t\t\t} else {
\t\t\t\t\t\t\trenderedPendingTools.set(content.id, component);
\t\t\t\t\t\t}
\t\t\t\t\t}
\t\t\t\t}
\t\t\t\tif (hasTextAfterTools) this.breakToolActivityGroup();
\t\t\t\tif (message.stopReason !== "aborted" && message.stopReason !== "error") {
\t\t\t\t\tconst miss = cacheMisses.get(message);
\t\t\t\t\tif (miss) this.addCacheMissNotice(miss);
\t\t\t\t}
\t\t\t} else if (message.role === "toolResult") {
\t\t\t\tconst component = renderedPendingTools.get(message.toolCallId);
\t\t\t\tif (component) {
\t\t\t\t\tcomponent.updateResult(message);
\t\t\t\t\tthis.markToolActivityCompleted(message.toolCallId, message.isError);
\t\t\t\t\trenderedPendingTools.delete(message.toolCallId);
\t\t\t\t}
\t\t\t} else {
\t\t\t\tthis.breakToolActivityGroup();
\t\t\t\tthis.addMessageToChat(message, options);
\t\t\t}''',
    )


def patch_tests() -> None:
    path = "packages/coding-agent/test/bash-command-rendering.test.ts"
    replace_once(
        path,
        'it("compacts multiline and long calls to one line until expanded", () => {',
        'it("uses Claude-style two-line and 160-column Bash previews until expanded", () => {',
    )
    replace_once(
        path,
        '''\t\tconst compactMultiline = renderLines(definition.renderCall?.({ command: multilineCommand }, theme, context));
\t\texpect(compactMultiline).toHaveLength(1);
\t\texpect(compactMultiline[0]).toContain("printf 'first\\\\n'");
\t\texpect(compactMultiline[0]).toContain("printf 'second\\\\n'");

\t\tconst longCommand = `echo ${"x".repeat(180)}`;
\t\tconst compactLong = renderLines(definition.renderCall?.({ command: longCommand }, theme, context));
\t\texpect(compactLong).toHaveLength(1);
\t\texpect(compactLong[0]?.length).toBeLessThanOrEqual(120);
\t\texpect(compactLong[0]).not.toContain(longCommand);''',
        '''\t\tconst compactMultiline = renderLines(definition.renderCall?.({ command: multilineCommand }, theme, context));
\t\texpect(compactMultiline).toHaveLength(2);
\t\texpect(compactMultiline[0]).toContain("printf 'first\\\\n'");
\t\texpect(compactMultiline[1]).toContain("printf 'second\\\\n'");

\t\tconst longCommand = `echo ${"x".repeat(180)}`;
\t\tconst compactLong = renderLines(definition.renderCall?.({ command: longCommand }, theme, context));
\t\texpect(compactLong).toHaveLength(1);
\t\texpect(compactLong[0]?.length).toBeLessThanOrEqual(160);
\t\texpect(compactLong[0]).not.toContain(longCommand);''',
    )

    new_test = ROOT / "packages/coding-agent/test/claude-tool-display.test.ts"
    new_test.write_text(
        '''import { Text } from "@earendil-works/pi-tui";
import { describe, expect, it } from "vitest";
import { createAllToolDefinitions } from "../src/core/tools/index.ts";
import {
\tgetToolActivityKind,
\tToolActivityGroupComponent,
} from "../src/modes/interactive/components/tool-activity-group.ts";
import { initTheme, theme } from "../src/modes/interactive/theme/theme.ts";
import { stripAnsi } from "../src/utils/ansi.ts";

initTheme("dark");

function context(args: Record<string, unknown>, overrides: Record<string, unknown> = {}): any {
\treturn {
\t\targs,
\t\ttoolCallId: "tool-call",
\t\tinvalidate: () => {},
\t\tlastComponent: undefined,
\t\tstate: {},
\t\tcwd: process.cwd(),
\t\texecutionStarted: true,
\t\targsComplete: true,
\t\tisPartial: false,
\t\texpanded: false,
\t\tshowImages: false,
\t\tisError: false,
\t\t...overrides,
\t};
}

function render(component: { render(width: number): string[] } | undefined): string {
\treturn (component?.render(200) ?? []).map(stripAnsi).join("\n");
}

describe("Claude-style tool presentation", () => {
\tit("renders Read results as metadata instead of repeating file contents", () => {
\t\tconst definition = createAllToolDefinitions(process.cwd()).read;
\t\tconst component = definition.renderResult?.(
\t\t\t{
\t\t\t\tcontent: [{ type: "text", text: "secret file body" }],
\t\t\t\tdetails: { kind: "text", linesRead: 12 },
\t\t\t},
\t\t\t{ expanded: false, isPartial: false },
\t\t\ttheme,
\t\t\tcontext({ path: "src/a.ts" }),
\t\t);
\t\tconst output = render(component);
\t\texpect(output).toContain("Read 12 lines");
\t\texpect(output).not.toContain("secret file body");
\t});

\tit("renders search results as counts until expanded", () => {
\t\tconst definition = createAllToolDefinitions(process.cwd()).grep;
\t\tconst collapsed = definition.renderResult?.(
\t\t\t{
\t\t\t\tcontent: [{ type: "text", text: "a.ts:1: hit\nb.ts:2: hit" }],
\t\t\t\tdetails: { matchCount: 2, fileCount: 2 },
\t\t\t},
\t\t\t{ expanded: false, isPartial: false },
\t\t\ttheme,
\t\t\tcontext({ pattern: "hit" }),
\t\t);
\t\tconst collapsedOutput = render(collapsed);
\t\texpect(collapsedOutput).toContain("Found 2 matches across 2 files");
\t\texpect(collapsedOutput).not.toContain("a.ts:1");

\t\tconst expanded = definition.renderResult?.(
\t\t\t{
\t\t\t\tcontent: [{ type: "text", text: "a.ts:1: hit\nb.ts:2: hit" }],
\t\t\t\tdetails: { matchCount: 2, fileCount: 2 },
\t\t\t},
\t\t\t{ expanded: true, isPartial: false },
\t\t\ttheme,
\t\t\tcontext({ pattern: "hit" }, { expanded: true }),
\t\t);
\t\texpect(render(expanded)).toContain("a.ts:1: hit");
\t});

\tit("groups consecutive reads, searches, listings, and Bash calls", () => {
\t\tconst group = new ToolActivityGroupComponent(() => {});
\t\tgroup.addTool({
\t\t\ttoolCallId: "read-1",
\t\t\ttoolName: "read",
\t\t\targs: { path: "src/a.ts" },
\t\t\tkind: "read",
\t\t\tcomponent: new Text("read src/a.ts", 0, 0),
\t\t});
\t\tgroup.addTool({
\t\t\ttoolCallId: "grep-1",
\t\t\ttoolName: "grep",
\t\t\targs: { pattern: "renderToolUse" },
\t\t\tkind: "search",
\t\t\tcomponent: new Text("grep renderToolUse", 0, 0),
\t\t});
\t\tgroup.markStarted("grep-1");
\t\tlet output = render(group);
\t\texpect(output).toContain("Searching for 1 pattern, reading 1 file");
\t\texpect(output).toContain("renderToolUse");

\t\tgroup.markCompleted("read-1", false);
\t\tgroup.markCompleted("grep-1", false);
\t\toutput = render(group);
\t\texpect(output).toContain("Searched for 1 pattern, read 1 file");

\t\tgroup.setExpanded(true);
\t\toutput = render(group);
\t\texpect(output).toContain("read src/a.ts");
\t\texpect(output).toContain("grep renderToolUse");
\t});

\tit("classifies Bash calls using Claude's read/search/list categories", () => {
\t\texpect(getToolActivityKind("bash", { command: "rg renderToolUse src" })).toBe("search");
\t\texpect(getToolActivityKind("bash", { command: "cat package.json | jq .name" })).toBe("read");
\t\texpect(getToolActivityKind("bash", { command: "ls -la" })).toBe("list");
\t\texpect(getToolActivityKind("bash", { command: "npm test" })).toBe("bash");
\t});
});
''',
        encoding="utf-8",
    )


def main() -> None:
    patch_index()
    patch_bash()
    patch_read()
    patch_grep()
    patch_find()
    patch_ls()
    create_group_component()
    patch_interactive_mode()
    patch_tests()
    print("Claude tool display parity patch applied")


if __name__ == "__main__":
    main()
