import type { AgentTool } from "@earendil-works/pi-agent-core";
import { Text } from "@earendil-works/pi-tui";
import { type Static, Type } from "typebox";
import type { ExtensionContext, ToolDefinition } from "../extensions/types.ts";
import type { SessionEntry } from "../session-manager.ts";
import { wrapToolDefinition } from "./tool-definition-wrapper.ts";

export const TODO_WRITE_TOOL_NAME = "TodoWrite";

const todoStatusSchema = Type.Union([Type.Literal("pending"), Type.Literal("in_progress"), Type.Literal("completed")]);

const todoItemSchema = Type.Object(
	{
		content: Type.String({
			minLength: 1,
			description: 'The imperative form describing what needs to be done, for example "Run tests"',
		}),
		status: todoStatusSchema,
		activeForm: Type.String({
			minLength: 1,
			description: 'The present continuous form shown during execution, for example "Running tests"',
		}),
	},
	{ additionalProperties: false },
);

const todoWriteSchema = Type.Object(
	{
		todos: Type.Array(todoItemSchema, {
			description: "The updated todo list. This replaces the entire current list.",
		}),
	},
	{ additionalProperties: false },
);

export type TodoStatus = Static<typeof todoStatusSchema>;
export type TodoItem = Static<typeof todoItemSchema>;
export type TodoWriteToolInput = Static<typeof todoWriteSchema>;

export interface TodoWriteToolDetails {
	oldTodos: TodoItem[];
	newTodos: TodoItem[];
}

const TODO_WRITE_DESCRIPTION =
	"Update the todo list for the current session. To be used proactively and often to track progress and pending tasks. Make sure that at least one task is in_progress at all times. Always provide both content (imperative) and activeForm (present continuous) for each task.";

const TODO_WRITE_PROMPT = `Use this tool to create and manage a structured task list for your current coding session. This helps you track progress, organize complex tasks, and demonstrate thoroughness to the user.
It also helps the user understand the progress of the task and overall progress of their requests.

## When to Use This Tool
Use this tool proactively in these scenarios:

1. Complex multi-step tasks - When a task requires 3 or more distinct steps or actions
2. Non-trivial and complex tasks - Tasks that require careful planning or multiple operations
3. User explicitly requests todo list - When the user directly asks you to use the todo list
4. User provides multiple tasks - When users provide a list of things to be done (numbered or comma-separated)
5. After receiving new instructions - Immediately capture user requirements as todos
6. When you start working on a task - Mark it as in_progress BEFORE beginning work. Ideally you should only have one todo as in_progress at a time
7. After completing a task - Mark it as completed and add any new follow-up tasks discovered during implementation

## When NOT to Use This Tool
Skip using this tool when:

1. There is only a single, straightforward task
2. The task is trivial and tracking it provides no organizational benefit
3. The task can be completed in less than 3 trivial steps
4. The task is purely conversational or informational

Do not use this tool if there is only one trivial task to do. In this case, do the task directly.

## Task States and Management

1. Task states:
   - pending: Task not yet started
   - in_progress: Currently working on (limit to ONE task at a time)
   - completed: Task finished successfully

2. Task descriptions must have two forms:
   - content: The imperative form describing what needs to be done, such as "Run tests"
   - activeForm: The present continuous form shown during execution, such as "Running tests"

3. Task management:
   - Update task status in real time as you work
   - Mark tasks complete IMMEDIATELY after finishing; do not batch completions
   - Exactly ONE task must be in_progress at any time while work remains
   - Complete current tasks before starting new ones
   - Remove tasks that are no longer relevant from the list entirely

4. Task completion requirements:
   - ONLY mark a task as completed when you have FULLY accomplished it
   - If you encounter errors, blockers, or cannot finish, keep the task as in_progress
   - When blocked, create a new task describing what needs to be resolved
   - Never mark a task as completed if tests are failing, implementation is partial, unresolved errors remain, or required files or dependencies could not be found

5. Task breakdown:
   - Create specific, actionable items
   - Break complex tasks into smaller, manageable steps
   - Use clear, descriptive task names
   - Always provide both content and activeForm

When in doubt, use this tool. Being proactive with task management demonstrates attentiveness and ensures you complete all requirements successfully.`;

const SUCCESS_MESSAGE =
	"Todos have been modified successfully. Ensure that you continue to use the todo list to track your progress. Please proceed with the current tasks if applicable";

function cloneTodos(todos: readonly TodoItem[]): TodoItem[] {
	return todos.map((todo) => ({ ...todo }));
}

function parseTodos(value: unknown): TodoItem[] | undefined {
	if (!Array.isArray(value)) return undefined;

	const todos: TodoItem[] = [];
	for (const item of value) {
		if (typeof item !== "object" || item === null) return undefined;
		const record = item as Record<string, unknown>;
		if (
			typeof record.content !== "string" ||
			typeof record.activeForm !== "string" ||
			(record.status !== "pending" && record.status !== "in_progress" && record.status !== "completed")
		) {
			return undefined;
		}
		todos.push({
			content: record.content,
			status: record.status,
			activeForm: record.activeForm,
		});
	}
	return todos;
}

export function parseTodoWriteDetails(value: unknown): TodoWriteToolDetails | undefined {
	if (typeof value !== "object" || value === null) return undefined;
	const record = value as Record<string, unknown>;
	const oldTodos = parseTodos(record.oldTodos);
	const newTodos = parseTodos(record.newTodos);
	if (!oldTodos || !newTodos) return undefined;
	return { oldTodos, newTodos };
}

export function getLatestTodoWriteTodos(entries: readonly SessionEntry[]): TodoItem[] | undefined {
	for (let index = entries.length - 1; index >= 0; index--) {
		const entry = entries[index];
		if (entry?.type !== "message") continue;
		const message = entry.message;
		if (message.role !== "toolResult" || message.toolName !== TODO_WRITE_TOOL_NAME || message.isError) continue;
		const details = parseTodoWriteDetails(message.details);
		if (details) return cloneTodos(details.newTodos);
	}
	return undefined;
}

function getCurrentTodos(ctx: ExtensionContext): TodoItem[] {
	const todos = getLatestTodoWriteTodos(ctx.sessionManager.getBranch()) ?? [];
	return todos.length > 0 && todos.every((todo) => todo.status === "completed") ? [] : todos;
}

export function createTodoWriteToolDefinition(): ToolDefinition<typeof todoWriteSchema, TodoWriteToolDetails> {
	return {
		name: TODO_WRITE_TOOL_NAME,
		label: "Update Todos",
		description: `${TODO_WRITE_DESCRIPTION}\n\n${TODO_WRITE_PROMPT}`,
		promptSnippet: "Update the session task checklist",
		parameters: todoWriteSchema,
		constrainedSampling: { type: "json_schema", strict: "prefer" },
		executionMode: "sequential",
		renderShell: "self",
		async execute(_toolCallId, { todos }, signal, _onUpdate, ctx) {
			if (signal?.aborted) {
				throw new Error("Operation aborted");
			}

			const oldTodos = getCurrentTodos(ctx);
			const newTodos = cloneTodos(todos);

			return {
				content: [{ type: "text", text: SUCCESS_MESSAGE }],
				details: {
					oldTodos: cloneTodos(oldTodos),
					newTodos,
				},
			};
		},
		renderCall(_args, _theme, context) {
			const text = (context.lastComponent as Text | undefined) ?? new Text("", 0, 0);
			text.setText("");
			return text;
		},
		renderResult(result, _options, theme, context) {
			const text = (context.lastComponent as Text | undefined) ?? new Text("", 0, 0);
			if (!context.isError) {
				text.setText("");
				return text;
			}

			const firstText = result.content.find((content) => content.type === "text");
			text.setText(theme.fg("error", firstText?.type === "text" ? firstText.text : "Todo update failed"));
			return text;
		},
	};
}

export function createTodoWriteTool(): AgentTool<typeof todoWriteSchema> {
	return wrapToolDefinition(createTodoWriteToolDefinition());
}
