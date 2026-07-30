import { afterEach, describe, expect, it, vi } from "vitest";
import { printHelp } from "../src/cli/args.ts";
import { printCredentialPrintHelp } from "../src/cli/credential-print.ts";
import { APP_NAME } from "../src/config.ts";
import { handlePackageCommand } from "../src/package-manager-cli.ts";

describe("pi-claude command branding", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("uses pi-claude as the application name", () => {
		expect(APP_NAME).toBe("pi-claude");
	});

	it("brands top-level and auth help with pi-claude", () => {
		const log = vi.spyOn(console, "log").mockImplementation(() => {});
		printHelp();
		printCredentialPrintHelp();
		const output = log.mock.calls.map(([message]) => String(message)).join("\n");

		expect(output).toContain("pi-claude auth print-api-key");
		expect(output).toContain("pi-claude update");
		expect(output).not.toContain("  pi auth");
		expect(output).not.toContain("Update pi,");
	});

	it("brands package update help with pi-claude", async () => {
		const log = vi.spyOn(console, "log").mockImplementation(() => {});
		expect(await handlePackageCommand(["update", "--help"])).toBe(true);
		const output = log.mock.calls.map(([message]) => String(message)).join("\n");

		expect(output).toContain("Update pi-claude");
		expect(output).toContain("pi-claude update pi-claude");
		expect(output).not.toContain("Update pi only");
	});
});
