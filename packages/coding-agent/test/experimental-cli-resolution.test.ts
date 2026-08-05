import { describe, expect, test, vi } from "vitest";
import { experimentalCli } from "../src/cli/experimental/cli.ts";
import { resolveExperimentalCli } from "../src/cli/experimental/resolve.ts";

const UNSUPPORTED_SERVER_OPTIONS = "The experimental server command does not support existing CLI options yet";
const UNSUPPORTED_CLIENT_OPTIONS = "The experimental client command does not support existing CLI options yet";

describe("experimental CLI command composition", () => {
	test("composes pi command options with the existing parser", () => {
		expect(experimentalCli.parse(["--model", "claude-sonnet", "prompt"])).toEqual({
			ok: true,
			command: expect.objectContaining({
				command: "pi",
				options: expect.objectContaining({ model: "claude-sonnet", initialMessage: "prompt" }),
			}),
		});
	});

	test("keeps Pi --help handling in existing CLI options", () => {
		expect(experimentalCli.parse(["--help"])).toEqual({
			ok: true,
			command: expect.objectContaining({ command: "pi", options: expect.objectContaining({ help: true }) }),
		});
	});

	test("keeps Pi --version handling in existing CLI options", () => {
		expect(experimentalCli.parse(["--version"])).toEqual({
			ok: true,
			command: expect.objectContaining({ command: "pi", options: expect.objectContaining({ version: true }) }),
		});
	});

	test("rejects deferred server --help handling", () => {
		expect(experimentalCli.parse(["server", "--help"])).toEqual({
			ok: false,
			errors: [UNSUPPORTED_SERVER_OPTIONS],
		});
	});

	test("rejects deferred server --version handling", () => {
		expect(experimentalCli.parse(["server", "--version"])).toEqual({
			ok: false,
			errors: [UNSUPPORTED_SERVER_OPTIONS],
		});
	});

	test("rejects deferred client --help handling", () => {
		expect(experimentalCli.parse(["client", "--help"])).toEqual({
			ok: false,
			errors: [UNSUPPORTED_CLIENT_OPTIONS],
		});
	});

	test("rejects deferred client --version handling", () => {
		expect(experimentalCli.parse(["client", "--version"])).toEqual({
			ok: false,
			errors: [UNSUPPORTED_CLIENT_OPTIONS],
		});
	});

	test("rejects existing options that the server command does not support yet", () => {
		expect(experimentalCli.parse(["server", "--model", "claude-sonnet", "prompt"])).toEqual({
			ok: false,
			errors: [UNSUPPORTED_SERVER_OPTIONS],
		});
	});

	test("rejects existing options that the client command does not support yet", () => {
		expect(experimentalCli.parse(["client", "--ui-mode", "fullscreen", "@prompt.md"])).toEqual({
			ok: false,
			errors: [UNSUPPORTED_CLIENT_OPTIONS],
		});
	});

	test("reports existing parser errors before capability errors", () => {
		expect(experimentalCli.parse(["client", "--ui-mode", "wrong", "--model", "claude-sonnet"])).toEqual({
			ok: false,
			errors: ["--ui-mode is unavailable; pi-claude always uses fullscreen", UNSUPPORTED_CLIENT_OPTIONS],
		});
	});

	test("parses an empty server command", () => {
		expect(experimentalCli.parse(["server"])).toEqual({
			ok: true,
			command: { command: "server" },
		});
	});

	test("executes the parsed pi command", async () => {
		const runPi = vi.fn();
		await expect(resolveExperimentalCli(["prompt"], { runPi, runServer: vi.fn(), runClient: vi.fn() })).resolves.toEqual({
			ok: true,
			command: expect.objectContaining({ command: "pi" }),
		});
		expect(runPi).toHaveBeenCalledOnce();
	});

	test("executes the parsed server command", async () => {
		const runServer = vi.fn();
		await expect(resolveExperimentalCli(["server"], { runPi: vi.fn(), runServer, runClient: vi.fn() })).resolves.toEqual({
			ok: true,
			command: { command: "server" },
		});
		expect(runServer).toHaveBeenCalledOnce();
	});

	test("executes the parsed client command", async () => {
		const runClient = vi.fn();
		await expect(resolveExperimentalCli(["client"], { runPi: vi.fn(), runServer: vi.fn(), runClient })).resolves.toEqual({
			ok: true,
			command: { command: "client" },
		});
		expect(runClient).toHaveBeenCalledOnce();
	});
});
