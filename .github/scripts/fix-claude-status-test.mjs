import { readFileSync, rmSync, writeFileSync } from "node:fs";

const path = "packages/coding-agent/test/claude-status.test.ts";
const source = readFileSync(path, "utf8");
const search = `function createTui(): TUI {\n\treturn { requestRender() {} } as unknown as TUI;\n}`;
const replacement = `function createTui(): TUI {\n\treturn {\n\t\trequestRender() {},\n\t\tterminal: { rows: 40, columns: 80 },\n\t} as unknown as TUI;\n}`;
const occurrences = source.split(search).length - 1;
if (occurrences !== 1) {
	throw new Error(`${path}: expected one createTui fixture, found ${occurrences}`);
}
writeFileSync(path, source.replace(search, replacement));
rmSync(".github/scripts/fix-claude-status-test.mjs");
