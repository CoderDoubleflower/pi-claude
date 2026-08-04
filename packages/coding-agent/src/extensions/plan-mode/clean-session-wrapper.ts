import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { ExtensionAPI, ExtensionContext } from "../../core/extensions/types.ts";
import planModeExtension from "./index.ts";
import { findLatestPlanModeState } from "./state.ts";

const PLAN_EXECUTION_SESSION_NAME_MAX_LENGTH = 120;

type UntypedExtensionHandler = (event: unknown, ctx: ExtensionContext) => unknown;
type UntypedOn = (event: string, handler: UntypedExtensionHandler) => void;

function getUserMessageText(message: AgentMessage): string | undefined {
	if (message.role !== "user") return undefined;
	if (typeof message.content === "string") return message.content;
	if (!Array.isArray(message.content)) return undefined;

	const text = message.content
		.flatMap((part) => {
			if (
				typeof part === "object" &&
				part !== null &&
				"type" in part &&
				part.type === "text" &&
				"text" in part &&
				typeof part.text === "string"
			) {
				return [part.text];
			}
			return [];
		})
		.join(" ");
	return text || undefined;
}

function getSourceSessionTitle(ctx: ExtensionContext): string | undefined {
	const explicitName = ctx.sessionManager.getSessionName();
	if (explicitName?.trim()) return explicitName;

	for (const entry of ctx.sessionManager.getEntries()) {
		if (entry.type !== "message") continue;
		const text = getUserMessageText(entry.message);
		if (text?.trim()) return text;
	}
	return undefined;
}

function normalizePlanExecutionSessionName(value: string): string {
	const firstNonEmptyLine = value.split(/\r?\n/).find((line) => line.trim());
	if (!firstNonEmptyLine) return "";

	const normalized = firstNonEmptyLine
		.replace(/^\s{0,3}#{1,6}\s+/, "")
		.replace(/^\s*(?:[-*+]|\d+[.)])\s+/, "")
		.replace(/\s+/g, " ")
		.trim();
	if (!normalized) return "";

	const characters = Array.from(normalized);
	if (characters.length <= PLAN_EXECUTION_SESSION_NAME_MAX_LENGTH) return normalized;
	return `${characters.slice(0, PLAN_EXECUTION_SESSION_NAME_MAX_LENGTH - 1).join("")}…`;
}

export function buildPlanExecutionSessionName(plan: string, sourceSessionTitle?: string): string {
	const planLines = plan.split(/\r?\n/);
	const candidates = [
		sourceSessionTitle,
		...planLines.filter((line) => /^\s{0,3}#{1,6}\s+\S/.test(line)),
		...planLines,
	];
	for (const candidate of candidates) {
		if (!candidate) continue;
		const normalized = normalizePlanExecutionSessionName(candidate);
		if (normalized) return normalized;
	}
	return "Implement approved plan";
}

function withIndependentExecutionSession(ctx: ExtensionContext, executionSessionName: string): ExtensionContext {
	const startFreshSession = ctx.newSession;
	if (!startFreshSession) return ctx;

	return {
		...ctx,
		newSession: async (options) => {
			const { parentSession: _discardedParentSession, setup, ...independentOptions } = options ?? {};
			return startFreshSession({
				...independentOptions,
				setup: async (sessionManager) => {
					await setup?.(sessionManager);
					if (!sessionManager.getSessionName()) {
						sessionManager.appendSessionInfo(executionSessionName);
					}
				},
			});
		},
	};
}

/**
 * Keep the native plan-mode implementation intact, but adapt its clear-context
 * handoff so the replacement execution session is independent and already named
 * before the approved plan starts its first turn.
 */
export default function cleanPlanSessionExtension(pi: ExtensionAPI): void {
	const register = pi.on.bind(pi) as unknown as UntypedOn;
	const wrappedOn: UntypedOn = (event, handler) => {
		if (event !== "agent_settled") {
			register(event, handler);
			return;
		}

		register(event, (settledEvent, ctx) => {
			const pendingPlan = findLatestPlanModeState(ctx.sessionManager.getBranch())?.pendingExecution?.plan ?? "";
			const executionSessionName = buildPlanExecutionSessionName(pendingPlan, getSourceSessionTitle(ctx));
			return handler(settledEvent, withIndependentExecutionSession(ctx, executionSessionName));
		});
	};

	const wrappedApi = new Proxy(pi, {
		get(target, property, receiver) {
			if (property === "on") return wrappedOn;
			return Reflect.get(target, property, receiver);
		},
	}) as ExtensionAPI;

	planModeExtension(wrappedApi);
}
