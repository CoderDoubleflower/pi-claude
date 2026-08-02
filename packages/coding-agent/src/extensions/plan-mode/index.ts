import type { AgentMessage } from "@earendil-works/pi-agent-core";
import { Container, Key, Markdown, Spacer, Text } from "@earendil-works/pi-tui";
import chalk from "chalk";
import { Type } from "typebox";
import type {
	ExtensionAPI,
	ExtensionContext,
	MessageRenderer,
	ToolDefinition,
	ToolRenderResultOptions,
} from "../../core/extensions/types.ts";
import { isToolCallEventType } from "../../core/extensions/types.ts";
import type { CustomMessage } from "../../core/messages.ts";
import { getMarkdownTheme, type Theme } from "../../modes/interactive/theme/theme.ts";
import { copyPlanFile, createPlanIdentity, isCurrentPlanFile, readPlanFile, writePlanFile } from "./plan-store.ts";
import {
	ASK_USER_QUESTION_TOOL_NAME,
	buildApprovedExecutionPrompt,
	buildEnterPlanModeDescription,
	buildExitPlanModeDescription,
	buildFullPlanModePrompt,
	buildPlanModeExitPrompt,
	buildSparsePlanModePrompt,
	ENTER_PLAN_MODE_TOOL_NAME,
	EXIT_PLAN_MODE_TOOL_NAME,
	PLAN_MODE_DISPLAY_TYPE,
	PLAN_MODE_EXECUTION_TYPE,
	PLAN_MODE_REMINDER_TYPE,
} from "./prompts.ts";
import { checkPlanReadOnlyCommand } from "./shell-policy.ts";
import {
	createDefaultPlanModeState,
	findLatestPlanModeState,
	PLAN_MODE_STATE_ENTRY,
	type PlanModeState,
} from "./state.ts";

export const PLAN_MODE_STATUS_KEY = "native.plan-mode";
const PLAN_MODE_SHORTCUT = Key.ctrlAlt("p");
const HUMAN_TURNS_BETWEEN_REMINDERS = 5;
const FULL_REMINDER_EVERY = 5;
const BUILTIN_READ_ONLY_TOOLS = ["read", "grep", "find", "ls"] as const;
const PLAN_FILE_TOOLS = ["edit", "write"] as const;
const PLAN_CUSTOM_TOOLS = [ASK_USER_QUESTION_TOOL_NAME, EXIT_PLAN_MODE_TOOL_NAME] as const;

interface PlanRenderDetails {
	kind:
		| "entered"
		| "enter-declined"
		| "current-plan"
		| "approved"
		| "approved-clear"
		| "rejected"
		| "answers"
		| "cancelled";
	title?: string;
	subtitle?: string;
	plan?: string;
	planPath?: string;
	feedback?: string;
}

interface AskAnswer {
	question: string;
	answers: string[];
}

const QuestionOptionSchema = Type.Object({
	label: Type.String({ description: "Short option label" }),
	description: Type.Optional(Type.String({ description: "Explanation shown with the option" })),
});
const QuestionSchema = Type.Object({
	question: Type.String({ description: "The question to ask" }),
	header: Type.Optional(Type.String({ description: "Short context label" })),
	options: Type.Array(QuestionOptionSchema, { minItems: 2, maxItems: 4 }),
	multiSelect: Type.Optional(Type.Boolean({ description: "Allow selecting multiple options" })),
	allowOther: Type.Optional(Type.Boolean({ description: "Allow a custom typed answer (default true)" })),
});
const AskUserQuestionSchema = Type.Object({
	questions: Type.Array(QuestionSchema, { minItems: 1, maxItems: 4 }),
});
const EmptySchema = Type.Object({});
const ExitPlanModeSchema = Type.Object({
	plan: Type.Optional(
		Type.String({
			description:
				"Complete Markdown plan to save to the current plan file when normal edit/write tools are unavailable",
		}),
	),
	allowedPrompts: Type.Optional(
		Type.Array(
			Type.Object({
				tool: Type.Literal("bash"),
				prompt: Type.String(),
			}),
		),
	),
});

function unique(values: readonly string[]): string[] {
	return [...new Set(values)];
}

function isLightTheme(theme: Theme): boolean {
	return theme.name?.toLowerCase().includes("light") === true;
}

export function planModeColor(theme: Theme, text: string): string {
	return chalk.hex(isLightTheme(theme) ? "#006666" : "#48968c")(text);
}

function renderPlanDetails(details: PlanRenderDetails, theme: Theme): Container {
	const container = new Container();
	const title = details.title ?? "Plan mode";
	container.addChild(new Text(`${planModeColor(theme, "●")} ${title}`, 0, 0));
	if (details.subtitle) {
		container.addChild(new Text(`  ${theme.fg("dim", details.subtitle)}`, 0, 0));
	}
	if (details.planPath) {
		container.addChild(new Text(`  ${theme.fg("dim", details.planPath)}`, 0, 0));
	}
	if (details.feedback) {
		container.addChild(new Text(`  ${theme.fg("warning", `Feedback: ${details.feedback}`)}`, 0, 0));
	}
	if (details.plan) {
		container.addChild(new Spacer(1));
		container.addChild(new Markdown(details.plan, 2, 0, getMarkdownTheme()));
	}
	return container;
}

function renderPlanToolResult(
	result: { content: Array<{ type: string; text?: string }>; details?: unknown },
	_options: ToolRenderResultOptions,
	theme: Theme,
): Container | Text {
	const details = result.details as PlanRenderDetails | undefined;
	if (details?.kind) return renderPlanDetails(details, theme);
	const text = result.content
		.filter((item) => item.type === "text")
		.map((item) => item.text ?? "")
		.join("\n");
	return new Text(text, 0, 0);
}

const planMessageRenderer: MessageRenderer<PlanRenderDetails> = (message, _options, theme) => {
	const details = message.details;
	if (!details) return undefined;
	return renderPlanDetails(details, theme);
};

function textResult(text: string, details: PlanRenderDetails, isError = false) {
	return {
		content: [{ type: "text" as const, text }],
		details,
		isError,
	};
}

export function getPlanModeTools(toolsBeforePlan: readonly string[], availableToolNames: readonly string[]): string[] {
	const available = new Set(availableToolNames);
	const active = new Set(toolsBeforePlan);
	const requested = [
		...BUILTIN_READ_ONLY_TOOLS.filter((name) => active.has(name)),
		...(active.has("bash") ? ["bash"] : []),
		...PLAN_FILE_TOOLS.filter((name) => active.has(name)),
		...PLAN_CUSTOM_TOOLS,
	];
	return unique(requested.filter((name) => available.has(name)));
}

export function getRestoredTools(
	toolsBeforePlan: readonly string[] | undefined,
	currentTools: readonly string[],
	availableToolNames: readonly string[],
): string[] {
	const available = new Set(availableToolNames);
	const base = toolsBeforePlan ?? currentTools;
	return unique(base).filter((name) => name !== EXIT_PLAN_MODE_TOOL_NAME && available.has(name));
}

function getQuestionOptionText(index: number, option: { label: string; description?: string }): string {
	return `${index + 1}. ${option.label}${option.description ? ` — ${option.description}` : ""}`;
}

async function askSingleQuestion(
	ctx: ExtensionContext,
	question: {
		question: string;
		header?: string;
		options: Array<{ label: string; description?: string }>;
		multiSelect?: boolean;
		allowOther?: boolean;
	},
): Promise<string[] | undefined> {
	const title = question.header ? `${question.header}: ${question.question}` : question.question;
	const choices = question.options.map((option, index) => ({
		text: getQuestionOptionText(index, option),
		value: option.label,
	}));
	const allowOther = question.allowOther !== false;

	if (!question.multiSelect) {
		const displayChoices = [...choices.map((choice) => choice.text), ...(allowOther ? ["Type something."] : [])];
		const selected = await ctx.ui.select(title, displayChoices);
		if (!selected) return undefined;
		if (selected === "Type something.") {
			const custom = await ctx.ui.input(title, "Type your answer");
			return custom?.trim() ? [custom.trim()] : undefined;
		}
		return [choices.find((choice) => choice.text === selected)?.value ?? selected];
	}

	const selectedValues: string[] = [];
	const remaining = [...choices];
	while (remaining.length > 0) {
		const displayChoices = [
			...remaining.map((choice) => choice.text),
			...(allowOther ? ["Type something."] : []),
			...(selectedValues.length > 0 ? ["Done"] : []),
		];
		const selected = await ctx.ui.select(
			`${title}${selectedValues.length > 0 ? ` (${selectedValues.length} selected)` : ""}`,
			displayChoices,
		);
		if (!selected) return undefined;
		if (selected === "Done") return selectedValues;
		if (selected === "Type something.") {
			const custom = await ctx.ui.input(title, "Type another answer");
			if (custom?.trim()) selectedValues.push(custom.trim());
			continue;
		}
		const index = remaining.findIndex((choice) => choice.text === selected);
		if (index >= 0) {
			selectedValues.push(remaining[index].value);
			remaining.splice(index, 1);
		}
	}
	return selectedValues;
}

export default function planModeExtension(pi: ExtensionAPI): void {
	let state: PlanModeState = createDefaultPlanModeState();
	let lastNormalTools: string[] | undefined;

	pi.registerFlag("plan", {
		description: "Start in Claude Code-style plan mode",
		type: "boolean",
		default: false,
	});

	function availableToolNames(): string[] {
		return pi.getAllTools().map((tool) => tool.name);
	}

	function persistState(): void {
		pi.appendEntry(PLAN_MODE_STATE_ENTRY, {
			...state,
			toolsBeforePlan: state.toolsBeforePlan && [...state.toolsBeforePlan],
		});
	}

	function updateStatus(ctx: ExtensionContext): void {
		if (state.phase === "inactive") {
			ctx.ui.setStatus(PLAN_MODE_STATUS_KEY, undefined);
			return;
		}
		ctx.ui.setStatus(PLAN_MODE_STATUS_KEY, planModeColor(ctx.ui.theme, "⏸ plan"));
	}

	function ensurePlanIdentity(ctx: ExtensionContext): void {
		if (state.planPath && state.planSlug) return;
		const identity = createPlanIdentity(ctx.sessionManager.getSessionId());
		state = { ...state, ...identity };
	}

	function syncPlanningTools(): void {
		pi.setActiveTools(getPlanModeTools(state.toolsBeforePlan ?? [], availableToolNames()));
	}

	function restoreNormalTools(savedTools = state.toolsBeforePlan ?? lastNormalTools): void {
		const restoredTools = getRestoredTools(savedTools, pi.getActiveTools(), availableToolNames());
		pi.setActiveTools(restoredTools);
		lastNormalTools = restoredTools;
	}

	function enterPlanMode(ctx: ExtensionContext): { reentry: boolean; prompt: string } {
		if (state.phase !== "inactive") {
			ensurePlanIdentity(ctx);
			return {
				reentry: false,
				prompt: buildFullPlanModePrompt({
					planPath: state.planPath!,
					planExists: readPlanFile(state.planPath) !== null,
				}),
			};
		}

		const toolsBeforePlan = pi.getActiveTools();
		lastNormalTools = [...toolsBeforePlan];
		ensurePlanIdentity(ctx);
		const planExists = readPlanFile(state.planPath) !== null;
		const reentry = state.hasExitedInSession && planExists;
		state = {
			...state,
			phase: "planning",
			toolsBeforePlan,
			needsExitReminder: false,
			reentryPending: reentry,
			forceFullReminder: true,
			humanTurnsSinceReminder: 0,
			reminderCount: 0,
			pendingExecution: undefined,
		};
		syncPlanningTools();
		persistState();
		updateStatus(ctx);
		return {
			reentry,
			prompt: buildFullPlanModePrompt({ planPath: state.planPath!, planExists, reentry }),
		};
	}

	function leavePlanMode(ctx: ExtensionContext): void {
		const savedTools = state.toolsBeforePlan;
		state = {
			...state,
			phase: "inactive",
			toolsBeforePlan: undefined,
			hasExitedInSession: true,
			needsExitReminder: true,
			reentryPending: false,
			forceFullReminder: false,
			humanTurnsSinceReminder: 0,
			pendingExecution: undefined,
		};
		restoreNormalTools(savedTools);
		persistState();
		updateStatus(ctx);
	}

	async function editCurrentPlan(ctx: ExtensionContext): Promise<string | null> {
		ensurePlanIdentity(ctx);
		const currentPlan = readPlanFile(state.planPath) ?? "";
		const edited = await ctx.ui.editor("Edit plan", currentPlan);
		if (edited === undefined) return null;
		writePlanFile(state.planPath!, edited);
		return edited;
	}

	const askUserQuestionTool: ToolDefinition<typeof AskUserQuestionSchema, PlanRenderDetails> = {
		name: ASK_USER_QUESTION_TOOL_NAME,
		label: "Ask User Question",
		description:
			"Ask one or more concrete questions when the answer materially affects requirements or implementation. Do not use this tool to request approval of a completed plan; use ExitPlanMode for that.",
		promptSnippet: "ask the user focused multiple-choice or free-text questions",
		parameters: AskUserQuestionSchema,
		renderShell: "self",
		executionMode: "sequential",
		async execute(_toolCallId, { questions }, _signal, _onUpdate, ctx) {
			if (!ctx.hasUI) {
				return textResult(
					"AskUserQuestion requires an interactive UI.",
					{ kind: "cancelled", title: "Could not ask user", subtitle: "Interactive UI unavailable" },
					true,
				);
			}
			const answers: AskAnswer[] = [];
			for (const question of questions) {
				const selected = await askSingleQuestion(ctx, question);
				if (!selected) {
					return textResult("The user cancelled the question flow. Stop and wait for new instructions.", {
						kind: "cancelled",
						title: "User cancelled questions",
					});
				}
				answers.push({ question: question.question, answers: selected });
			}
			const content = answers
				.map((answer) => `Question: ${answer.question}\nAnswer: ${answer.answers.join(", ")}`)
				.join("\n\n");
			return textResult(content, { kind: "answers", title: "User answered questions", subtitle: content });
		},
		renderCall: () => new Text("", 0, 0),
		renderResult: renderPlanToolResult,
	};

	const enterPlanModeTool: ToolDefinition<typeof EmptySchema, PlanRenderDetails> = {
		name: ENTER_PLAN_MODE_TOOL_NAME,
		label: "Enter Plan Mode",
		description: buildEnterPlanModeDescription(),
		promptSnippet: "request read-only planning before a genuinely ambiguous implementation",
		parameters: EmptySchema,
		renderShell: "self",
		executionMode: "sequential",
		async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
			if (state.phase !== "inactive") {
				ensurePlanIdentity(ctx);
				return textResult(`Plan mode is already active. Plan file: ${state.planPath}`, {
					kind: "entered",
					title: "Plan mode already active",
					planPath: state.planPath,
				});
			}
			if (!ctx.hasUI) {
				return textResult(
					"Entering plan mode requires user approval in an interactive session.",
					{ kind: "enter-declined", title: "Plan mode unavailable", subtitle: "Interactive approval required" },
					true,
				);
			}
			const approved = await ctx.ui.confirm(
				"Enter plan mode?",
				"Claude wants to explore the codebase and design an implementation approach. No code changes will be made until you approve the plan.",
			);
			if (!approved) {
				return textResult(
					"The user declined plan mode. Continue with the user's requested work using the current tool set.",
					{ kind: "enter-declined", title: "User declined to enter plan mode" },
				);
			}
			const entered = enterPlanMode(ctx);
			return textResult(`Entered plan mode.\n\n${entered.prompt}`, {
				kind: "entered",
				title: "Entered plan mode",
				subtitle: "Claude is now exploring and designing an implementation approach.",
				planPath: state.planPath,
			});
		},
		renderCall: () => new Text("", 0, 0),
		renderResult: renderPlanToolResult,
	};

	const exitPlanModeTool: ToolDefinition<typeof ExitPlanModeSchema, PlanRenderDetails> = {
		name: EXIT_PLAN_MODE_TOOL_NAME,
		label: "Exit Plan Mode",
		description: buildExitPlanModeDescription(),
		promptSnippet: "present the completed plan file for approval",
		parameters: ExitPlanModeSchema,
		renderShell: "self",
		executionMode: "sequential",
		async execute(_toolCallId, { plan: submittedPlan }, _signal, _onUpdate, ctx) {
			if (state.phase !== "planning") {
				return textResult(
					"ExitPlanMode can only be used while plan mode is active.",
					{ kind: "cancelled", title: "Not in plan mode" },
					true,
				);
			}
			ensurePlanIdentity(ctx);
			if (submittedPlan?.trim()) writePlanFile(state.planPath!, submittedPlan);
			let plan = readPlanFile(state.planPath);
			if (!plan?.trim()) {
				return textResult(
					`No plan was found at ${state.planPath}. Write a complete plan to that file or pass it in ExitPlanMode's plan argument before requesting approval.`,
					{ kind: "cancelled", title: "Plan file is empty", planPath: state.planPath },
					true,
				);
			}
			if (!ctx.hasUI) {
				return textResult(`Plan ready for approval, but no interactive UI is available.\n\n${plan}`, {
					kind: "current-plan",
					title: "Plan ready for approval",
					planPath: state.planPath,
					plan,
				});
			}

			while (true) {
				const choice = await ctx.ui.select("Ready to implement?", [
					"Yes, start implementing",
					"Yes, clear context and start implementing",
					"No, keep planning",
					"Edit the plan",
				]);

				if (choice === "Edit the plan") {
					const edited = await editCurrentPlan(ctx);
					if (edited !== null) plan = edited;
					continue;
				}

				if (choice === "Yes, start implementing") {
					leavePlanMode(ctx);
					return textResult(
						`User approved the plan. You can now start coding.\n\nPlan file: ${state.planPath}\n\n## Approved Plan\n${plan}`,
						{ kind: "approved", title: "User approved Claude's plan", planPath: state.planPath, plan },
					);
				}

				if (choice === "Yes, clear context and start implementing") {
					state = {
						...state,
						phase: "awaiting-clear-context",
						pendingExecution: { plan, planPath: state.planPath! },
					};
					persistState();
					return textResult(
						"User approved the plan and requested a clean execution context. End this turn now; implementation will start after compaction.",
						{
							kind: "approved-clear",
							title: "User approved Claude's plan",
							subtitle: "Context will be compacted before implementation.",
							planPath: state.planPath,
							plan,
						},
					);
				}

				const feedback = await ctx.ui.input("Keep planning", "What should Claude change? (optional)");
				return textResult(
					`The user rejected the plan and chose to remain in plan mode.\n\nRejected plan:\n${plan}${
						feedback?.trim() ? `\n\nUser feedback:\n${feedback.trim()}` : ""
					}`,
					{
						kind: "rejected",
						title: "User rejected Claude's plan",
						planPath: state.planPath,
						plan,
						feedback: feedback?.trim() || undefined,
					},
				);
			}
		},
		renderCall: () => new Text("", 0, 0),
		renderResult: renderPlanToolResult,
	};

	pi.registerTool(askUserQuestionTool);
	pi.registerTool(enterPlanModeTool);
	pi.registerTool(exitPlanModeTool);
	pi.registerMessageRenderer(PLAN_MODE_DISPLAY_TYPE, planMessageRenderer);
	pi.registerMessageRenderer(PLAN_MODE_EXECUTION_TYPE, planMessageRenderer);

	pi.registerCommand("plan", {
		description: "Enable plan mode or view/edit the current session plan",
		getArgumentCompletions: (prefix) =>
			["open"].filter((value) => value.startsWith(prefix)).map((value) => ({ value, label: value })),
		handler: async (args, ctx) => {
			const trimmed = args.trim();
			if (state.phase === "inactive") {
				enterPlanMode(ctx);
				pi.sendMessage(
					{
						customType: PLAN_MODE_DISPLAY_TYPE,
						content: "Entered plan mode",
						display: true,
						details: {
							kind: "entered",
							title: "Entered plan mode",
							subtitle: "Claude is now exploring and designing an implementation approach.",
							planPath: state.planPath,
						} satisfies PlanRenderDetails,
					},
					{ triggerTurn: false },
				);
				if (trimmed && trimmed !== "open") pi.sendUserMessage(trimmed);
				return;
			}

			if (trimmed === "open") {
				const edited = await editCurrentPlan(ctx);
				ctx.ui.notify(edited === null ? "Plan edit cancelled." : `Plan saved to ${state.planPath}`, "info");
				return;
			}
			if (trimmed) {
				pi.sendUserMessage(trimmed);
				return;
			}
			const plan = readPlanFile(state.planPath);
			pi.sendMessage(
				{
					customType: PLAN_MODE_DISPLAY_TYPE,
					content: plan ?? "No plan written yet.",
					display: true,
					details: {
						kind: "current-plan",
						title: plan ? "Current Plan" : "No plan written yet",
						planPath: state.planPath,
						plan: plan ?? undefined,
					} satisfies PlanRenderDetails,
				},
				{ triggerTurn: false },
			);
		},
	});

	pi.registerShortcut(PLAN_MODE_SHORTCUT, {
		description: "Enter or show plan mode",
		handler: async (ctx) => {
			if (state.phase === "inactive") {
				enterPlanMode(ctx);
				ctx.ui.notify("Plan mode enabled. Only the plan file may be edited.", "info");
			} else {
				const plan = readPlanFile(state.planPath);
				ctx.ui.notify(plan ? `Current plan: ${state.planPath}` : `Plan file: ${state.planPath}`, "info");
			}
		},
	});

	pi.on("tool_call", (event, ctx) => {
		if (state.phase === "inactive") return;

		if (isToolCallEventType("bash", event)) {
			const decision = checkPlanReadOnlyCommand(event.input.command);
			if (!decision.safe) {
				return {
					block: true,
					reason: `Plan mode blocked this command: ${decision.reason ?? "not read-only"}.`,
				};
			}
			return;
		}
		if (isToolCallEventType("edit", event) || isToolCallEventType("write", event)) {
			const path =
				(event.input as { path?: unknown; file_path?: unknown }).path ??
				(event.input as { file_path?: unknown }).file_path;
			if (!isCurrentPlanFile(path, state.planPath, ctx.cwd)) {
				return {
					block: true,
					reason: `Plan mode is read-only. The only writable file is ${state.planPath}.`,
				};
			}
			return;
		}

		const allowed = new Set<string>([
			...BUILTIN_READ_ONLY_TOOLS,
			ASK_USER_QUESTION_TOOL_NAME,
			EXIT_PLAN_MODE_TOOL_NAME,
		]);
		if (!allowed.has(event.toolName)) {
			return {
					block: true,
					reason: `Tool ${event.toolName} is unavailable in plan mode because it is not known to be read-only.`,
			};
		}
	});

	pi.on("before_agent_start", () => {
		if (state.phase === "inactive") {
			if (!state.needsExitReminder || !state.planPath) return;
			const planPath = state.planPath;
			state = { ...state, needsExitReminder: false };
			persistState();
			return {
				message: {
					customType: PLAN_MODE_REMINDER_TYPE,
					content: buildPlanModeExitPrompt(planPath, readPlanFile(planPath)),
					display: false,
				},
			};
		}
		if (!state.planPath) return;

		let content: string | undefined;
		const planExists = readPlanFile(state.planPath) !== null;
		if (state.reentryPending || state.forceFullReminder || state.reminderCount === 0) {
			content = buildFullPlanModePrompt({
				planPath: state.planPath,
				planExists,
				reentry: state.reentryPending,
			});
			state = {
				...state,
				reentryPending: false,
				forceFullReminder: false,
				humanTurnsSinceReminder: 0,
				reminderCount: state.reminderCount + 1,
			};
		} else {
			const turns = state.humanTurnsSinceReminder + 1;
			if (turns >= HUMAN_TURNS_BETWEEN_REMINDERS) {
				const nextReminder = state.reminderCount + 1;
				content =
					(nextReminder - 1) % FULL_REMINDER_EVERY === 0
						? buildFullPlanModePrompt({ planPath: state.planPath, planExists })
						: buildSparsePlanModePrompt(state.planPath);
				state = { ...state, humanTurnsSinceReminder: 0, reminderCount: nextReminder };
			} else {
				state = { ...state, humanTurnsSinceReminder: turns };
			}
		}
		persistState();
		if (!content) return;
		return {
			message: {
				customType: PLAN_MODE_REMINDER_TYPE,
				content,
				display: false,
			},
		};
	});

	pi.on("context", (event) => {
		if (state.phase === "inactive") {
			return {
				messages: event.messages.filter(
					(message) =>
						!((message as AgentMessage & { customType?: string }).customType === PLAN_MODE_REMINDER_TYPE),
				),
			};
		}
		if (!state.planPath) return;
		const hasRecentReminder = event.messages
			.slice(-40)
			.some((message) => (message as AgentMessage & { customType?: string }).customType === PLAN_MODE_REMINDER_TYPE);
		if (hasRecentReminder) return;
		const emergencyReminder: CustomMessage = {
			role: "custom",
			customType: PLAN_MODE_REMINDER_TYPE,
			content: buildSparsePlanModePrompt(state.planPath),
			display: false,
			timestamp: Date.now(),
		};
		return { messages: [...event.messages, emergencyReminder] };
	});

	pi.on("agent_settled", (_event, ctx) => {
		if (state.phase !== "awaiting-clear-context" || !state.pendingExecution) return;
		const pending = state.pendingExecution;
		const savedTools = state.toolsBeforePlan;
		state = {
			...state,
			phase: "inactive",
			toolsBeforePlan: undefined,
			hasExitedInSession: true,
			needsExitReminder: false,
			reentryPending: false,
			forceFullReminder: false,
			pendingExecution: undefined,
		};
		restoreNormalTools(savedTools);
		persistState();
		updateStatus(ctx);

		let delivered = false;
		const deliver = () => {
			if (delivered) return;
			delivered = true;
			pi.sendMessage(
				{
					customType: PLAN_MODE_EXECUTION_TYPE,
					content: buildApprovedExecutionPrompt(pending.planPath, pending.plan),
					display: true,
					details: {
						kind: "approved",
						title: "User approved Claude's plan",
						subtitle: "Starting implementation with a compacted context.",
						planPath: pending.planPath,
						plan: pending.plan,
					} satisfies PlanRenderDetails,
				},
				{ triggerTurn: true },
			);
		};

		ctx.compact({
			customInstructions: `Preserve the approved implementation plan at ${pending.planPath}, the user's requirements, critical file paths, and unresolved risks. Remove exploratory noise so implementation can begin immediately.`,
			onComplete: deliver,
			onError: deliver,
		});
	});

	pi.on("session_compact", () => {
		if (state.phase === "inactive") return;
		state = { ...state, forceFullReminder: true };
		persistState();
	});

	async function restoreSession(
		ctx: ExtensionContext,
		reason: "startup" | "reload" | "new" | "resume" | "fork",
	): Promise<void> {
		const previousNormalTools =
			state.phase === "inactive" ? pi.getActiveTools() : (state.toolsBeforePlan ?? lastNormalTools);
		state = findLatestPlanModeState(ctx.sessionManager.getBranch()) ?? createDefaultPlanModeState();
		if (state.toolsBeforePlan) lastNormalTools = [...state.toolsBeforePlan];
		else if (previousNormalTools) lastNormalTools = [...previousNormalTools];

		if (reason === "fork" && state.planPath) {
			const oldPlanPath = state.planPath;
			const identity = createPlanIdentity(ctx.sessionManager.getSessionId());
			copyPlanFile(oldPlanPath, identity.planPath);
			state = { ...state, ...identity };
			persistState();
		}

		if (state.phase === "awaiting-clear-context") {
			state = {
				...state,
				phase: "planning",
				pendingExecution: undefined,
				reentryPending: true,
				forceFullReminder: true,
			};
			persistState();
		}

		if (pi.getFlag("plan") === true && state.phase === "inactive") {
			enterPlanMode(ctx);
		} else if (state.phase === "inactive") {
			restoreNormalTools();
		} else {
			ensurePlanIdentity(ctx);
			syncPlanningTools();
		}
		updateStatus(ctx);
	}

	pi.on("session_start", (event, ctx) => restoreSession(ctx, event.reason));
	pi.on("session_tree", (_event, ctx) => restoreSession(ctx, "reload"));
	pi.on("session_shutdown", (_event, ctx) => {
		ctx.ui.setStatus(PLAN_MODE_STATUS_KEY, undefined);
	});
}
