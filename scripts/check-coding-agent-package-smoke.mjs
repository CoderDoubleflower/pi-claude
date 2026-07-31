import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

function run(command, args, cwd) {
	return new Promise((resolvePromise, reject) => {
		const child = spawn(command, args, { cwd, stdio: "inherit", env: process.env });
		child.on("error", reject);
		child.on("exit", (code, signal) => {
			if (code === 0) {
				resolvePromise();
				return;
			}
			reject(
				new Error(
					`${command} ${args.join(" ")} failed with ${signal ? `signal ${signal}` : `exit code ${code}`}`,
				),
			);
		});
	});
}

const temporaryRoot = await mkdtemp(join(tmpdir(), "pi-claude-package-smoke-"));
const packDirectory = join(temporaryRoot, "pack");
const installDirectory = join(temporaryRoot, "install");

try {
	await mkdir(packDirectory, { recursive: true });
	await mkdir(installDirectory, { recursive: true });
	await run(
		npmCommand,
		["pack", "--workspace=@doubleflower/pi-claude", "--pack-destination", packDirectory, "--ignore-scripts"],
		repoRoot,
	);

	const tarballs = (await readdir(packDirectory)).filter((entry) => entry.endsWith(".tgz"));
	if (tarballs.length !== 1) {
		throw new Error(`Expected one coding-agent tarball, found ${tarballs.length}`);
	}

	await writeFile(join(installDirectory, "package.json"), '{"private":true,"type":"module"}\n');
	await run(
		npmCommand,
		["install", "--ignore-scripts", "--no-audit", "--no-fund", join(packDirectory, tarballs[0])],
		installDirectory,
	);

	const binary = join(
		installDirectory,
		"node_modules",
		".bin",
		process.platform === "win32" ? "pi-claude.cmd" : "pi-claude",
	);
	await run(binary, ["--version"], installDirectory);
} finally {
	await rm(temporaryRoot, { recursive: true, force: true });
}
