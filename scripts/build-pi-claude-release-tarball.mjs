#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const outputIndex = args.indexOf("--output-dir");
const outputDir = resolve(
	outputIndex >= 0 ? args[outputIndex + 1] : join(repoRoot, ".artifacts", "pi-claude-release"),
);
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const runtimePackages = [
	"@earendil-works/pi-ai",
	"@earendil-works/pi-agent-core",
	"@earendil-works/pi-tui",
];

function run(command, commandArgs, options = {}) {
	const result = spawnSync(command, commandArgs, {
		cwd: options.cwd ?? repoRoot,
		encoding: "utf8",
		stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
		env: process.env,
	});
	if (result.status !== 0) {
		throw new Error(
			`${command} ${commandArgs.join(" ")} failed with status ${result.status}\n${result.stderr ?? ""}`,
		);
	}
	return result.stdout ?? "";
}

async function packWorkspace(workspace, destination) {
	const stdout = run(
		npmCommand,
		[
			"pack",
			"--json",
			"--ignore-scripts",
			`--workspace=${workspace}`,
			`--pack-destination=${destination}`,
		],
		{ capture: true },
	);
	const parsed = JSON.parse(stdout);
	if (!Array.isArray(parsed) || parsed.length !== 1 || typeof parsed[0]?.filename !== "string") {
		throw new Error(`Unexpected npm pack output for ${workspace}: ${stdout}`);
	}
	return join(destination, parsed[0].filename);
}

async function extractTarball(tarball, destination) {
	await mkdir(destination, { recursive: true });
	run("tar", ["-xzf", tarball, "-C", destination]);
	return join(destination, "package");
}

const tempRoot = await mkdtemp(join(tmpdir(), "pi-claude-release."));
try {
	const packDir = join(tempRoot, "packs");
	const extractedDir = join(tempRoot, "extracted");
	await mkdir(packDir, { recursive: true });
	await mkdir(extractedDir, { recursive: true });
	await mkdir(outputDir, { recursive: true });

	const cliTarball = await packWorkspace("@doubleflower/pi-claude", packDir);
	const stagePackage = await extractTarball(cliTarball, join(extractedDir, "pi-claude"));
	const stageManifestPath = join(stagePackage, "package.json");
	const stageManifest = JSON.parse(await readFile(stageManifestPath, "utf8"));
	stageManifest.bundledDependencies = runtimePackages;

	for (const packageName of runtimePackages) {
		const tarball = await packWorkspace(packageName, packDir);
		const extractedPackage = await extractTarball(
			tarball,
			join(extractedDir, packageName.replaceAll("/", "__")),
		);
		const localManifest = JSON.parse(await readFile(join(extractedPackage, "package.json"), "utf8"));
		stageManifest.dependencies ??= {};
		stageManifest.dependencies[packageName] = localManifest.version;

		const [scope, name] = packageName.split("/");
		const installParent = join(stagePackage, "node_modules", scope);
		await mkdir(installParent, { recursive: true });
		run("cp", ["-a", extractedPackage, join(installParent, name)]);
	}

	await writeFile(stageManifestPath, `${JSON.stringify(stageManifest, null, 2)}\n`);
	const finalOutput = run(
		npmCommand,
		["pack", "--json", "--ignore-scripts", stagePackage, `--pack-destination=${outputDir}`],
		{ capture: true },
	);
	const finalParsed = JSON.parse(finalOutput);
	if (!Array.isArray(finalParsed) || finalParsed.length !== 1 || typeof finalParsed[0]?.filename !== "string") {
		throw new Error(`Unexpected final npm pack output: ${finalOutput}`);
	}
	process.stdout.write(`${join(outputDir, finalParsed[0].filename)}\n`);
} finally {
	await rm(tempRoot, { recursive: true, force: true });
}
