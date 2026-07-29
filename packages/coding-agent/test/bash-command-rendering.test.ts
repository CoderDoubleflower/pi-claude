import { describe, expect, it } from "vitest";
import { createAllToolDefinitions } from "../src/core/tools/index.ts";
import { wrapToolDefinition } from "../src/core/tools/tool-definition-wrapper.ts";
import { initTheme, theme } from "../src/modes/interactive/theme/theme.ts";
import { stripAnsi } from "../src/utils/ansi.ts";

initTheme("dark");

describe("Bash command rendering", () => {
	it("keeps streamed arguments hidden until canonical execution arguments are available", async () => {
		const toolCallId = "bash-atomic-render";
		const state: Record<string, unknown> = {};
		const definition = createAllToolDefinitions(process.cwd()).bash;
		const renderCall = definition.renderCall;
		expect(renderCall).toBeDefined();

		const context: any = {
			args: { command: "echo par" },
			toolCallId,
			invalidate: () => {},
			lastComponent: undefined,
			state,
			cwd: process.cwd(),
			executionStarted: false,
			argsComplete: false,
			isPartial: true,
			expanded: false,
			showImages: false,
			isError: false,
		};

		const pendingComponent = renderCall?.({ command: "echo par" }, theme, context);
		const pendingText = stripAnsi(pendingComponent?.render(120).join("\n") ?? "");
		expect(pendingText).toContain("$ ...");
		expect(pendingText).not.toContain("echo par");

		const runtimeTool = wrapToolDefinition({
			name: "bash",
			label: "bash",
			description: "test Bash tool",
			parameters: {} as any,
			execute: async () => ({ content: [], details: undefined }),
		});
		const canonicalArgs = { command: "echo complete-command", timeout: 5 };
		await runtimeTool.execute(toolCallId, canonicalArgs, undefined, undefined);

		context.executionStarted = true;
		context.argsComplete = true;
		context.lastComponent = pendingComponent;
		const runningComponent = renderCall?.({ command: "echo par" }, theme, context);
		const runningText = stripAnsi(runningComponent?.render(120).join("\n") ?? "");
		expect(runningText).toContain("$ echo complete-command");
		expect(runningText).toContain("timeout 5s");
		expect(runningText).not.toContain("echo par");
	});
});
