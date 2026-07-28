import { describe, expect, test } from "vitest";
import { UserMessageComponent } from "../src/modes/interactive/components/user-message.ts";
import { initTheme } from "../src/modes/interactive/theme/theme.ts";
import { stripAnsi } from "../src/utils/ansi.ts";

const OSC133_ZONE_START = "\x1b]133;A\x07";
const OSC133_ZONE_END = "\x1b]133;B\x07";
const OSC133_ZONE_FINAL = "\x1b]133;C\x07";
const BG_RESET = "\x1b[49m";

describe("UserMessageComponent", () => {
	test("sizes the user message background to the rendered prompt height", () => {
		initTheme("dark");

		const component = new UserMessageComponent("hello");
		const lines = component.render(20);

		expect(lines).toHaveLength(1);
		expect(lines[0]).toContain(OSC133_ZONE_START);
		expect(lines[0]).toContain(OSC133_ZONE_END + OSC133_ZONE_FINAL);
		expect(lines[0].endsWith(BG_RESET)).toBe(true);
		expect(lines[0]).toContain("hello");
	});

	test("grows the user message background with wrapped prompt content", () => {
		initTheme("dark");

		const component = new UserMessageComponent("one two three four five six seven eight nine ten");
		const lines = component.render(16);

		expect(lines.length).toBeGreaterThan(1);
		expect(lines.at(-1)?.startsWith(OSC133_ZONE_END + OSC133_ZONE_FINAL)).toBe(true);
		expect(stripAnsi(lines.at(-1) ?? "").trim()).not.toBe("");
	});
});
