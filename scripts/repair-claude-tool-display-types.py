#!/usr/bin/env python3
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    (ROOT / path).write_text(content, encoding="utf-8")


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
# The first migration can miss this field when upstream formatting differs.
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


# Agent tool results may contain SDK-only file blocks. The terminal renderer
# supports text and images, so narrow at the UI boundary instead of casting the
# broader result through the component's contract.
interactive_path = "packages/coding-agent/src/modes/interactive/interactive-mode.ts"
interactive = read(interactive_path)
old = '''\t\t\t\t\tcomponent.updateResult({ ...event.result, isError: event.isError });'''
new = '''\t\t\t\t\tconst displayContent = event.result.content.filter(
\t\t\t\t\t\t(
\t\t\t\t\t\t\tcontent,
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
write(interactive_path, interactive.replace(old, new, 1))

print("Claude tool display type contracts repaired")
