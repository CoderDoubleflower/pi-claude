export {
	type BashOperations,
	type BashSpawnContext,
	type BashSpawnHook,
	type BashToolDetails,
	type BashToolInput,
	type BashToolOptions,
	createBashTool,
	createBashToolDefinition,
	createLocalBashOperations,
} from "./bash.ts";
export {
	createEditTool,
	createEditToolDefinition,
	type EditOperations,
	type EditToolDetails,
	type EditToolInput,
	type EditToolOptions,
} from "./edit.ts";
export { withFileMutationQueue } from "./file-mutation-queue.ts";
export {
	createFindTool,
	createFindToolDefinition,
	type FindOperations,
	type FindToolDetails,
	type FindToolInput,
	type FindToolOptions,
} from "./find.ts";
export {
	createGrepTool,
	createGrepToolDefinition,
	type GrepOperations,
	type GrepToolDetails,
	type GrepToolInput,
	type GrepToolOptions,
} from "./grep.ts";
export {
	createLsTool,
	createLsToolDefinition,
	type LsOperations,
	type LsToolDetails,
	type LsToolInput,
	type LsToolOptions,
} from "./ls.ts";
export {
	createReadTool,
	createReadToolDefinition,
	type ReadOperations,
	type ReadToolDetails,
	type ReadToolInput,
	type ReadToolOptions,
} from "./read.ts";
export {
	createTodoWriteTool,
	createTodoWriteToolDefinition,
	type TodoItem,
	type TodoStatus,
	type TodoWriteToolDetails,
	type TodoWriteToolInput,
} from "./todo-write.ts";
export {
	DEFAULT_MAX_BYTES,
	DEFAULT_MAX_LINES,
	formatSize,
	type TruncationOptions,
	type TruncationResult,
	truncateHead,
	truncateLine,
	truncateTail,
} from "./truncate.ts";
export {
	createWriteTool,
	createWriteToolDefinition,
	type WriteOperations,
	type WriteToolInput,
	type WriteToolOptions,
} from "./write.ts";

import type { AgentTool } from "@earendil-works/pi-agent-core";
import { type Component, truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import type { ToolDefinition } from "../extensions/types.ts";
import { stripAnsi } from "../../utils/ansi.ts";
import {
	type BashToolInput,
	type BashToolOptions,
	createBashTool,
	createBashToolDefinition,
} from "./bash.ts";
import { createEditTool, createEditToolDefinition, type EditToolOptions } from "./edit.ts";
import { getToolExecutionArguments } from "./execution-arguments.ts";
import { createFindTool, createFindToolDefinition, type FindToolOptions } from "./find.ts";
import { createGrepTool, createGrepToolDefinition, type GrepToolOptions } from "./grep.ts";
import { createLsTool, createLsToolDefinition, type LsToolOptions } from "./ls.ts";
import { createReadTool, createReadToolDefinition, type ReadToolOptions } from "./read.ts";
import { createTodoWriteTool, createTodoWriteToolDefinition } from "./todo-write.ts";
import { createWriteTool, createWriteToolDefinition, type WriteToolOptions } from "./write.ts";

export type Tool = AgentTool<any>;
export type ToolDef = ToolDefinition<any, any>;
export type ToolName = "read" | "bash" | "edit" | "write" | "grep" | "find" | "ls" | "TodoWrite";
export const allToolNames: Set<ToolName> = new Set([
	"read",
	"bash",
	"edit",
	"write",
	"grep",
	"find",
	"ls",
	"TodoWrite",
]);

export interface ToolsOptions {
	read?: ReadToolOptions;
	bash?: BashToolOptions;
	write?: WriteToolOptions;
	edit?: EditToolOptions;
	grep?: GrepToolOptions;
	find?: FindToolOptions;
	ls?: LsToolOptions;
}

type BashDisplayState = {
	canonicalExecutionArgs?: BashToolInput;
};

const TOOL_CALL_PREVIEW_MAX_WIDTH = 120;

class CompactToolCallComponent implements Component {
	private readonly component: Component;

	constructor(component: Component) {
		this.component = component;
	}

	getInnerComponent(): Component {
		return this.component;
	}

	render(width: number): string[] {
		const contentLines = this.component
			.render(width)
			.filter((line) => stripAnsi(line).trim().length > 0);
		if (contentLines.length === 0) return [];

		const singleLine = contentLines.map((line) => line.trim()).join(" ");
		const needsCompaction =
			contentLines.length > 1 || visibleWidth(singleLine) > TOOL_CALL_PREVIEW_MAX_WIDTH;
		if (!needsCompaction) return contentLines;

		const previewWidth = Math.max(1, Math.min(width, TOOL_CALL_PREVIEW_MAX_WIDTH));
		return [truncateToWidth(singleLine, previewWidth)];
	}

	invalidate(): void {
		this.component.invalidate?.();
	}
}

function withCompactCallDisplay<T extends ToolDef>(definition: T): T {
	const renderCall = definition.renderCall;
	if (!renderCall) return definition;

	return {
		...definition,
		renderCall(args, activeTheme, context) {
			const lastComponent =
				context.lastComponent instanceof CompactToolCallComponent
					? context.lastComponent.getInnerComponent()
					: context.lastComponent;
			const component = renderCall(args, activeTheme, { ...context, lastComponent });
			if (!context.executionStarted || context.expanded) return component;
			return new CompactToolCallComponent(component);
		},
	} as T;
}

function createBashDisplayToolDefinition(
	cwd: string,
	options?: BashToolOptions,
): ReturnType<typeof createBashToolDefinition> {
	const definition = createBashToolDefinition(cwd, options);
	const renderCall = definition.renderCall;
	if (!renderCall) return definition;

	return {
		...definition,
		renderCall(args, activeTheme, context) {
			const state = context.state as typeof context.state & BashDisplayState;
			const executionArgs = getToolExecutionArguments<BashToolInput>(context.toolCallId);
			if (executionArgs !== undefined) {
				state.canonicalExecutionArgs = executionArgs;
			}

			// Keep streamed command fragments hidden, then reveal the complete event
			// arguments as soon as execution starts. Canonical runtime arguments win
			// once the execution wrapper has recorded them.
			const displayArgs: BashToolInput =
				state.canonicalExecutionArgs ??
				(context.executionStarted || !context.isPartial ? args : { command: "" });
			return renderCall(displayArgs, activeTheme, context);
		},
	};
}

export function createToolDefinition(toolName: ToolName, cwd: string, options?: ToolsOptions): ToolDef {
	switch (toolName) {
		case "read":
			return withCompactCallDisplay(createReadToolDefinition(cwd, options?.read));
		case "bash":
			return withCompactCallDisplay(createBashDisplayToolDefinition(cwd, options?.bash));
		case "edit":
			return withCompactCallDisplay(createEditToolDefinition(cwd, options?.edit));
		case "write":
			return withCompactCallDisplay(createWriteToolDefinition(cwd, options?.write));
		case "grep":
			return withCompactCallDisplay(createGrepToolDefinition(cwd, options?.grep));
		case "find":
			return withCompactCallDisplay(createFindToolDefinition(cwd, options?.find));
		case "ls":
			return withCompactCallDisplay(createLsToolDefinition(cwd, options?.ls));
		case "TodoWrite":
			return createTodoWriteToolDefinition();
		default:
			throw new Error(`Unknown tool name: ${toolName}`);
	}
}

export function createTool(toolName: ToolName, cwd: string, options?: ToolsOptions): Tool {
	switch (toolName) {
		case "read":
			return createReadTool(cwd, options?.read);
		case "bash":
			return createBashTool(cwd, options?.bash);
		case "edit":
			return createEditTool(cwd, options?.edit);
		case "write":
			return createWriteTool(cwd, options?.write);
		case "grep":
			return createGrepTool(cwd, options?.grep);
		case "find":
			return createFindTool(cwd, options?.find);
		case "ls":
			return createLsTool(cwd, options?.ls);
		case "TodoWrite":
			return createTodoWriteTool();
		default:
			throw new Error(`Unknown tool name: ${toolName}`);
	}
}

export function createCodingToolDefinitions(cwd: string, options?: ToolsOptions): ToolDef[] {
	return [
		createToolDefinition("read", cwd, options),
		createToolDefinition("bash", cwd, options),
		createToolDefinition("edit", cwd, options),
		createToolDefinition("write", cwd, options),
		createToolDefinition("TodoWrite", cwd, options),
	];
}

export function createReadOnlyToolDefinitions(cwd: string, options?: ToolsOptions): ToolDef[] {
	return [
		createToolDefinition("read", cwd, options),
		createToolDefinition("grep", cwd, options),
		createToolDefinition("find", cwd, options),
		createToolDefinition("ls", cwd, options),
	];
}

export function createAllToolDefinitions(cwd: string, options?: ToolsOptions): Record<ToolName, ToolDef> {
	return {
		read: createToolDefinition("read", cwd, options),
		bash: createToolDefinition("bash", cwd, options),
		edit: createToolDefinition("edit", cwd, options),
		write: createToolDefinition("write", cwd, options),
		grep: createToolDefinition("grep", cwd, options),
		find: createToolDefinition("find", cwd, options),
		ls: createToolDefinition("ls", cwd, options),
		TodoWrite: createToolDefinition("TodoWrite", cwd, options),
	};
}

export function createCodingTools(cwd: string, options?: ToolsOptions): Tool[] {
	return [
		createReadTool(cwd, options?.read),
		createBashTool(cwd, options?.bash),
		createEditTool(cwd, options?.edit),
		createWriteTool(cwd, options?.write),
		createTodoWriteTool(),
	];
}

export function createReadOnlyTools(cwd: string, options?: ToolsOptions): Tool[] {
	return [
		createReadTool(cwd, options?.read),
		createGrepTool(cwd, options?.grep),
		createFindTool(cwd, options?.find),
		createLsTool(cwd, options?.ls),
	];
}

export function createAllTools(cwd: string, options?: ToolsOptions): Record<ToolName, Tool> {
	return {
		read: createReadTool(cwd, options?.read),
		bash: createBashTool(cwd, options?.bash),
		edit: createEditTool(cwd, options?.edit),
		write: createWriteTool(cwd, options?.write),
		grep: createGrepTool(cwd, options?.grep),
		find: createFindTool(cwd, options?.find),
		ls: createLsTool(cwd, options?.ls),
		TodoWrite: createTodoWriteTool(),
	};
}
