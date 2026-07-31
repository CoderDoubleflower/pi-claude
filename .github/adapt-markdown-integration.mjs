import { readFileSync, writeFileSync } from "node:fs";

const scriptPath = process.argv[2];
if (!scriptPath) throw new Error("Expected generated integration script path");

let script = readFileSync(scriptPath, "utf8");
const conflictMarker = 'unresolved="$(git diff --name-only --diff-filter=U)"';
if (!script.includes(conflictMarker)) throw new Error("Conflict-check insertion point not found");

const adaptation = [
	'sed -i "s/availableWidth: 78/availableWidth: 77/g" packages/coding-agent/test/assistant-message.test.ts',
	'sed -i "s/answer (78)/answer (77)/g" packages/coding-agent/test/assistant-message.test.ts',
	'sed -i "s/answer (58)/answer (57)/g" packages/coding-agent/test/assistant-message.test.ts',
	'sed -i "s/\\[78, 58\\]/[77, 57]/g" packages/coding-agent/test/assistant-message.test.ts',
	'sed -i "s/availableWidth: 78/availableWidth: 77/g" packages/coding-agent/test/user-message.test.ts',
	"",
].join("\n");
script = script.replace(conflictMarker, `${adaptation}${conflictMarker}`);

const oldTests = [
	"  packages/coding-agent/test/extensions-runner.test.ts \\",
	"  packages/coding-agent/test/extensions-discovery.test.ts \\",
	"  packages/tui/test/markdown.test.ts",
	"npm run check:package-smoke",
].join("\n");
const newTests = [
	"  packages/coding-agent/test/extensions-runner.test.ts \\",
	"  packages/coding-agent/test/extensions-discovery.test.ts",
	"npm test --workspace=@earendil-works/pi-tui",
	"npm run check:package-smoke",
].join("\n");
if (!script.includes(oldTests)) throw new Error("Focused test command block not found");
script = script.replace(oldTests, newTests);

writeFileSync(scriptPath, script);
