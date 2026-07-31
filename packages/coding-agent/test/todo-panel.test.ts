import type { Component, TUI } from "@earendil-works/pi-tui";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ExtensionContext } from "../src/core/extensions/types.ts";
import type { TodoItem } from "../src/core/tools/todo-write.ts";
import { builtInExtensions } from "../src/extensions/index.ts";
import {
	TodoPanelComponent,
	TodoPanelManager,
	TODO_PANEL_HIDE_DELAY_MS,
	TODO_PANEL_WIDGET_KEY,
} from "../src/extensions/todo-panel.ts";
import { initTheme, type Theme, theme } from "../src/modes/interactive/theme/theme.ts";
import { stripAnsi } from "../src/utils/ansi.ts";

initTheme("dark");

type WidgetFactory = (tui: TUI, theme: Theme) => Component;
type WidgetContent = string[] | WidgetFactory | undefined;

interface FakePanelContext {
	ctx: ExtensionContext;
	setIdle(value: boolean): void;
	getWidget(): WidgetContent;
	getWorkingMessage(): string | undefined;
}

function createPanelContext(): FakePanelContext {
	let idle = true;
	let widget: WidgetContent;
	let workingMessage: string | undefined;
	const ctx = {
		mode: "tui",
		isIdle: () => idle,
		ui: {
			setWidget: (key: string, content: WidgetContent) => {
				expect(key).toBe(TODO_PANEL_WIDGET_KEY);
				widget = content;
			},
			setWorkingMessage: (message?: string) => {
				workingMessage = message;
			},
		},
	} as unknown as ExtensionContext;
	return {
		ctx,
		setIdle(value) {
			idle = value;
		},
		getWidget: () => widget,
		getWorkingMessage: () => workingMessage,
	};
}

function renderComponent(component: Component, width = 100): string {
	return component.render(width).map(stripAnsi).join("\n");
}

function renderWidget(content: WidgetContent, rows = 24, width = 100): string {
	if (typeof content !== "function") return "";
	const tui = { terminal: { rows } } as unknown as TUI;
	return renderComponent(content(tui, theme), width);
}

const todos: TodoItem[] = [
	{
		content: "Inspect the source",
		status: "completed",
		activeForm: "Inspecting the source",
	},
	{
		content: "Implement the panel",
		status: "in_progress",
		activeForm: "Implementing the panel",
	},
	{
		content: "Run validation",
		status: "pending",
		activeForm: "Running validation",
	},
];

afterEach(() => {
	vi.useRealTimers();
});

describe("Claude-style todo panel", () => {
	it("is registered as a hidden built-in extension", () => {
		expect(builtInExtensions).toContainEqual(
			expect.objectContaining({ name: "todo-panel", hidden: true }),
		);
	});

	it("matches the standalone Claude task summary and item styling", () => {
		const component = new TodoPanelComponent(todos, theme, () => 24, true);
		const text = renderComponent(component);

		expect(text).toContain("3 tasks (1 done, 1 in progress, 1 open)");
		expect(text).toMatch(/[✔√] Inspect the source/);
		expect(text).toMatch(/[◼■] Implement the panel/);
		expect(text).toMatch(/[◻□] Run validation/);
		expect(text).not.toContain("Implementing the panel");
	});

	it("uses the compact in-spinner layout while work is active", () => {
		const component = new TodoPanelComponent(todos, theme, () => 24, false);
		const text = renderComponent(component);

		expect(text).not.toContain("3 tasks (");
		expect(text).toMatch(/[◼■] Implement the panel/);
	});

	it("prioritizes active work and summarizes tasks hidden by terminal height", () => {
		const manyTodos: TodoItem[] = [
			...todos,
			{ content: "Pending two", status: "pending", activeForm: "Pending two" },
			{ content: "Done two", status: "completed", activeForm: "Done two" },
			{ content: "Pending three", status: "pending", activeForm: "Pending three" },
		];
		const component = new TodoPanelComponent(manyTodos, theme, () => 16, true);
		const text = renderComponent(component);

		expect(text).toContain("Implement the panel");
		expect(text).toContain("… +");
		expect(text).toMatch(/pending|completed/);
	});

	it("stays fixed, uses activeForm for working text, and hides five seconds after completion", () => {
		vi.useFakeTimers();
		const fake = createPanelContext();
		const manager = new TodoPanelManager();

		manager.update(fake.ctx, todos);
		expect(renderWidget(fake.getWidget())).toContain("3 tasks (1 done, 1 in progress, 1 open)");

		fake.setIdle(false);
		manager.renderForActivity(fake.ctx);
		expect(renderWidget(fake.getWidget())).not.toContain("3 tasks (");
		expect(fake.getWorkingMessage()).toBe("Implementing the panel");

		const completed = todos.map((todo) => ({ ...todo, status: "completed" as const }));
		manager.update(fake.ctx, completed);
		expect(fake.getWidget()).toBeDefined();
		vi.advanceTimersByTime(TODO_PANEL_HIDE_DELAY_MS - 1);
		expect(fake.getWidget()).toBeDefined();
		vi.advanceTimersByTime(1);
		expect(fake.getWidget()).toBeUndefined();
		expect(fake.getWorkingMessage()).toBeUndefined();
	});
});
