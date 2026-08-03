import { describe, expect, it } from "vitest";
import { checkPlanReadOnlyCommand } from "../src/extensions/plan-mode/shell-policy.ts";

describe("plan-mode shell security guards", () => {
	it.each([
		"gh auth status",
		"gh auth status --hostname github.com",
		"docker compose config",
		"docker compose config --services",
		"docker compose config --format json",
	])("allows safe inspection command: %s", (command) => {
		expect(checkPlanReadOnlyCommand(command)).toEqual({ safe: true });
	});

	it.each([
		"gh auth status --show-token",
		"gh auth status --show-token=true",
		"gh auth status -t",
		"gh auth status -t=true",
		"gh auth status --show-token | head",
	])("blocks GitHub token disclosure: %s", (command) => {
		expect(checkPlanReadOnlyCommand(command).safe).toBe(false);
	});

	it.each([
		"docker compose config -o output.yml",
		"docker compose config -ooutput.yml",
		"docker compose config --output output.yml",
		"docker compose config --output=output.yml",
		"docker compose config --lock-image-digests",
		"docker compose config -o output.yml && git status --short",
	])("blocks docker compose config file writes: %s", (command) => {
		expect(checkPlanReadOnlyCommand(command).safe).toBe(false);
	});
});
