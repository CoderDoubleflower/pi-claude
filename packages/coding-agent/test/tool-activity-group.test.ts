import type { Component } from "@earendil-works/pi-tui";
import { describe, expect, it } from "vitest";
import { ToolActivityGroupComponent } from "../src/modes/interactive/components/tool-activity-group.ts";
import { initTheme } from "../src/modes/interactive/theme/theme.ts";
import { stripAnsi } from "../src/utils/ansi.ts";

initTheme("dark");

const emptyComponent: Component = {
	render: () => [],
	invalidate: () => {},
};

describe("tool activity group", () => {
	it("renders multiline bash hints as one physical terminal line", () => {
		const group = new ToolActivityGroupComponent(() => {});
		group.addTool({
			toolCallId: "multiline-bash",
			toolName: "bash",
			args: {
				command: 'node -e "\r\nconst value = 1;\nconsole.log(value)\r"',
			},
			kind: "bash",
			component: emptyComponent,
		});

		const lines = group.render(400);
		expect(lines).toHaveLength(3);
		expect(lines.every((line) => !/[\r\n]/.test(line))).toBe(true);
		expect(lines.map(stripAnsi).join("\n")).toContain('⎿  $ node -e " const value = 1; console.log(value) "');

		group.dispose();
	});
});
