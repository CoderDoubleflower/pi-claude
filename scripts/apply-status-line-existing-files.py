from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    if old not in text:
        raise SystemExit(f"Expected anchor not found in {path}: {old[:120]!r}")
    file.write_text(text.replace(old, new, 1))


settings_path = "packages/coding-agent/src/core/settings-manager.ts"
replace_once(
    settings_path,
    '''export interface MarkdownSettings {
\tcodeBlockIndent?: string; // default: "  "
}

export interface WarningSettings {''',
    '''export interface MarkdownSettings {
\tcodeBlockIndent?: string; // default: "  "
}

export interface StatusLineSettings {
\ttype: "command";
\tcommand: string;
\tpadding?: number;
\trefreshInterval?: number;
}

export interface WarningSettings {''',
)
replace_once(
    settings_path,
    '''\ttheme?: string;
\tcompaction?: CompactionSettings;''',
    '''\ttheme?: string;
\tstatusLine?: StatusLineSettings;
\tcompaction?: CompactionSettings;''',
)
replace_once(
    settings_path,
    '''\tsetTheme(theme: string): void {
\t\tthis.globalSettings.theme = theme;
\t\tthis.markModified("theme");
\t\tthis.save();
\t}

\tgetDefaultThinkingLevel(): ThinkingLevel | undefined {''',
    '''\tsetTheme(theme: string): void {
\t\tthis.globalSettings.theme = theme;
\t\tthis.markModified("theme");
\t\tthis.save();
\t}

\tgetStatusLine(): StatusLineSettings | undefined {
\t\tconst statusLine = this.settings.statusLine;
\t\tif (
\t\t\t!statusLine ||
\t\t\tstatusLine.type !== "command" ||
\t\t\ttypeof statusLine.command !== "string" ||
\t\t\tstatusLine.command.trim().length === 0
\t\t) {
\t\t\treturn undefined;
\t\t}

\t\tconst padding =
\t\t\ttypeof statusLine.padding === "number" && Number.isFinite(statusLine.padding)
\t\t\t\t? Math.max(0, Math.floor(statusLine.padding))
\t\t\t\t: undefined;
\t\tconst refreshInterval =
\t\t\ttypeof statusLine.refreshInterval === "number" && Number.isFinite(statusLine.refreshInterval)
\t\t\t\t? Math.max(1, Math.floor(statusLine.refreshInterval))
\t\t\t\t: undefined;

\t\treturn {
\t\t\ttype: "command",
\t\t\tcommand: statusLine.command,
\t\t\t...(padding !== undefined && { padding }),
\t\t\t...(refreshInterval !== undefined && { refreshInterval }),
\t\t};
\t}

\tgetDefaultThinkingLevel(): ThinkingLevel | undefined {''',
)

footer_path = "packages/coding-agent/src/modes/interactive/components/footer.ts"
replace_once(
    footer_path,
    '''import { type Component, truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import type { AgentSession } from "../../../core/agent-session.ts";''',
    '''import type { Usage } from "@earendil-works/pi-ai/compat";
import { type Component, truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import type { AgentSession } from "../../../core/agent-session.ts";''',
)
replace_once(
    footer_path,
    '''import type { ReadonlyFooterDataProvider } from "../../../core/footer-data-provider.ts";
import { addUsageToTotals, createUsageTotals } from "../../../core/usage-totals.ts";''',
    '''import type { ReadonlyFooterDataProvider } from "../../../core/footer-data-provider.ts";
import { buildStatusLineCommandInput, StatusLineCommandRunner } from "../../../core/status-line.ts";
import { addUsageToTotals, createUsageTotals } from "../../../core/usage-totals.ts";''',
)
replace_once(
    footer_path,
    '''function sanitizeStatusText(text: string): string {
\t// Replace newlines, tabs, carriage returns with space, then collapse multiple spaces
\treturn text
\t\t.replace(/[\\r\\n\\t]/g, " ")
\t\t.replace(/ +/g, " ")
\t\t.trim();
}

/**
 * Format token counts for compact footer display.
 */''',
    '''function sanitizeStatusText(text: string): string {
\t// Replace newlines, tabs, carriage returns with space, then collapse multiple spaces
\treturn text
\t\t.replace(/[\\r\\n\\t]/g, " ")
\t\t.replace(/ +/g, " ")
\t\t.trim();
}

export function appendExtensionStatuses(
\tlines: string[],
\textensionStatuses: ReadonlyMap<string, string>,
\twidth: number,
): string[] {
\tif (extensionStatuses.size === 0) return lines;
\tconst sortedStatuses = Array.from(extensionStatuses.entries())
\t\t.sort(([a], [b]) => a.localeCompare(b))
\t\t.map(([, text]) => sanitizeStatusText(text));
\tconst statusLine = sortedStatuses.join(" ");
\treturn [...lines, truncateToWidth(statusLine, width, theme.fg("dim", "..."))];
}

/**
 * Format token counts for compact footer display.
 */''',
)
replace_once(
    footer_path,
    '''\tprivate footerData: ReadonlyFooterDataProvider;
\tprivate startupHeaderUpgradeCleanup: (() => void) | undefined;

\tconstructor(session: AgentSession, footerData: ReadonlyFooterDataProvider) {
\t\tthis.session = session;
\t\tthis.footerData = footerData;
\t\tthis.startupHeaderUpgradeCleanup = installClaudeStartupHeaderUpgrade(() => this.session);
\t}

\tsetSession(session: AgentSession): void {
\t\tthis.session = session;
\t}''',
    '''\tprivate footerData: ReadonlyFooterDataProvider;
\tprivate startupHeaderUpgradeCleanup: (() => void) | undefined;
\tprivate statusLineRunner: StatusLineCommandRunner;
\tprivate sessionStartedAt = Date.now();

\tconstructor(session: AgentSession, footerData: ReadonlyFooterDataProvider, requestRender: () => void = () => {}) {
\t\tthis.session = session;
\t\tthis.footerData = footerData;
\t\tthis.statusLineRunner = new StatusLineCommandRunner(requestRender);
\t\tthis.startupHeaderUpgradeCleanup = installClaudeStartupHeaderUpgrade(() => this.session);
\t}

\tsetSession(session: AgentSession): void {
\t\tthis.session = session;
\t\tthis.sessionStartedAt = Date.now();
\t\tthis.statusLineRunner.invalidate();
\t}''',
)
replace_once(
    footer_path,
    '''\t/**
\t * No-op: git branch caching now handled by provider.
\t * Kept for compatibility with existing call sites in interactive-mode.
\t */
\tinvalidate(): void {
\t\t// No-op: git branch is cached/invalidated by provider
\t}''',
    '''\tinvalidate(): void {
\t\tthis.statusLineRunner.invalidate();
\t}''',
)
replace_once(
    footer_path,
    '''\tdispose(): void {
\t\tthis.startupHeaderUpgradeCleanup?.();
\t\tthis.startupHeaderUpgradeCleanup = undefined;
\t}''',
    '''\tdispose(): void {
\t\tthis.statusLineRunner.dispose();
\t\tthis.startupHeaderUpgradeCleanup?.();
\t\tthis.startupHeaderUpgradeCleanup = undefined;
\t}''',
)
replace_once(
    footer_path,
    '''\t\tconst usageTotals = createUsageTotals();
\t\tlet latestCacheHitRate: number | undefined;''',
    '''\t\tconst usageTotals = createUsageTotals();
\t\tlet latestCacheHitRate: number | undefined;
\t\tlet latestAssistantUsage: Usage | undefined;''',
)
replace_once(
    footer_path,
    '''\t\t\tif (entry.type === "message" && entry.message.role === "assistant") {
\t\t\t\taddUsageToTotals(usageTotals, entry.message.usage);''',
    '''\t\t\tif (entry.type === "message" && entry.message.role === "assistant") {
\t\t\t\tlatestAssistantUsage = entry.message.usage;
\t\t\t\taddUsageToTotals(usageTotals, entry.message.usage);''',
)
replace_once(
    footer_path,
    '''\t\tconst pwdLine = truncateToWidth(theme.fg("dim", pwd), width, theme.fg("dim", "..."));
\t\tconst lines = [pwdLine, dimStatsLeft + dimRemainder];

\t\t// Add extension statuses on a single line, sorted by key alphabetically
\t\tconst extensionStatuses = this.footerData.getExtensionStatuses();
\t\tif (extensionStatuses.size > 0) {
\t\t\tconst sortedStatuses = Array.from(extensionStatuses.entries())
\t\t\t\t.sort(([a], [b]) => a.localeCompare(b))
\t\t\t\t.map(([, text]) => sanitizeStatusText(text));
\t\t\tconst statusLine = sortedStatuses.join(" ");
\t\t\t// Truncate to terminal width with dim ellipsis for consistency with footer style
\t\t\tlines.push(truncateToWidth(statusLine, width, theme.fg("dim", "...")));
\t\t}

\t\treturn lines;''',
    '''\t\tconst pwdLine = truncateToWidth(theme.fg("dim", pwd), width, theme.fg("dim", "..."));
\t\tconst statusLineSettings = this.session.settingsManager.getStatusLine();
\t\tconst customStatusLine = statusLineSettings
\t\t\t? this.statusLineRunner.update(statusLineSettings, {
\t\t\t\tinput: buildStatusLineCommandInput({
\t\t\t\t\tsession: this.session,
\t\t\t\t\tfooterData: this.footerData,
\t\t\t\t\tusageTotals,
\t\t\t\t\tlatestUsage: latestAssistantUsage,
\t\t\t\t\tcontextUsage,
\t\t\t\t\ttotalDurationMs: Date.now() - this.sessionStartedAt,
\t\t\t\t}),
\t\t\t\tcwd: this.session.sessionManager.getCwd(),
\t\t\t\tcolumns: width,
\t\t\t})
\t\t\t: this.statusLineRunner.update(undefined);
\t\tconst lines = customStatusLine
\t\t\t? customStatusLine.lines.map((line) => {
\t\t\t\tconst padding = " ".repeat(Math.min(customStatusLine.padding, Math.max(0, width - 1)));
\t\t\t\treturn `${padding}${truncateToWidth(line, Math.max(1, width - visibleWidth(padding)), "")}`;
\t\t\t})
\t\t\t: [pwdLine, dimStatsLeft + dimRemainder];

\t\treturn appendExtensionStatuses(lines, this.footerData.getExtensionStatuses(), width);''',
)

interactive_path = "packages/coding-agent/src/modes/interactive/interactive-mode.ts"
replace_once(
    interactive_path,
    '''\t\tthis.footer = new FooterComponent(this.session, this.footerDataProvider);''',
    '''\t\tthis.footer = new FooterComponent(this.session, this.footerDataProvider, () => this.ui.requestRender());''',
)

docs_path = "packages/coding-agent/docs/settings.md"
replace_once(
    docs_path,
    '''| `theme` | string | `"dark"` | Theme name (`"dark"`, `"light"`, or custom) |
| `externalEditor`''',
    '''| `theme` | string | `"dark"` | Theme name (`"dark"`, `"light"`, or custom) |
| `statusLine` | object | - | Run a command whose output replaces the default informational footer rows while preserving built-in status badges |
| `externalEditor`''',
)
replace_once(
    docs_path,
    '''### Telemetry and update checks''',
    '''#### Custom status line

`statusLine` follows Claude Code's command-based status-line format. The command receives a JSON object on stdin and its stdout is rendered as one or more footer rows. ANSI colors are preserved. The built-in status row remains separate, so Plan mode and other `ctx.ui.setStatus()` indicators are still displayed below the command output.

```json
{
  "statusLine": {
    "type": "command",
    "command": "~/.pi/agent/statusline.sh",
    "padding": 0,
    "refreshInterval": 5
  }
}
```

The command runs in the current workspace. `COLUMNS` and `LINES` are provided in the environment. Updates are debounced, an older invocation is cancelled when a newer update starts, and commands are limited to five seconds and 64 KiB of stdout.

The stdin object includes Claude-compatible fields for `cwd`, `session_id`, `transcript_path`, `model`, `workspace`, `version`, `cost`, `context_window`, `effort`, and `thinking`. A `pi` object additionally exposes `git_branch` and all current extension statuses. `refreshInterval` is optional and is clamped to a minimum of one second.

Project-level status-line commands are loaded only after the project is trusted. A custom extension footer created with `ctx.ui.setFooter()` still replaces the complete built-in footer, including this status line and the built-in status badges.

### Telemetry and update checks''',
)
