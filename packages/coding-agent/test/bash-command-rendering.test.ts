import { describe, expect, it } from "vitest";
import { createAllToolDefinitions } from "../src/core/tools/index.ts";
import { wrapToolDefinition } from "../src/core/tools/tool-definition-wrapper.ts";
import { initTheme, theme } from "../src/modes/interactive/theme/theme.ts";
import { stripAnsi } from "../src/utils/ansi.ts";

initTheme("dark");

function createRenderContext(toolCallId: string, overrides: Record<string, unknown> = {}): any {
	return {
		args: { command: "" },
		toolCallId,
		invalidate: () => {},
		lastComponent: undefined,
		state: {},
		cwd: process.cwd(),
		executionStarted: false,
		argsComplete: false,
		isPartial: true,
		expanded: false,
		showImages: false,
		isError: false,
		...overrides,
	};
}

function renderLines(component: { render(width: number): string[] } | undefined, width = 240): string[] {
	return (component?.render(width) ?? [])
		.map((line) => stripAnsi(line))
		.filter((line) => line.trim().length > 0);
}

describe("Bash command rendering", () => {
	it("reveals complete event arguments as soon as execution starts", () => {
		const toolCallId = "bash-start-render";
		const definition = createAllToolDefinitions(process.cwd()).bash;
		const renderCall = definition.renderCall;
		expect(renderCall).toBeDefined();

		const context = createRenderContext(toolCallId);
		const pendingComponent = renderCall?.({ command: "echo par" }, theme, context);
		const pendingText = renderLines(pendingComponent).join("\n");
		expect(pendingText).toContain("$ ...");
		expect(pendingText).not.toContain("echo par");

		context.executionStarted = true;
		context.argsComplete = true;
		context.lastComponent = pendingComponent;
		const runningComponent = renderCall?.({ command: "echo complete-command", timeout: 5 }, theme, context);
		const runningText = renderLines(runningComponent).join("\n");
		expect(runningText).toContain("$ echo complete-command");
		expect(runningText).toContain("timeout 5s");
		expect(runningText).not.toContain("echo par");
	});

	it("prefers canonical runtime arguments after they are recorded", async () => {
		const toolCallId = "bash-canonical-render";
		const runtimeTool = wrapToolDefinition({
			name: "bash",
			label: "bash",
			description: "test Bash tool",
			parameters: {} as any,
			execute: async () => ({ content: [], details: undefined }),
		});
		await runtimeTool.execute(toolCallId, { command: "echo canonical-command", timeout: 5 }, undefined, undefined);

		const definition = createAllToolDefinitions(process.cwd()).bash;
		const context = createRenderContext(toolCallId, {
			executionStarted: true,
			argsComplete: true,
		});
		const component = definition.renderCall?.({ command: "echo stale-command" }, theme, context);
		const text = renderLines(component).join("\n");
		expect(text).toContain("$ echo canonical-command");
		expect(text).toContain("timeout 5s");
		expect(text).not.toContain("stale-command");
	});

	it("compacts multiline and long calls to one line until expanded", () => {
		const definition = createAllToolDefinitions(process.cwd()).bash;
		const context = createRenderContext("bash-compact-render", {
			executionStarted: true,
			argsComplete: true,
		});
		const multilineCommand = "printf 'first\\n'\nprintf 'second\\n'";

		const compactMultiline = renderLines(definition.renderCall?.({ command: multilineCommand }, theme, context));
		expect(compactMultiline).toHaveLength(1);
		expect(compactMultiline[0]).toContain("printf 'first\\n'");
		expect(compactMultiline[0]).toContain("printf 'second\\n'");

		const longCommand = `echo ${"x".repeat(180)}`;
		const compactLong = renderLines(definition.renderCall?.({ command: longCommand }, theme, context));
		expect(compactLong).toHaveLength(1);
		expect(compactLong[0]?.length).toBeLessThanOrEqual(120);
		expect(compactLong[0]).not.toContain(longCommand);

		context.expanded = true;
		const expandedMultiline = renderLines(definition.renderCall?.({ command: multilineCommand }, theme, context));
		expect(expandedMultiline.length).toBeGreaterThan(1);
	});

	it("renders persisted arguments for completed and restored calls", () => {
		const definition = createAllToolDefinitions(process.cwd()).bash;
		const context = createRenderContext("bash-restored-render", {
			executionStarted: true,
			argsComplete: true,
			isPartial: false,
		});

		const component = definition.renderCall?.({ command: "echo restored" }, theme, context);
		const text = renderLines(component).join("\n");
		expect(text).toContain("$ echo restored");
	});
});
