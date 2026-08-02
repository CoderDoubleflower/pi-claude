export const ENTER_PLAN_MODE_TOOL_NAME = "EnterPlanMode";
export const EXIT_PLAN_MODE_TOOL_NAME = "ExitPlanMode";
export const ASK_USER_QUESTION_TOOL_NAME = "AskUserQuestion";

export const PLAN_MODE_REMINDER_TYPE = "native.plan-mode.reminder";
export const PLAN_MODE_DISPLAY_TYPE = "native.plan-mode.display";
export const PLAN_MODE_EXECUTION_TYPE = "native.plan-mode.execution";

export function buildEnterPlanModeDescription(): string {
	return `Request plan mode before coding when the implementation has genuine ambiguity, substantial architectural impact, unclear requirements, or multiple materially different approaches. Do not use it for tiny fixes, explicit mechanical changes, or research-only questions. Entering requires user approval.`;
}

export function buildExitPlanModeDescription(): string {
	return `Use only while plan mode is active, after the implementation plan has been written to the provided plan file. This tool presents that file for user approval. Do not ask for plan approval in normal text or with ${ASK_USER_QUESTION_TOOL_NAME}.`;
}

function planFileSection(planPath: string, planExists: boolean): string {
	return planExists
		? `A plan already exists at ${planPath}. Read it first and update it incrementally.`
		: `Write the final plan to ${planPath}. This is the only file you may create or modify.`;
}

export function buildFullPlanModePrompt(options: { planPath: string; planExists: boolean; reentry?: boolean }): string {
	const reentry = options.reentry
		? `\nYou are re-entering plan mode. Review the existing plan before deciding whether to revise it or replace it.\n`
		: "";
	return `Plan mode is active. The user does not want implementation yet. This instruction overrides requests to edit code or change system state.${reentry}

## Hard restrictions
- You may read and search the codebase.
- You may run only commands accepted by the read-only shell policy.
- You must not modify code, configuration, dependencies, git state, or external systems.
- The sole writable path is the plan file below.

## Plan file
${planFileSection(options.planPath, options.planExists)}

## Workflow
1. Understand the request and trace the relevant code paths. Reuse existing functions and patterns where possible.
2. Identify ambiguities that materially affect the implementation. Use ${ASK_USER_QUESTION_TOOL_NAME} for those questions.
3. Compare viable approaches and choose one recommended design.
4. Write a concise, executable plan to the plan file. Include critical file paths, existing functions to reuse, sequencing, risks, and end-to-end verification.
5. When the plan is complete, call ${EXIT_PLAN_MODE_TOOL_NAME}.

End a planning turn only by asking a necessary question with ${ASK_USER_QUESTION_TOOL_NAME} or by calling ${EXIT_PLAN_MODE_TOOL_NAME}. Never ask “is this plan okay?” in plain text; ${EXIT_PLAN_MODE_TOOL_NAME} is the approval mechanism.`;
}

export function buildSparsePlanModePrompt(planPath: string): string {
	return `Plan mode remains active. Stay read-only except for the plan file (${planPath}). Continue exploring, clarify only material ambiguities with ${ASK_USER_QUESTION_TOOL_NAME}, keep the plan file current, and finish with ${EXIT_PLAN_MODE_TOOL_NAME}. Never request plan approval in ordinary text.`;
}

export function buildPlanModeExitPrompt(planPath: string, plan: string | null): string {
	const reference = plan ? ` The approved plan is saved at ${planPath}.` : "";
	return `Plan mode has ended.${reference} Follow the approved plan and use the restored tool set. Do not continue planning unless the user asks or a material contradiction is discovered.`;
}

export function buildApprovedExecutionPrompt(planPath: string, plan: string): string {
	return `The user approved the following implementation plan. Plan mode is over and normal tools are restored. Begin implementation now, keep the todo list current when useful, and verify the result end-to-end.\n\nPlan file: ${planPath}\n\n## Approved Plan\n${plan}`;
}
