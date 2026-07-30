import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";

const keep = new Set([
	"packages/coding-agent/src/modes/interactive/components/claude-working.ts",
	"packages/coding-agent/src/modes/interactive/components/custom-editor.ts",
	"packages/coding-agent/src/modes/interactive/components/status-indicator.ts",
	"packages/coding-agent/src/modes/interactive/interactive-mode.ts",
	"packages/coding-agent/test/claude-status.test.ts",
]);
const self = ".github/scripts/cleanup-claude-status-branch.mjs";
const git = (...args) => execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] }).trim();

git("fetch", "origin", "main");
const base = git("merge-base", "origin/main", "HEAD");
const changed = git("diff", "--name-only", base)
	.split("\n")
	.map((path) => path.trim())
	.filter(Boolean);

for (const path of changed) {
	if (keep.has(path) || path === self) continue;
	try {
		git("checkout", "origin/main", "--", path);
	} catch {
		execFileSync("git", ["rm", "-f", "--ignore-unmatch", "--", path], { stdio: "inherit" });
	}
}

rmSync(self);
