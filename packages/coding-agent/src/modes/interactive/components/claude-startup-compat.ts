import { stripVTControlCharacters } from "node:util";
import { type Component, Container, Text, truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import type { AgentSession } from "../../../core/agent-session.ts";
import { ClaudeStartupComponent, type ClaudeStartupSnapshot } from "./claude-startup.ts";

const LEGACY_STARTUP_SENTINEL = "Pi can explain its own features and look up its docs.";

type LegacyTextRuntimeState = {
	text?: unknown;
	paddingX?: unknown;
	paddingY?: unknown;
};

type StartupIdentity = Pick<ClaudeStartupSnapshot, "appName" | "version">;

type StartupInterceptor = {
	tryUpgrade(component: Component): boolean;
};

type ContainerHookState = {
	originalAddChild: (this: Container, component: Component) => void;
	interceptors: Set<StartupInterceptor>;
};

let containerHookState: ContainerHookState | undefined;

function parseLegacyStartupIdentity(component: Text): StartupIdentity | undefined {
	const state = component as unknown as LegacyTextRuntimeState;
	if (typeof state.text !== "string") return undefined;

	const plainText = stripVTControlCharacters(state.text);
	if (!plainText.includes(LEGACY_STARTUP_SENTINEL)) return undefined;

	const firstLine = plainText.split(/\r?\n/, 1)[0]?.trim() ?? "";
	const match = /^(.+?)\s+v([^\s]+)$/.exec(firstLine);
	if (!match) return undefined;

	return {
		appName: match[1] || "pi-claude",
		version: match[2] || "",
	};
}

function renderWithTextPadding(component: Text, startup: ClaudeStartupComponent, width: number): string[] {
	if (width <= 0) return [];

	const state = component as unknown as LegacyTextRuntimeState;
	const paddingX = typeof state.paddingX === "number" ? Math.max(0, Math.floor(state.paddingX)) : 0;
	const paddingY = typeof state.paddingY === "number" ? Math.max(0, Math.floor(state.paddingY)) : 0;
	const contentWidth = Math.max(1, width - paddingX * 2);
	const leftMargin = " ".repeat(paddingX);
	const rightMargin = " ".repeat(paddingX);
	const contentLines = startup.render(contentWidth).map((line) => {
		const clipped = truncateToWidth(line, contentWidth, "");
		const lineWithMargins = leftMargin + clipped + rightMargin;
		return lineWithMargins + " ".repeat(Math.max(0, width - visibleWidth(lineWithMargins)));
	});
	const emptyLine = " ".repeat(width);
	const verticalPadding = Array.from({ length: paddingY }, () => emptyLine);
	return [...verticalPadding, ...contentLines, ...verticalPadding];
}

function decorateLegacyStartupHeader(component: Text, identity: StartupIdentity, getSession: () => AgentSession): void {
	const startup = new ClaudeStartupComponent(() => {
		const session = getSession();
		return {
			...identity,
			model: session.model,
			thinkingLevel: session.thinkingLevel,
			cwd: session.sessionManager.getCwd(),
		};
	});
	const originalInvalidate = component.invalidate.bind(component);

	component.render = (width: number) => renderWithTextPadding(component, startup, width);
	component.invalidate = () => {
		originalInvalidate();
		startup.invalidate();
	};
}

function ensureContainerHook(): ContainerHookState {
	if (containerHookState) return containerHookState;

	const originalAddChild = Container.prototype.addChild;
	const state: ContainerHookState = {
		originalAddChild,
		interceptors: new Set(),
	};
	containerHookState = state;

	Container.prototype.addChild = function addChild(component: Component): void {
		for (const interceptor of [...state.interceptors]) {
			if (interceptor.tryUpgrade(component)) {
				state.interceptors.delete(interceptor);
			}
		}
		state.originalAddChild.call(this, component);
		if (state.interceptors.size === 0 && containerHookState === state) {
			Container.prototype.addChild = state.originalAddChild;
			containerHookState = undefined;
		}
	};

	return state;
}

/**
 * Upgrade InteractiveMode's historical multi-line startup transcript to the
 * Claude Code condensed startup identity. The temporary Container hook is
 * removed immediately after the exact legacy header is encountered, and the
 * returned cleanup also removes it when quiet startup prevents that header
 * from being created.
 */
export function installClaudeStartupHeaderUpgrade(getSession: () => AgentSession): () => void {
	const state = ensureContainerHook();
	const interceptor: StartupInterceptor = {
		tryUpgrade(component): boolean {
			if (!(component instanceof Text)) return false;
			const identity = parseLegacyStartupIdentity(component);
			if (!identity) return false;
			decorateLegacyStartupHeader(component, identity, getSession);
			return true;
		},
	};
	state.interceptors.add(interceptor);

	return () => {
		state.interceptors.delete(interceptor);
		if (state.interceptors.size === 0 && containerHookState === state) {
			Container.prototype.addChild = state.originalAddChild;
			containerHookState = undefined;
		}
	};
}
