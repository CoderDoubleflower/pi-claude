import { describe, expect, it } from "vitest";
import { BUILTIN_SLASH_COMMANDS, isQuitSlashCommand } from "../src/core/slash-commands.ts";

describe("slash commands", () => {
	it.each(["/exit", "/quit"])("treats %s as a quit command", (command) => {
		expect(isQuitSlashCommand(command)).toBe(true);
	});

	it.each(["exit", "/exit now", "/quit ", "/new"])("does not treat %s as a quit command", (command) => {
		expect(isQuitSlashCommand(command)).toBe(false);
	});

	it("registers both exit spellings for autocomplete", () => {
		const names = BUILTIN_SLASH_COMMANDS.map((command) => command.name);
		expect(names).toContain("exit");
		expect(names).toContain("quit");
	});
});
