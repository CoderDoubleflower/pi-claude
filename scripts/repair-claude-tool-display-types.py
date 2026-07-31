#!/usr/bin/env python3
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    (ROOT / path).write_text(content, encoding="utf-8")


def replace_region(path: str, start: str, end: str, replacement: str) -> None:
    content = read(path)
    start_index = content.index(start)
    end_index = content.index(end, start_index)
    write(path, content[:start_index] + replacement + content[end_index:])


# Keep the no-match Grep result's content discriminant literal. Without this,
# the Promise resolve expression widens `type` to string before the ToolResult
# assertion and tsgo correctly rejects it.
grep_path = "packages/coding-agent/src/core/tools/grep.ts"
grep = read(grep_path)
grep, grep_count = re.subn(
    r'content: \[\{ type: "text", text: "No matches found" \}\],\s*details: \{ matchCount: 0, fileCount: 0 \}',
    'content: [{ type: "text" as const, text: "No matches found" }], details: { matchCount: 0, fileCount: 0 }',
    grep,
    count=1,
)
if grep_count != 1:
    raise RuntimeError(f"expected one Grep no-match result, found {grep_count}")
write(grep_path, grep)


# Force the persisted entry count into the public Ls result details contract.
ls_path = "packages/coding-agent/src/core/tools/ls.ts"
ls = read(ls_path)
ls, ls_count = re.subn(
    r'export interface LsToolDetails \{.*?\n\}',
    '''export interface LsToolDetails {
\ttruncation?: TruncationResult;
\tentryLimitReached?: number;
\tentryCount?: number;
}''',
    ls,
    count=1,
    flags=re.S,
)
if ls_count != 1:
    raise RuntimeError(f"expected one LsToolDetails interface, found {ls_count}")
write(ls_path, ls)


# `erasableSyntaxOnly` rejects parameter properties. Keep ordinary fields and
# constructors, and provide the Component.invalidate contract explicitly.
index_path = "packages/coding-agent/src/core/tools/index.ts"
index = read(index_path)
old_index = '''class ClaudeBashCallComponent implements Component {
\tconstructor(private readonly lines: string[]) {}
'''
new_index = '''class ClaudeBashCallComponent implements Component {
\tprivate readonly lines: string[];

\tconstructor(lines: string[]) {
\t\tthis.lines = lines;
\t}
'''
if index.count(old_index) != 1:
    raise RuntimeError(f"expected one ClaudeBashCallComponent constructor, found {index.count(old_index)}")
index = index.replace(old_index, new_index, 1)
insert_before = '''\t}
}

function createBashDisplayToolDefinition'''
invalidate_block = '''\t}

\tinvalidate(): void {}
}

function createBashDisplayToolDefinition'''
if index.count(insert_before) != 1:
    raise RuntimeError(f"expected one Bash component class ending, found {index.count(insert_before)}")
write(index_path, index.replace(insert_before, invalidate_block, 1))


group_path = "packages/coding-agent/src/modes/interactive/components/tool-activity-group.ts"
group = read(group_path)
old_group = '''\tconstructor(private readonly requestRender: () => void) {}
'''
new_group = '''\tprivate readonly requestRender: () => void;

\tconstructor(requestRender: () => void) {
\t\tthis.requestRender = requestRender;
\t}
'''
if group.count(old_group) != 1:
    raise RuntimeError(f"expected one ToolActivityGroup constructor, found {group.count(old_group)}")
write(group_path, group.replace(old_group, new_group, 1))


# Preserve the existing Read tool result contract: ordinary successful reads
# historically return details=undefined. Derive UI metadata from content and
# reserve details for actual truncation information.
read_path = "packages/coding-agent/src/core/tools/read.ts"
read_tool = read(read_path)
read_tool, image_details_count = re.subn(
    r'\n\s*details = \{\s*kind: "image",\s*imageMimeType: processed\.ok \? processed\.mimeType : mimeType,\s*imageBytes: buffer\.byteLength,\s*\};',
    '',
    read_tool,
    count=1,
    flags=re.S,
)
read_tool, text_details_count = re.subn(
    r'\n\s*details = \{\s*\.\.\.details,\s*kind: "text",\s*linesRead: truncation\.firstLineExceedsLimit \? 0 : truncation\.outputLines,\s*\};',
    '',
    read_tool,
    count=1,
    flags=re.S,
)
if image_details_count != 1 or text_details_count != 1:
    raise RuntimeError(
        f"expected one image and text Read metadata assignment, found image={image_details_count}, text={text_details_count}"
    )
write(read_path, read_tool)
replace_region(
    read_path,
    "function formatReadResult(",
    "export function createReadToolDefinition",
    r'''function formatReadResult(
	result: { content: (TextContent | ImageContent)[]; details?: ReadToolDetails },
	theme: Theme,
	isError: boolean,
): string {
	const textOutput = result.content
		.filter((content): content is TextContent => content.type === "text")
		.map((content) => content.text)
		.join("\n")
		.trim();
	if (isError) return textOutput ? `\n${theme.fg("error", textOutput)}` : "";

	const image = result.content.find((content): content is ImageContent => content.type === "image");
	const details = result.details;
	let summary: string;
	if (image) {
		const approximateBytes = Math.floor((image.data.length * 3) / 4);
		summary = `Read image [${image.mimeType}] (${formatSize(approximateBytes)})`;
	} else {
		const linesRead = details?.linesRead ?? (textOutput === "" ? 0 : textOutput.split("\n").length);
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


# Agent tool results may contain SDK-only file blocks. The terminal renderer
# supports text and images, so narrow at the UI boundary. The historical
# rendering regression tests intentionally borrow class methods onto a minimal
# object, so all newly introduced UI helpers need runtime-safe fallbacks.
interactive_path = "packages/coding-agent/src/modes/interactive/interactive-mode.ts"
interactive = read(interactive_path)
old = '''\t\t\t\t\tcomponent.updateResult({ ...event.result, isError: event.isError });'''
new = '''\t\t\t\t\tconst displayContent = event.result.content.filter(
\t\t\t\t\t\t(
\t\t\t\t\t\t\tcontent: (typeof event.result.content)[number],
\t\t\t\t\t\t): content is Extract<(typeof event.result.content)[number], { type: "text" | "image" }> =>
\t\t\t\t\t\t\tcontent.type === "text" || content.type === "image",
\t\t\t\t\t);
\t\t\t\t\tcomponent.updateResult({
\t\t\t\t\t\tcontent: displayContent,
\t\t\t\t\t\tdetails: event.result.details,
\t\t\t\t\t\tisError: event.isError,
\t\t\t\t\t});'''
if interactive.count(old) != 1:
    raise RuntimeError(f"expected one tool_execution_end result update, found {interactive.count(old)}")
interactive = interactive.replace(old, new, 1)

# Guard helper calls used by borrowed methods in regression tests.
for method in (
    "resetToolActivityState",
    "breakToolActivityGroup",
    "markToolActivityStarted",
    "markToolActivityCompleted",
    "updateToolActivityArgs",
):
    pattern = rf'(?P<indent>^[ \t]*)this\.{method}\((?P<args>[^;]*)\);'
    replacement = rf'\g<indent>if (typeof this.{method} === "function") this.{method}(\g<args>);'
    interactive, _ = re.subn(pattern, replacement, interactive, flags=re.M)

content_call = 'this.addToolExecutionToChat(content.name, content.id, content.arguments, component);'
content_fallback = '''if (typeof this.addToolExecutionToChat === "function") {
\t\t\t\t\t\tthis.addToolExecutionToChat(content.name, content.id, content.arguments, component);
\t\t\t\t\t} else {
\t\t\t\t\t\tthis.chatContainer.addChild(component);
\t\t\t\t\t}'''
if content_call not in interactive:
    raise RuntimeError("expected at least one content tool activity insertion")
interactive = interactive.replace(content_call, content_fallback)

event_call = 'this.addToolExecutionToChat(event.toolName, event.toolCallId, event.args, component);'
event_fallback = '''if (typeof this.addToolExecutionToChat === "function") {
\t\t\t\t\tthis.addToolExecutionToChat(event.toolName, event.toolCallId, event.args, component);
\t\t\t\t} else {
\t\t\t\t\tthis.chatContainer.addChild(component);
\t\t\t\t}'''
if event_call not in interactive:
    raise RuntimeError("expected one event tool activity insertion")
interactive = interactive.replace(event_call, event_fallback)
write(interactive_path, interactive)

print("Claude tool display type and compatibility contracts repaired")
