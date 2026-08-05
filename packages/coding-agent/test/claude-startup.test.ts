import { stripVTControlCharacters } from "node:util";
import { Container, Text, visibleWidth } from "@earendil-works/pi-tui";
import { beforeAll, describe, expect, it } from "vitest";
import type { AgentSession } from "../src/core/agent-session.ts";
import { installClaudeStartupHeaderUpgrade } from "../src/modes/interactive/components/claude-startup-compat.ts";
import { ClaudeStartupComponent } from "../src/modes/interactive/components/claude-startup.ts";
import { initTheme } from "../src/modes/interactive/theme/theme.ts";

beforeAll(() => {
	initTheme("dark");
});

function plain(lines: string[]): string[] {
	return lines.map((line) => stripVTControlCharacters(line));
}

describe("ClaudeStartupComponent", () => {
	it("renders Claude Code's condensed three-row startup identity", () => {
		const component = new ClaudeStartupComponent(() => ({
			appName: "pi-claude",
			version: "0.83.9",
			model: {
				id: "claude-sonnet-4-5",
				name: "Claude Sonnet 4.5",
				provider: "anthropic",
				reasoning: true,
			},
			thinkingLevel: "high",
			cwd: "/tmp/example-project",
		}));

		const rendered = component.render(72);
		expect(rendered[0]).toMatch(/\x1b\[38;(?:2;215;135;135|5;174)m/);
		const lines = plain(rendered);
		expect(lines).toHaveLength(3);
		expect(lines[0]).toContain("▐▛███▜▌");
		expect(lines[0]).toContain("pi-claude v0.83.9");
		expect(lines[1]).toContain("Claude Sonnet 4.5 · anthropic · high thinking");
		expect(lines[2]).toContain("/tmp/example-project");
		expect(lines.every((line) => visibleWidth(line) <= 72)).toBe(true);
	});

	it("stacks safely on very narrow terminals", () => {
		const component = new ClaudeStartupComponent(() => ({
			appName: "pi-claude",
			version: "0.83.9",
			modelLine: "Coding agent",
			cwd: "/tmp/example-project",
		}));

		const lines = plain(component.render(20));
		expect(lines).toHaveLength(6);
		expect(lines.every((line) => visibleWidth(line) <= 20)).toBe(true);
	});
});

describe("legacy startup header compatibility", () => {
	it("upgrades only the exact startup header and restores Container.addChild", () => {
		const originalAddChild = Container.prototype.addChild;
		const session = {
			model: {
				id: "claude-sonnet-4-5",
				name: "Claude Sonnet 4.5",
				provider: "anthropic",
				reasoning: true,
			},
			thinkingLevel: "high",
			sessionManager: {
				getCwd: () => "/tmp/example-project",
			},
		} as unknown as AgentSession;
		const cleanup = installClaudeStartupHeaderUpgrade(() => session);

		try {
			expect(Container.prototype.addChild).not.toBe(originalAddChild);
			const container = new Container();
			const ordinary = new Text("ordinary message", 0, 0);
			container.addChild(ordinary);
			expect(plain(ordinary.render(40)).join("\n")).toContain("ordinary message");

			const legacyHeader = new Text(
				[
					"pi-claude v0.83.9",
					"Ctrl+C interrupt · Ctrl+D clear/exit · / commands · ! bash",
					"Press Ctrl+O to show full startup help and loaded resources.",
					"",
					"Pi can explain its own features and look up its docs. Ask it how to use or extend Pi.",
				].join("\n"),
				1,
				0,
			);
			container.addChild(legacyHeader);

			expect(Container.prototype.addChild).toBe(originalAddChild);
			const renderedLegacy = plain(legacyHeader.render(72));
			expect(renderedLegacy).toHaveLength(3);
			expect(renderedLegacy.join("\n")).toContain("pi-claude v0.83.9");
			expect(renderedLegacy.join("\n")).toContain("Claude Sonnet 4.5 · anthropic · high thinking");
			expect(renderedLegacy.join("\n")).toContain("/tmp/example-project");
			expect(renderedLegacy.join("\n")).not.toContain("full startup help");
			expect(renderedLegacy.join("\n")).not.toContain("Ctrl+C interrupt");
		} finally {
			cleanup();
		}
	});
});
