#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
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
	{ name: "@earendil-works/pi-ai", workspaceDir: "packages/ai" },
	{ name: "@earendil-works/pi-agent-core", workspaceDir: "packages/agent" },
	{ name: "@earendil-works/pi-tui", workspaceDir: "packages/tui" },
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

async function replaceDist(sourcePackageDir, stagedPackageDir) {
	const sourceDist = join(repoRoot, sourcePackageDir, "dist");
	const stagedDist = join(stagedPackageDir, "dist");
	await rm(stagedDist, { recursive: true, force: true });
	await cp(sourceDist, stagedDist, { recursive: true, force: true });
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
	await replaceDist("packages/coding-agent", stagePackage);

	const stageManifestPath = join(stagePackage, "package.json");
	const stageManifest = JSON.parse(await readFile(stageManifestPath, "utf8"));
	delete stageManifest.bundledDependencies;
	delete stageManifest.bundleDependencies;
	await writeFile(stageManifestPath, `${JSON.stringify(stageManifest, null, 2)}\n`);

	// Restore the exact production graph represented by npm-shrinkwrap.json while
	// package.json still matches that lock. Declaring bundled dependencies before
	// this step triggers an npm Arborist edgesOut crash on npm 10.
	run(
		npmCommand,
		["ci", "--ignore-scripts", "--omit=dev", "--no-audit", "--no-fund"],
		{ cwd: stagePackage },
	);

	const localRuntimePackages = new Map();
	for (const runtimePackage of runtimePackages) {
		const tarball = await packWorkspace(runtimePackage.name, packDir);
		const extractedPackage = await extractTarball(
			tarball,
			join(extractedDir, runtimePackage.name.replaceAll("/", "__")),
		);
		await replaceDist(runtimePackage.workspaceDir, extractedPackage);
		localRuntimePackages.set(runtimePackage.name, extractedPackage);
	}

	// Replace registry copies with packages and dist trees from this source build.
	for (const runtimePackage of runtimePackages) {
		const extractedPackage = localRuntimePackages.get(runtimePackage.name);
		if (!extractedPackage) throw new Error(`Missing staged runtime package ${runtimePackage.name}`);
		const [scope, name] = runtimePackage.name.split("/");
		const installedPackage = join(stagePackage, "node_modules", scope, name);
		await rm(installedPackage, { recursive: true, force: true });
		await mkdir(dirname(installedPackage), { recursive: true });
		await cp(extractedPackage, installedPackage, { recursive: true, force: true });
	}

	// npm pack recursively includes the transitive graph for these top-level
	// dependencies. Writing this only after npm ci prevents npm from trying to
	// resolve a partially materialized bundled tree.
	stageManifest.bundledDependencies = [
		...new Set([
			...Object.keys(stageManifest.dependencies ?? {}),
			...Object.keys(stageManifest.optionalDependencies ?? {}),
		]),
	].sort();
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
