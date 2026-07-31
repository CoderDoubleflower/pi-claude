#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_region(path: str, start: str, end: str, replacement: str) -> None:
    file_path = ROOT / path
    content = file_path.read_text(encoding="utf-8")
    start_index = content.index(start)
    end_index = content.index(end, start_index)
    file_path.write_text(content[:start_index] + replacement + content[end_index:], encoding="utf-8")


replace_region(
    "packages/coding-agent/src/core/tools/index.ts",
    "class ClaudeBashCallComponent implements Component {",
    "export function createToolDefinition",
    r'''class ClaudeBashCallComponent implements Component {
	private readonly components: Component[];

	constructor(components: Component[]) {
		this.components = components;
	}

	getInnerComponent(): Component | undefined {
		return this.components[0];
	}

	render(width: number): string[] {
		const contentLines = this.components
			.flatMap((component) => component.render(width))
			.filter((line) => stripAnsi(line).trim().length > 0);
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

	invalidate(): void {
		for (const component of this.components) component.invalidate?.();
	}
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
				state.canonicalExecutionArgs ??
				(context.executionStarted || !context.isPartial ? args : { command: "" });
			const lastComponent =
				context.lastComponent instanceof ClaudeBashCallComponent
					? context.lastComponent.getInnerComponent()
					: context.lastComponent;

			if (!context.executionStarted || context.expanded) {
				return renderCall(displayArgs, activeTheme, { ...context, lastComponent });
			}

			const commandLines =
				typeof displayArgs.command === "string" ? displayArgs.command.split("\n") : [displayArgs.command];
			const components = commandLines
				.map((command, index) =>
					renderCall(
						{
							...displayArgs,
							command: command ?? "",
							...(index === 0 ? {} : { timeout: undefined }),
						},
						activeTheme,
						{ ...context, lastComponent: index === 0 ? lastComponent : undefined },
					),
				)
				.filter((component): component is Component => component !== undefined);
			return new ClaudeBashCallComponent(components);
		},
	};
}

''',
)

read_path = ROOT / "packages/coding-agent/src/core/tools/read.ts"
read_content = read_path.read_text(encoding="utf-8")
read_content = read_content.replace(
    'import type { ToolDefinition, ToolRenderResultOptions } from "../extensions/types.ts";',
    'import type { ToolDefinition } from "../extensions/types.ts";',
)
read_content = read_content.replace(
    "renderResult(result, options, theme, context) {",
    "renderResult(result, _options, theme, context) {",
)
read_path.write_text(read_content, encoding="utf-8")

test_path = ROOT / "packages/coding-agent/test/claude-tool-display.test.ts"
test_content = test_path.read_text(encoding="utf-8")
test_content = test_content.replace(
    'expect(output).toContain("renderToolUse");',
    'expect(output).toContain("src/a.ts");',
)
test_path.write_text(test_content, encoding="utf-8")
