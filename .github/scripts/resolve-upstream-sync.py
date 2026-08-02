#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path


def run(*args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(args, check=check, text=True, capture_output=True)


def checkout(side: str, *paths: str) -> None:
    run("git", "checkout", f"--{side}", "--", *paths)


def replace_conflicts(path: str, replacements: list[str]) -> None:
    file = Path(path)
    text = file.read_text()
    result: list[str] = []
    cursor = 0
    index = 0
    pattern = re.compile(r"^<<<<<<< HEAD\n(.*?)^=======\n(.*?)^>>>>>>> upstream/main\n?", re.M | re.S)
    for match in pattern.finditer(text):
        if index >= len(replacements):
            raise RuntimeError(f"Unexpected extra conflict block in {path}")
        result.append(text[cursor : match.start()])
        replacement = replacements[index]
        result.append(replacement)
        if replacement and not replacement.endswith("\n"):
            result.append("\n")
        cursor = match.end()
        index += 1
    result.append(text[cursor:])
    if index != len(replacements):
        raise RuntimeError(f"Expected {len(replacements)} conflict blocks in {path}, found {index}")
    file.write_text("".join(result))


def stage_text(stage: int, path: str) -> str:
    return run("git", "show", f":{stage}:{path}").stdout


# Local versions already contain the upstream Markdown transformer work plus
# Claude-style markers/alignment, so taking ours loses no upstream behavior.
checkout(
    "ours",
    "packages/coding-agent/src/modes/interactive/components/assistant-message.ts",
    "packages/coding-agent/src/modes/interactive/components/user-message.ts",
    "packages/coding-agent/README.md",
    "packages/coding-agent/docs/themes.md",
)

# Use upstream examples because they contain the new ModelRuntime dispatch path,
# then point them at the forked package identity.
example_paths = [
    "packages/coding-agent/examples/extensions/custom-compaction.ts",
    "packages/coding-agent/examples/extensions/handoff.ts",
    "packages/coding-agent/examples/extensions/qna.ts",
    "packages/coding-agent/examples/sdk/02-custom-model.ts",
]
checkout("theirs", *example_paths)
for path in example_paths:
    file = Path(path)
    file.write_text(file.read_text().replace("@earendil-works/pi-coding-agent", "@doubleflower/pi-claude"))

# Preserve the pi-claude README, but union local and upstream unreleased notes.
changelog_path = "packages/coding-agent/CHANGELOG.md"
local_changelog = stage_text(2, changelog_path)
upstream_changelog = stage_text(3, changelog_path)
upstream_unreleased = upstream_changelog.split("## [0.83.0]", 1)[0]
upstream_bullets = [line for line in upstream_unreleased.splitlines() if line.startswith("- ")]
missing_bullets = [line for line in upstream_bullets if line not in local_changelog]
if missing_bullets:
    insertion = "\n### Upstream changes\n\n" + "\n".join(missing_bullets) + "\n"
    local_changelog = local_changelog.replace("\n## [0.83.0]", insertion + "\n## [0.83.0]", 1)
Path(changelog_path).write_text(local_changelog)

# Keep local theme documentation and document the new fullscreen scrollbar token.
themes_doc = Path("packages/coding-agent/docs/themes.md")
themes_text = themes_doc.read_text()
themes_text = themes_text.replace(
    "`assistantMarker`, `thinkingMax`, `toolRunning`, `toolSuccess`, and `toolError` are optional",
    "`assistantMarker`, `thinkingMax`, `toolRunning`, `toolSuccess`, `toolError`, and `scrollbarThumb` are optional",
)
themes_text = themes_text.replace(
    "`text`, `thinkingXhigh`, `warning`, `success`, and `error`, respectively.",
    "`text`, `thinkingXhigh`, `warning`, `success`, `error`, and `selectedBg`, respectively.",
)
if "| `scrollbarThumb` |" not in themes_text:
    themes_text = themes_text.replace(
        "| `selectedBg` |",
        "| `selectedBg` |",
        1,
    )
    marker = "| `selectedBg` |"
    line_start = themes_text.find(marker)
    if line_start >= 0:
        line_end = themes_text.find("\n", line_start)
        themes_text = (
            themes_text[: line_end + 1]
            + "| `scrollbarThumb` | Fullscreen transcript scrollbar thumb; optional, falls back to `selectedBg` |\n"
            + themes_text[line_end + 1 :]
        )
themes_doc.write_text(themes_text)

# Merge the new fullscreen UI selector with the published-runtime compatibility adapter
# and preserve --alt as a legacy alias.
interactive_path = "packages/coding-agent/src/modes/interactive/interactive-mode.ts"
replace_conflicts(
    interactive_path,
    [
        '\tif (options.alt || options.uiMode === "fullscreen") {\n'
        '\t\treturn createAltScreenTui(terminal, options.showHardwareCursor, options.logDirectory, { openUrl: openBrowser });\n'
    ],
)
interactive = Path(interactive_path)
interactive_text = interactive.read_text()
interactive_text = interactive_text.replace("\n\tTuiAltScreen,", "").replace("\n\tTuiMainScreen,", "")
interactive_text = interactive_text.replace(
    "interface InteractiveTuiOptions {\n\tuiMode: UiMode;",
    "interface InteractiveTuiOptions {\n\t/** Legacy alias for fullscreen mode. */\n\talt?: boolean;\n\tuiMode: UiMode;",
)
interactive_text = interactive_text.replace(
    "interface InteractiveTuiOptions {\n\talt: boolean;",
    "interface InteractiveTuiOptions {\n\t/** Legacy alias for fullscreen mode. */\n\talt?: boolean;\n\tuiMode: UiMode;",
)
if "uiMode?: UiMode;" not in interactive_text:
    interactive_text = interactive_text.replace(
        "\t/** Use the alternate-screen TUI renderer. */\n\talt?: boolean;",
        "\t/** Legacy alias for fullscreen UI mode. */\n\talt?: boolean;\n\t/** UI layout mode. */\n\tuiMode?: UiMode;",
    )
interactive.write_text(interactive_text)

# Union local Claude marker/tool colors with upstream fullscreen scrollbar color.
replace_conflicts(
    "packages/coding-agent/src/modes/interactive/theme/theme-schema.json",
    [
        '\t\t\t"description": "Theme color definitions (assistantMarker, thinkingMax, toolRunning, toolSuccess, toolError, and scrollbarThumb are optional and use compatible fallbacks)",\n'
    ],
)
replace_conflicts(
    "packages/coding-agent/src/modes/interactive/theme/theme.ts",
    [
        "\t\tassistantMarker: Type.Optional(ColorValueSchema),\n"
        "\t\t// Backgrounds & Content Text (11 required, 4 optional)\n",
        "function withThemeColorFallbacks(colors: ThemeJson[\"colors\"]): ThemeJson[\"colors\"] & {\n"
        "\tassistantMarker: ColorValue;\n"
        "\tthinkingMax: ColorValue;\n"
        "\ttoolRunning: ColorValue;\n"
        "\ttoolSuccess: ColorValue;\n"
        "\ttoolError: ColorValue;\n"
        "\tscrollbarThumb: ColorValue;\n"
        "} {\n"
        "\treturn {\n"
        "\t\t...colors,\n"
        "\t\tassistantMarker: colors.assistantMarker ?? colors.text,\n"
        "\t\tthinkingMax: colors.thinkingMax ?? colors.thinkingXhigh,\n"
        "\t\ttoolRunning: colors.toolRunning ?? colors.warning,\n"
        "\t\ttoolSuccess: colors.toolSuccess ?? colors.success,\n"
        "\t\ttoolError: colors.toolError ?? colors.error,\n"
        "\t\tscrollbarThumb: colors.scrollbarThumb ?? colors.selectedBg,\n",
        "\t\tfgColors: ThemeForegroundColors,\n"
        "\t\tbgColors: Record<Exclude<ThemeBg, \"scrollbarThumb\">, string | number> &\n"
        "\t\t\tPartial<Record<\"scrollbarThumb\", string | number>>,\n",
    ],
)

# New server paths should use the forked coding-agent package, not install a second agent runtime.
checkout("theirs", "packages/server/package.json")
server_package = Path("packages/server/package.json")
server_data = json.loads(server_package.read_text())
dependencies = server_data.setdefault("dependencies", {})
dependencies.pop("@earendil-works/pi-coding-agent", None)
dependencies["@doubleflower/pi-claude"] = "^0.83.3"
server_data["dependencies"] = dict(sorted(dependencies.items()))
server_package.write_text(json.dumps(server_data, ensure_ascii=False, indent="\t") + "\n")
for file in Path("packages/server/src").rglob("*.ts"):
    file.write_text(file.read_text().replace("@earendil-works/pi-coding-agent", "@doubleflower/pi-claude"))

# Keep both package aliases: upstream sources/examples can compile while published server code uses pi-claude.
replace_conflicts(
    "tsconfig.json",
    [
        '\t\t\t"@doubleflower/pi-claude": ["./packages/coding-agent/src/index.ts"],\n'
        '\t\t\t"@doubleflower/pi-claude/hooks": ["./packages/coding-agent/src/core/hooks/index.ts"],\n'
        '\t\t\t"@doubleflower/pi-claude/*": ["./packages/coding-agent/src/*"],\n'
        '\t\t\t"@earendil-works/pi-coding-agent": ["./packages/coding-agent/src/index.ts"],\n'
        '\t\t\t"@earendil-works/pi-coding-agent/hooks": ["./packages/coding-agent/src/core/hooks/index.ts"],\n'
        '\t\t\t"@earendil-works/pi-coding-agent/*": ["./packages/coding-agent/src/*"],\n'
        '\t\t\t"@earendil-works/pi-protocol": ["./packages/protocol/src/index.ts"],\n'
        '\t\t\t"@earendil-works/pi-protocol/*": ["./packages/protocol/src/*"],\n'
        '\t\t\t"@earendil-works/pi-client": ["./packages/client/src/index.ts"],\n'
        '\t\t\t"@earendil-works/pi-client/*": ["./packages/client/src/*"],\n'
    ],
)

# Lock files are regenerated from the reconciled manifests.
Path("package-lock.json").unlink(missing_ok=True)
Path("packages/coding-agent/install-lock/package-lock.json").unlink(missing_ok=True)

# Remove temporary analysis artifacts from the final merge branch.
for path in [
    ".upstream-sync-status.txt",
    ".upstream-sync-conflicts.md",
    ".upstream-sync-conflicts.diff",
    ".github/workflows/upstream-sync-discover.yml",
    ".github/scripts/resolve-upstream-sync.py",
]:
    Path(path).unlink(missing_ok=True)

# Fail before dependency work if any conflict marker or unmerged index entry remains.
remaining = run("git", "ls-files", "-u").stdout.strip()
# Removed locks remain in the unmerged index until staged; stage all semantic resolutions first.
run("git", "add", "-A")
remaining = run("git", "ls-files", "-u").stdout.strip()
if remaining:
    raise RuntimeError(f"Unresolved merge entries remain:\n{remaining}")
for file in Path(".").rglob("*"):
    if not file.is_file() or ".git" in file.parts:
        continue
    try:
        text = file.read_text()
    except (UnicodeDecodeError, OSError):
        continue
    if "<<<<<<< HEAD" in text or ">>>>>>> upstream/main" in text:
        raise RuntimeError(f"Conflict marker remains in {file}")
