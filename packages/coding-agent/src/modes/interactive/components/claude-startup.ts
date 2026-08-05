import { homedir } from "node:os";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { type Component, truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { theme } from "../theme/theme.ts";

const CLAWD_WIDTH = 9;
const INFO_GAP = 2;
const MIN_HORIZONTAL_INFO_WIDTH = 12;
const CLAWD_TRUECOLOR = "\x1b[38;2;215;135;135m";
const CLAWD_256COLOR = "\x1b[38;5;174m";
const FOREGROUND_RESET = "\x1b[39m";

// Claude Code 2.1.88's default condensed Clawd pose. Keep the silhouette
// independent from the active theme so the startup identity uses #d78787.
const CLAWD_ROWS = [" ▐▛███▜▌", "▝▜█████▛▘", "  ▘▘ ▝▝  "] as const;

export interface ClaudeStartupModel {
	id: string;
	name?: string;
	provider?: string;
	reasoning?: boolean;
}

export interface ClaudeStartupSnapshot {
	appName: string;
	version: string;
	model?: ClaudeStartupModel;
	/** Optional fallback when the caller cannot expose the active model. */
	modelLine?: string;
	thinkingLevel?: string;
	cwd: string;
}

function colorClawd(text: string): string {
	const color = theme.getColorMode() === "truecolor" ? CLAWD_TRUECOLOR : CLAWD_256COLOR;
	return `${color}${text}${FOREGROUND_RESET}`;
}

function sanitizeSingleLine(value: string): string {
	return value
		.replace(/[\r\n\t]/g, " ")
		.replace(/ +/g, " ")
		.trim();
}

function formatCwd(cwd: string): string {
	const home = process.env.HOME || process.env.USERPROFILE || homedir();
	if (!home) return cwd;

	const resolvedCwd = resolve(cwd);
	const resolvedHome = resolve(home);
	const relativeToHome = relative(resolvedHome, resolvedCwd);
	const isInsideHome =
		relativeToHome === "" ||
		(relativeToHome !== ".." && !relativeToHome.startsWith(`..${sep}`) && !isAbsolute(relativeToHome));

	if (!isInsideHome) return cwd;
	return relativeToHome === "" ? "~" : `~${sep}${relativeToHome}`;
}

function truncateFromLeft(text: string, width: number): string {
	if (width <= 0) return "";
	if (visibleWidth(text) <= width) return text;
	if (width === 1) return "…";

	const suffixWidth = width - 1;
	let suffix = "";
	for (const character of Array.from(text).reverse()) {
		const next = character + suffix;
		if (visibleWidth(next) > suffixWidth) break;
		suffix = next;
	}
	return `…${suffix}`;
}

function formatModelLine(snapshot: ClaudeStartupSnapshot): string {
	if (snapshot.modelLine) {
		return sanitizeSingleLine(snapshot.modelLine);
	}

	const model = snapshot.model;
	if (!model) return "No model selected";

	const displayName = sanitizeSingleLine(model.name || model.id) || "Unknown model";
	const provider = sanitizeSingleLine(model.provider || "");
	const parts = [displayName];
	if (provider && provider.toLowerCase() !== displayName.toLowerCase()) {
		parts.push(provider);
	}
	if (model.reasoning && snapshot.thinkingLevel && snapshot.thinkingLevel !== "off") {
		parts.push(`${sanitizeSingleLine(snapshot.thinkingLevel)} thinking`);
	}
	return parts.join(" · ");
}

function renderTitle(appName: string, version: string, width: number): string {
	const safeAppName = sanitizeSingleLine(appName) || "pi-claude";
	const safeVersion = sanitizeSingleLine(version);
	const rawTitle = safeVersion ? `${safeAppName} v${safeVersion}` : safeAppName;
	if (visibleWidth(rawTitle) > width) {
		return theme.bold(truncateToWidth(rawTitle, width, "…"));
	}
	return theme.bold(safeAppName) + (safeVersion ? theme.fg("dim", ` v${safeVersion}`) : "");
}

/**
 * Claude Code-style condensed startup identity block.
 *
 * Normal terminals render the three-row Clawd beside three information rows:
 * app/version, model/provider, and working directory. Very narrow terminals
 * stack the same content so no row exceeds the available viewport width.
 */
export class ClaudeStartupComponent implements Component {
	private readonly getSnapshot: () => ClaudeStartupSnapshot;

	constructor(getSnapshot: () => ClaudeStartupSnapshot) {
		this.getSnapshot = getSnapshot;
	}

	render(width: number): string[] {
		if (width <= 0) return [];

		const snapshot = this.getSnapshot();
		const horizontalInfoWidth = width - CLAWD_WIDTH - INFO_GAP;
		const useHorizontalLayout = horizontalInfoWidth >= MIN_HORIZONTAL_INFO_WIDTH;
		const infoWidth = useHorizontalLayout ? horizontalInfoWidth : width;
		const title = renderTitle(snapshot.appName, snapshot.version, infoWidth);
		const model = theme.fg("dim", truncateToWidth(formatModelLine(snapshot), infoWidth, "…"));
		const cwd = theme.fg("dim", truncateFromLeft(formatCwd(snapshot.cwd), infoWidth));
		const infoRows = [title, model, cwd];

		const clawdRows = CLAWD_ROWS.map((row) => colorClawd(row.padEnd(CLAWD_WIDTH)));
		if (!useHorizontalLayout) {
			return [...clawdRows.map((row) => truncateToWidth(row, width, "")), ...infoRows];
		}

		const gap = " ".repeat(INFO_GAP);
		return clawdRows.map((row, index) => `${row}${gap}${infoRows[index] ?? ""}`);
	}

	invalidate(): void {
		// Snapshot data is read on every render, so there is no cache to clear.
	}
}
