import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("clear-context plan approval", () => {
	it("terminates the old agent run before starting the fresh execution session", () => {
		const source = readFileSync(new URL("../src/extensions/plan-mode/index.ts", import.meta.url), "utf8");
		const start = source.indexOf('if (choice === "Yes, clear context and start implementing")');
		const end = source.indexOf("const feedback =", start);

		expect(start).toBeGreaterThanOrEqual(0);
		expect(end).toBeGreaterThan(start);

		const clearContextBranch = source.slice(start, end);
		expect(clearContextBranch).toContain('phase: "awaiting-clear-context"');
		expect(clearContextBranch).toContain("terminate: true");
	});
});
