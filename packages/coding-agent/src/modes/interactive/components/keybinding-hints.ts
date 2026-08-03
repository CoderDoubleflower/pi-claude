/**
 * Utilities for formatting keybinding hints in the UI.
 */

import { stripVTControlCharacters } from "node:util";
import {
	getKeybindings,
	type Keybinding,
	type KeyId,
	Text,
	truncateToWidth,
	visibleWidth,
} from "@earendil-works/pi-tui";
import { ClaudeStartupComponent, type ClaudeStartupSnapshot } from "./claude-startup.ts";
import { theme } from "../theme/theme.ts";

const LEGACY_STARTUP_SENTINEL = "Pi can explain its own features and look up its docs.";
const TEXT_STARTUP_PATCH_FLAG = "__piClaudeStartupRenderPatched";

interface TextRuntimeState {
	text?: unknown;
	paddingX?: unknown;
	paddingY?: unknown;
}

function parseLegacyStartupSnapshot(text: string): ClaudeStartupSnapshot | undefined {
	const plainText = stripVTControlCharacters(text);
	if (!plainText.includes(LEGACY_STARTUP_SENTINEL)) return undefined;

	const firstLine = plainText.split(/\r?\n/, 1)[0]?.trim() ?? "";
	const match = /^(.+?)\s+v([^\s]+)$/.exec(firstLine);
	if (!match) return undefined;

	return {
		appName: match[1] || "pi-claude",
		version: match[2] || "",
		modelLine: "Claude Code-style coding agent",
		cwd: process.cwd(),
	};
}

function renderStartupWithTextPadding(
	snapshot: ClaudeStartupSnapshot,
	width: number,
	paddingX: number,
	paddingY: number,
): string[] {
	const contentWidth = Math.max(1, width - paddingX * 2);
	const startup = new ClaudeStartupComponent(() => snapshot);
	const leftMargin = " ".repeat(paddingX);
	const rightMargin = " ".repeat(paddingX);
	const contentLines = startup.render(contentWidth).map((line) => {
		const clipped = truncateToWidth(line, contentWidth, "");
		const lineWithMargins = leftMargin + clipped + rightMargin;
		return lineWithMargins + " ".repeat(Math.max(0, width - visibleWidth(lineWithMargins)));
	});
	const emptyLine = " ".repeat(Math.max(0, width));
	const verticalPadding = Array.from({ length: paddingY }, () => emptyLine);
	return [...verticalPadding, ...contentLines, ...verticalPadding];
}

/**
 * InteractiveMode's legacy built-in header is an ExpandableText subclass.
 * Intercept only that exact historical header and render Claude Code 2.1.88's
 * condensed identity block instead. All other Text instances retain the
 * upstream pi-tui renderer unchanged.
 */
function installClaudeStartupTextRenderer(): void {
	const prototype = Text.prototype as typeof Text.prototype & Record<string, unknown>;
	if (prototype[TEXT_STARTUP_PATCH_FLAG]) return;

	const originalRender = Text.prototype.render;
	prototype[TEXT_STARTUP_PATCH_FLAG] = true;
	prototype.render = function render(width: number): string[] {
		const state = this as unknown as TextRuntimeState;
		if (typeof state.text !== "string") {
			return originalRender.call(this, width);
		}

		const snapshot = parseLegacyStartupSnapshot(state.text);
		if (!snapshot) {
			return originalRender.call(this, width);
		}

		const paddingX = typeof state.paddingX === "number" ? Math.max(0, Math.floor(state.paddingX)) : 0;
		const paddingY = typeof state.paddingY === "number" ? Math.max(0, Math.floor(state.paddingY)) : 0;
		return renderStartupWithTextPadding(snapshot, width, paddingX, paddingY);
	};
}

installClaudeStartupTextRenderer();

export interface KeyTextFormatOptions {
	capitalize?: boolean;
}

function formatKeyPart(part: string, options: KeyTextFormatOptions): string {
	const displayPart = process.platform === "darwin" && part.toLowerCase() === "alt" ? "option" : part;
	return options.capitalize ? displayPart.charAt(0).toUpperCase() + displayPart.slice(1) : displayPart;
}

export function formatKeyText(key: string, options: KeyTextFormatOptions = {}): string {
	return key
		.split("/")
		.map((k) =>
			k
				.split("+")
				.map((part) => formatKeyPart(part, options))
				.join("+"),
		)
		.join("/");
}

function formatKeys(keys: KeyId[], options: KeyTextFormatOptions = {}): string {
	if (keys.length === 0) return "";
	return formatKeyText(keys.join("/"), options);
}

export function keyText(keybinding: Keybinding): string {
	return formatKeys(getKeybindings().getKeys(keybinding));
}

export function keyDisplayText(keybinding: Keybinding): string {
	return formatKeys(getKeybindings().getKeys(keybinding), { capitalize: true });
}

export function keyHint(keybinding: Keybinding, description: string): string {
	return theme.fg("dim", keyText(keybinding)) + theme.fg("muted", ` ${description}`);
}

export function rawKeyHint(key: string, description: string): string {
	return theme.fg("dim", formatKeyText(key)) + theme.fg("muted", ` ${description}`);
}
