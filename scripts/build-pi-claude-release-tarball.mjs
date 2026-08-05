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
const runtimePackageNames = new Set(runtimePackages.map(({ name }) => name));

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

function mergeDependencyMap(target, incoming, owner) {
	if (!incoming) return;
	for (const [name, spec] of Object.entries(incoming)) {
		if (runtimePackageNames.has(name)) continue;
		const existing = target[name];
		if (existing !== undefined && existing !== spec) {
			throw new Error(
				`Dependency version conflict for ${name}: pi-claude uses ${existing}, ${owner} uses ${spec}`,
			);
		}
		target[name] = spec;
	}
}

function lockPathForPackage(packageName) {
	return `node_modules/${packageName}`;
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
	const stageShrinkwrapPath = join(stagePackage, "npm-shrinkwrap.json");
	const stageManifest = JSON.parse(await readFile(stageManifestPath, "utf8"));
	const stageShrinkwrap = JSON.parse(await readFile(stageShrinkwrapPath, "utf8"));
	stageManifest.dependencies ??= {};
	stageManifest.optionalDependencies ??= {};
	delete stageManifest.bundledDependencies;
	delete stageManifest.bundleDependencies;

	for (const runtimePackage of runtimePackages) {
		const tarball = await packWorkspace(runtimePackage.name, packDir);
		const extractedPackage = await extractTarball(
			tarball,
			join(extractedDir, runtimePackage.name.replaceAll("/", "__")),
		);
		await replaceDist(runtimePackage.workspaceDir, extractedPackage);

		const localManifest = JSON.parse(await readFile(join(extractedPackage, "package.json"), "utf8"));
		stageManifest.dependencies[runtimePackage.name] = localManifest.version;
		mergeDependencyMap(stageManifest.dependencies, localManifest.dependencies, runtimePackage.name);
		mergeDependencyMap(
			stageManifest.optionalDependencies,
			localManifest.optionalDependencies,
			runtimePackage.name,
		);

		const [scope, name] = runtimePackage.name.split("/");
		const installParent = join(stagePackage, "node_modules", scope);
		await mkdir(installParent, { recursive: true });
		await cp(extractedPackage, join(installParent, name), { recursive: true, force: true });
	}

	// Bundled workspace packages are treated by npm as complete dependency trees.
	// Hoist their direct third-party runtime dependencies to pi-claude so npm
	// installs those dependencies normally for the target platform.
	stageManifest.bundledDependencies = [...runtimePackageNames].sort();

	const lockRoot = stageShrinkwrap.packages?.[""];
	if (!lockRoot) throw new Error("npm-shrinkwrap.json is missing its root package entry");
	lockRoot.dependencies = { ...stageManifest.dependencies };
	lockRoot.optionalDependencies = { ...stageManifest.optionalDependencies };

	for (const dependencyName of [
		...Object.keys(stageManifest.dependencies),
		...Object.keys(stageManifest.optionalDependencies),
	]) {
		if (runtimePackageNames.has(dependencyName)) continue;
		if (!stageShrinkwrap.packages[lockPathForPackage(dependencyName)]) {
			throw new Error(`npm-shrinkwrap.json is missing ${dependencyName}`);
		}
	}

	await writeFile(stageManifestPath, `${JSON.stringify(stageManifest, null, 2)}\n`);
	await writeFile(stageShrinkwrapPath, `${JSON.stringify(stageShrinkwrap, null, 2)}\n`);

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
