const MAX_TRACKED_TOOL_CALLS = 256;

const executionArguments = new Map<string, unknown>();

/**
 * Record the canonical arguments accepted by the runtime for a tool execution.
 *
 * Streaming assistant messages may expose an incomplete argument preview before
 * execution starts. Renderers can use this registry to switch atomically to the
 * exact arguments that the runtime is executing.
 */
export function recordToolExecutionArguments(toolCallId: string, args: unknown): void {
	executionArguments.delete(toolCallId);
	executionArguments.set(toolCallId, args);

	while (executionArguments.size > MAX_TRACKED_TOOL_CALLS) {
		const oldestToolCallId = executionArguments.keys().next().value;
		if (oldestToolCallId === undefined) break;
		executionArguments.delete(oldestToolCallId);
	}
}

/** Return the canonical runtime arguments for a recently executed tool call. */
export function getToolExecutionArguments(toolCallId: string): unknown {
	return executionArguments.get(toolCallId);
}
