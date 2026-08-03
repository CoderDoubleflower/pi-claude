import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("built pi-claude runtime", () => {
	it(
		"builds and launches the Claude Code-style startup screen in a PTY",
		() => {
			const result = spawnSync(process.execPath, ["scripts/verify-built-startup-runtime.mjs"], {
				cwd: repoRoot,
				encoding: "utf8",
				timeout: 25_000,
				env: { ...process.env, PI_OFFLINE: "1" },
			});

			if (result.stdout) process.stdout.write(result.stdout);
			if (result.stderr) process.stderr.write(result.stderr);
			if (result.error) throw result.error;
			expect(result.status).toBe(0);
		},
		30_000,
	);
});
