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
import { stripAnsi } from "../../utils/ansi.ts";
import type { ToolDefinition } from "../extensions/types.ts";
import { type BashToolInput, type BashToolOptions, createBashTool, createBashToolDefinition } from "./bash.ts";
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

const BASH_CALL_PREVIEW_MAX_LINES = 2;
const BASH_CALL_PREVIEW_MAX_WIDTH = 160;

class ClaudeBashCallComponent implements Component {
	private readonly lines: string[];

	constructor(lines: string[]) {
		this.lines = lines;
	}

	render(width: number): string[] {
		const contentLines = this.lines.filter((line) => stripAnsi(line).trim().length > 0);
		if (contentLines.length === 0) return [];

		const maxLineWidth = Math.max(1, Math.min(width, BASH_CALL_PREVIEW_MAX_WIDTH));
		const rendered: string[] = [];
		let remainingWidth = BASH_CALL_PREVIEW_MAX_WIDTH;
		let truncated = contentLines.length > BASH_CALL_PREVIEW_MAX_LINES;

		for (const line of contentLines.slice(0, BASH_CALL_PREVIEW_MAX_LINES)) {
			const allowedWidth = Math.max(1, Math.min(maxLineWidth, remainingWidth));
			if (visibleWidth(line) > allowedWidth) {
				rendered.push(truncateToWidth(line, allowedWidth, "…"));
				truncated = true;
				break;
			}
			rendered.push(line);
			remainingWidth -= visibleWidth(line);
			if (remainingWidth <= 0) {
				truncated = contentLines.length > rendered.length;
				break;
			}
		}

		if (truncated && rendered.length > 0) {
			const lastIndex = rendered.length - 1;
			const lastLine = rendered[lastIndex] ?? "";
			if (!stripAnsi(lastLine).endsWith("…")) {
				rendered[lastIndex] = truncateToWidth(`${lastLine}…`, maxLineWidth, "…");
			}
		}
		return rendered;
	}

	invalidate(): void {}
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

			const displayArgs: BashToolInput =
				state.canonicalExecutionArgs ?? (context.executionStarted || !context.isPartial ? args : { command: "" });
			const lastComponent =
				context.lastComponent instanceof ClaudeBashCallComponent ? undefined : context.lastComponent;

			if (!context.executionStarted || context.expanded) {
				return renderCall(displayArgs, activeTheme, { ...context, lastComponent });
			}

			const commandLines =
				typeof displayArgs.command === "string"
					? displayArgs.command.split(String.fromCharCode(10))
					: [displayArgs.command];
			const timeoutSuffix =
				typeof displayArgs.timeout === "number"
					? activeTheme.fg("muted", ` (timeout ${displayArgs.timeout}s)`)
					: "";
			const lines = commandLines.map((command, index) => {
				const commandDisplay = command && command.length > 0 ? command : "...";
				return (
					activeTheme.fg("toolTitle", activeTheme.bold(`$ ${commandDisplay}`)) + (index === 0 ? timeoutSuffix : "")
				);
			});
			return new ClaudeBashCallComponent(lines);
		},
	};
}

export function createToolDefinition(toolName: ToolName, cwd: string, options?: ToolsOptions): ToolDef {
	switch (toolName) {
		case "read":
			return createReadToolDefinition(cwd, options?.read);
		case "bash":
			return createBashDisplayToolDefinition(cwd, options?.bash);
		case "edit":
			return createEditToolDefinition(cwd, options?.edit);
		case "write":
			return createWriteToolDefinition(cwd, options?.write);
		case "grep":
			return createGrepToolDefinition(cwd, options?.grep);
		case "find":
			return createFindToolDefinition(cwd, options?.find);
		case "ls":
			return createLsToolDefinition(cwd, options?.ls);
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
