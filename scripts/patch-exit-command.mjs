import { readFileSync, rmSync, writeFileSync } from "node:fs";

function replaceOnce(filePath, search, replacement) {
	const source = readFileSync(filePath, "utf8");
	const firstIndex = source.indexOf(search);
	if (firstIndex === -1) {
		throw new Error(`Expected text not found in ${filePath}: ${JSON.stringify(search)}`);
	}
	if (source.indexOf(search, firstIndex + search.length) !== -1) {
		throw new Error(`Expected exactly one match in ${filePath}: ${JSON.stringify(search)}`);
	}
	writeFileSync(filePath, `${source.slice(0, firstIndex)}${replacement}${source.slice(firstIndex + search.length)}`);
}

const slashCommandsPath = "packages/coding-agent/src/core/slash-commands.ts";
replaceOnce(
	slashCommandsPath,
	"export const BUILTIN_SLASH_COMMANDS: ReadonlyArray<BuiltinSlashCommand> = [",
	`export function isQuitSlashCommand(text: string): boolean {\n\treturn text === "/exit" || text === "/quit";\n}\n\nexport const BUILTIN_SLASH_COMMANDS: ReadonlyArray<BuiltinSlashCommand> = [`,
);
replaceOnce(
	slashCommandsPath,
	'\t{ name: "quit", description: `Quit ${APP_NAME}` },',
	'\t{ name: "exit", description: `Exit ${APP_NAME}` },\n\t{ name: "quit", description: `Quit ${APP_NAME}` },',
);

const interactiveModePath = "packages/coding-agent/src/modes/interactive/interactive-mode.ts";
replaceOnce(
	interactiveModePath,
	'import { BUILTIN_SLASH_COMMANDS } from "../../core/slash-commands.ts";',
	'import { BUILTIN_SLASH_COMMANDS, isQuitSlashCommand } from "../../core/slash-commands.ts";',
);
replaceOnce(interactiveModePath, 'if (text === "/quit") {', "if (isQuitSlashCommand(text)) {");
replaceOnce(
	interactiveModePath,
	"// Interactive quit (Ctrl+D, Ctrl+C, /quit, extension shutdown()). Stop the",
	"// Interactive quit (Ctrl+D, Ctrl+C, /exit, /quit, extension shutdown()). Stop the",
);

replaceOnce(
	"packages/coding-agent/docs/usage.md",
	"| `/quit`  | Quit pi |",
	"| `/exit`, `/quit`  | Quit pi |",
);
replaceOnce(
	"packages/coding-agent/CHANGELOG.md",
	"### Added\n\n",
	"### Added\n\n- Added `/exit` as an alias for `/quit`.\n",
);

writeFileSync(
	"packages/coding-agent/test/slash-commands.test.ts",
	`import { describe, expect, it } from "vitest";\nimport { BUILTIN_SLASH_COMMANDS, isQuitSlashCommand } from "../src/core/slash-commands.ts";\n\ndescribe("slash commands", () => {\n\tit.each(["/exit", "/quit"])("treats %s as a quit command", (command) => {\n\t\texpect(isQuitSlashCommand(command)).toBe(true);\n\t});\n\n\tit.each(["exit", "/exit now", "/quit ", "/new"])("does not treat %s as a quit command", (command) => {\n\t\texpect(isQuitSlashCommand(command)).toBe(false);\n\t});\n\n\tit("offers both exit spellings in autocomplete", () => {\n\t\tconst names = BUILTIN_SLASH_COMMANDS.map((command) => command.name);\n\t\texpect(names).toContain("exit");\n\t\texpect(names).toContain("quit");\n\t});\n});\n`,
);

rmSync("scripts/patch-exit-command.mjs");
rmSync(".github/workflows/patch-exit-command.yml");

// This no-op change exists only to trigger the branch workflow after it was installed.
