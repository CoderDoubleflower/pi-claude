import type { SessionEntry } from "../../core/session-manager.ts";

export const PLAN_MODE_STATE_ENTRY = "native.plan-mode.state";

export type PlanModePhase = "inactive" | "planning" | "awaiting-clear-context";

export interface PendingPlanExecution {
	plan: string;
	planPath: string;
}

export interface PlanModeState {
	version: 1;
	phase: PlanModePhase;
	planSlug?: string;
	planPath?: string;
	toolsBeforePlan?: string[];
	hasExitedInSession: boolean;
	needsExitReminder: boolean;
	reentryPending: boolean;
	forceFullReminder: boolean;
	humanTurnsSinceReminder: number;
	reminderCount: number;
	pendingExecution?: PendingPlanExecution;
}

export function createDefaultPlanModeState(): PlanModeState {
	return {
		version: 1,
		phase: "inactive",
		hasExitedInSession: false,
		needsExitReminder: false,
		reentryPending: false,
		forceFullReminder: false,
		humanTurnsSinceReminder: 0,
		reminderCount: 0,
	};
}

function stringArray(value: unknown): string[] | undefined {
	if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) return undefined;
	return [...value];
}

export function parsePlanModeState(value: unknown): PlanModeState | undefined {
	if (!value || typeof value !== "object") return undefined;
	const record = value as Record<string, unknown>;
	const phase = record.phase;
	if (phase !== "inactive" && phase !== "planning" && phase !== "awaiting-clear-context") return undefined;

	const pendingRecord = record.pendingExecution;
	const pendingExecution =
		pendingRecord &&
		typeof pendingRecord === "object" &&
		typeof (pendingRecord as Record<string, unknown>).plan === "string" &&
		typeof (pendingRecord as Record<string, unknown>).planPath === "string"
			? {
					plan: (pendingRecord as Record<string, unknown>).plan as string,
					planPath: (pendingRecord as Record<string, unknown>).planPath as string,
				}
			: undefined;

	return {
		version: 1,
		phase,
		planSlug: typeof record.planSlug === "string" ? record.planSlug : undefined,
		planPath: typeof record.planPath === "string" ? record.planPath : undefined,
		toolsBeforePlan: stringArray(record.toolsBeforePlan),
		hasExitedInSession: record.hasExitedInSession === true,
		needsExitReminder: record.needsExitReminder === true,
		reentryPending: record.reentryPending === true,
		forceFullReminder: record.forceFullReminder === true,
		humanTurnsSinceReminder:
			typeof record.humanTurnsSinceReminder === "number" && record.humanTurnsSinceReminder >= 0
				? Math.floor(record.humanTurnsSinceReminder)
				: 0,
		reminderCount:
			typeof record.reminderCount === "number" && record.reminderCount >= 0
				? Math.floor(record.reminderCount)
				: 0,
		pendingExecution,
	};
}

export function findLatestPlanModeState(entries: readonly SessionEntry[]): PlanModeState | undefined {
	for (let index = entries.length - 1; index >= 0; index--) {
		const entry = entries[index];
		if (entry?.type !== "custom" || entry.customType !== PLAN_MODE_STATE_ENTRY) continue;
		const parsed = parsePlanModeState(entry.data);
		if (parsed) return parsed;
	}
	return undefined;
}
