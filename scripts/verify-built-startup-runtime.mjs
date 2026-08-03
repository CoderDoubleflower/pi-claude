import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cliPath = join(repoRoot, "packages", "coding-agent", "dist", "cli.js");
const packageJson = JSON.parse(
	readFileSync(join(repoRoot, "packages", "coding-agent", "package.json"), "utf8"),
);
const expectedTitle = `pi-claude v${packageJson.version}`;
const expectedClawd = "▐▛███▜▌";
const forbiddenLegacyCopy = "Pi can explain its own features";
const fatalPatterns = ["uncaughtException", "TypeError:", "SyntaxError:", "ReferenceError:"];

function shellQuote(value) {
	return `'${String(value).replaceAll("'", `'\\''`)}'`;
}

function stripTerminalSequences(value) {
	return value
		.replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/gs, "")
		.replace(/\x1bP.*?\x1b\\/gs, "")
		.replace(/\x1b_[^\x07]*\x07/gs, "")
		.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "")
		.replace(/\x1b[@-_]/g, "")
		.replaceAll("\r", "\n")
		.replaceAll("\x00", "");
}

const tempRoot = mkdtempSync(join(tmpdir(), "pi-claude-runtime-"));
const homeDir = join(tempRoot, "home");
const projectDir = join(tempRoot, "project");
const agentDir = join(homeDir, ".pi", "agent");
const capturePath = join(tempRoot, "startup.typescript");

try {
	mkdirSync(agentDir, { recursive: true });
	mkdirSync(projectDir, { recursive: true });
	writeFileSync(
		join(agentDir, "settings.json"),
		JSON.stringify({ quietStartup: false, lastChangelogVersion: packageJson.version }, null, 2),
		"utf8",
	);

	const command = [
		"stty cols 120 rows 40",
		`cd ${shellQuote(projectDir)}`,
		[
			"exec env",
			"TERM=xterm-256color",
			"COLORTERM=truecolor",
			"PI_OFFLINE=1",
			`HOME=${shellQuote(homeDir)}`,
			"timeout --signal=TERM --kill-after=2s 7s",
			shellQuote(cliPath),
		].join(" "),
	].join(" && ");

	const result = spawnSync("script", ["-qefc", command, capturePath], {
		cwd: projectDir,
		encoding: "utf8",
		timeout: 20_000,
		env: { ...process.env, PI_OFFLINE: "1" },
	});

	if (result.error) {
		throw result.error;
	}
	if (![0, 124, 143].includes(result.status ?? -1)) {
		throw new Error(
			`PTY launch exited unexpectedly with status ${result.status}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
		);
	}

	const raw = readFileSync(capturePath).toString("utf8");
	const clean = stripTerminalSequences(raw);
	const titleIndex = clean.indexOf(expectedTitle);
	const excerptStart = Math.max(0, titleIndex - 300);
	const excerptEnd = titleIndex < 0 ? Math.min(clean.length, 2500) : Math.min(clean.length, titleIndex + 1800);
	const excerpt = clean.slice(excerptStart, excerptEnd).replace(/\n{3,}/g, "\n\n");

	console.log("----- built pi-claude startup capture -----");
	console.log(excerpt);
	console.log("----- end startup capture -----");
	console.log(`PTY exit status: ${result.status}`);

	for (const pattern of fatalPatterns) {
		if (clean.includes(pattern)) {
			throw new Error(`Runtime failure marker found: ${pattern}`);
		}
	}
	if (!clean.includes(expectedTitle)) {
		throw new Error(`Startup title not found: ${expectedTitle}`);
	}
	if (!clean.includes(expectedClawd)) {
		throw new Error("Claude Code-style Clawd startup mark was not rendered");
	}
	if (clean.includes(forbiddenLegacyCopy)) {
		throw new Error("Legacy verbose startup copy was still rendered");
	}

	console.log("Built CLI startup smoke check passed.");
} finally {
	rmSync(tempRoot, { recursive: true, force: true });
}
