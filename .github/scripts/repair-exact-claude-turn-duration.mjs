import { readFileSync, rmSync, writeFileSync } from "node:fs";

const path = ".github/scripts/apply-exact-claude-turn-duration.mjs";
const sourceLines = readFileSync(path, "utf8").split("\n");
const index = sourceLines.findIndex((line) =>
	line.includes("const finalAssistantMessage = event.messages.findLast"),
);
if (index === -1) {
	throw new Error("Could not find the findLast patch block");
}
sourceLines.splice(
	index,
	3,
	"\t\t'\\t\\t\\t\\tlet finalAssistantMessage: AssistantMessage | undefined;',",
	"\t\t'\\t\\t\\t\\tfor (let index = event.messages.length - 1; index >= 0; index--) {',",
	"\t\t'\\t\\t\\t\\t\\tconst message = event.messages[index];',",
	"\t\t'\\t\\t\\t\\t\\tif (message?.role === \"assistant\") {',",
	"\t\t'\\t\\t\\t\\t\\t\\tfinalAssistantMessage = message;',",
	"\t\t'\\t\\t\\t\\t\\t\\tbreak;',",
	"\t\t'\\t\\t\\t\\t\\t}',",
	"\t\t'\\t\\t\\t\\t}',",
	"\t\t'\\t\\t\\t\\tconst wasAborted = finalAssistantMessage?.stopReason === \"aborted\";',",
);
writeFileSync(path, sourceLines.join("\n"));
rmSync(".github/scripts/repair-exact-claude-turn-duration.mjs");
