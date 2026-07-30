import { describe, expect, it } from "vitest";
import type { ExtensionContext } from "../src/core/extensions/types.ts";
import { createAllToolDefinitions, createCodingTools } from "../src/core/tools/index.ts";
import type { TodoItem, TodoWriteToolDetails } from "../src/core/tools/todo-write.ts";
import { initTheme, theme } from "../src/modes/interactive/theme/theme.ts";
import { stripAnsi } from "../src/utils/ansi.ts";

initTheme("dark");

function createContext(details?: TodoWriteToolDetails): ExtensionContext {
	const branch = details
		? [
				{
					type: "message",
					id: "entry-1",
					parentId: null,
					timestamp: new Date(0).toISOString(),
					message: {
						role: "toolResult",
						toolCallId: "todo-previous",
						toolName: "TodoWrite",
						content: [{ type: "text", text: "ok" }],
						details,
						isError: false,
						timestamp: 0,
					},
				},
			]
		: [];

	return {
		sessionManager: {
			getBranch: () => branch,
		},
	} as unknown as ExtensionContext;
}

function renderText(component: { render(width: number): string[] } | undefined): string {
	return (component?.render(240) ?? []).map(stripAnsi).join("\n");
}

const initialTodos: TodoItem[] = [
	{
		content: "Inspect the source",
		status: "completed",
		activeForm: "Inspecting the source",
	},
	{
		content: "Implement TodoWrite",
		status: "in_progress",
		activeForm: "Implementing TodoWrite",
	},
	{
		content: "Run validation",
		status: "pending",
		activeForm: "Running validation",
	},
];

describe("TodoWrite tool", () => {
	it("is registered as a native coding tool", () => {
		const definitions = createAllToolDefinitions(process.cwd());
		expect(definitions.TodoWrite.name).toBe("TodoWrite");
		expect(createCodingTools(process.cwd()).map((tool) => tool.name)).toContain("TodoWrite");
	});

	it("atomically replaces the list and returns Claude-compatible output details", async () => {
		const definition = createAllToolDefinitions(process.cwd()).TodoWrite;
		const firstResult = await definition.execute(
			"todo-first",
			{ todos: initialTodos },
			undefined,
			undefined,
			createContext(),
		);

		expect(firstResult.details).toEqual({
			oldTodos: [],
			newTodos: initialTodos,
		});
		expect(firstResult.content).toEqual([
			{
				type: "text",
				text: "Todos have been modified successfully. Ensure that you continue to use the todo list to track your progress. Please proceed with the current tasks if applicable",
			},
		]);

		const replacement: TodoItem[] = [
			{
				content: "Inspect the source",
				status: "completed",
				activeForm: "Inspecting the source",
			},
			{
				content: "Implement TodoWrite",
				status: "completed",
				activeForm: "Implementing TodoWrite",
			},
			{
				content: "Run validation",
				status: "in_progress",
				activeForm: "Running validation",
			},
		];

		const secondResult = await definition.execute(
			"todo-second",
			{ todos: replacement },
			undefined,
			undefined,
			createContext(firstResult.details),
		);

		expect(secondResult.details).toEqual({
			oldTodos: initialTodos,
			newTodos: replacement,
		});
	});

	it("clears the current session list after every item is completed", async () => {
		const definition = createAllToolDefinitions(process.cwd()).TodoWrite;
		const completedTodos = initialTodos.map((todo) => ({ ...todo, status: "completed" as const }));
		const completedDetails: TodoWriteToolDetails = {
			oldTodos: initialTodos,
			newTodos: completedTodos,
		};

		const nextTodos: TodoItem[] = [
			{
				content: "Handle a follow-up",
				status: "in_progress",
				activeForm: "Handling a follow-up",
			},
		];

		const result = await definition.execute(
			"todo-after-completion",
			{ todos: nextTodos },
			undefined,
			undefined,
			createContext(completedDetails),
		);

		expect(result.details?.oldTodos).toEqual([]);
		expect(result.details?.newTodos).toEqual(nextTodos);
	});

	it("renders the Claude-style checklist and active form", () => {
		const definition = createAllToolDefinitions(process.cwd()).TodoWrite;
		const component = definition.renderCall?.({ todos: initialTodos }, theme, {
			args: { todos: initialTodos },
			toolCallId: "todo-render",
			invalidate: () => {},
			lastComponent: undefined,
			state: {},
			cwd: process.cwd(),
			executionStarted: true,
			argsComplete: true,
			isPartial: false,
			expanded: false,
			showImages: false,
			isError: false,
		});

		const text = renderText(component);
		expect(text).toContain("Update Todos");
		expect(text).toContain("☒ Inspect the source");
		expect(text).toContain("☐ Implementing TodoWrite");
		expect(text).toContain("☐ Run validation");
		expect(text).not.toContain("☐ Implement TodoWrite");
	});
});
