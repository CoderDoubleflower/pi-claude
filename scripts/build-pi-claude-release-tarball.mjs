#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseNpmPackJson } from "./npm-pack-json.mjs";

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
	const result = parseNpmPackJson(stdout, workspace);
	return join(destination, result.filename);
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

async function injectShrinkwrap(finalTarball, shrinkwrapPath, destination) {
	const extractedPackage = await extractTarball(finalTarball, destination);
	await cp(shrinkwrapPath, join(extractedPackage, "npm-shrinkwrap.json"), { force: true });
	await rm(finalTarball, { force: true });
	run("tar", ["-czf", finalTarball, "-C", destination, "package"]);
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

function clearDependencyEdges(manifest) {
	manifest.dependencies = {};
	delete manifest.optionalDependencies;
	delete manifest.peerDependencies;
	delete manifest.peerDependenciesMeta;
	delete manifest.bundledDependencies;
	delete manifest.bundleDependencies;
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
	const sourceShrinkwrapPath = join(repoRoot, "packages/coding-agent/npm-shrinkwrap.json");

	// npm versions differ on whether a workspace-level npm-shrinkwrap.json is
	// included by `npm pack --workspace`. The release workflow generates and
	// validates this source file immediately before packing, so copy that exact
	// lock into the staged package instead of relying on npm's pack selection.
	await cp(sourceShrinkwrapPath, stageShrinkwrapPath, { force: true });

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

		const localManifestPath = join(extractedPackage, "package.json");
		const localManifest = JSON.parse(await readFile(localManifestPath, "utf8"));
		stageManifest.dependencies[runtimePackage.name] = localManifest.version;
		mergeDependencyMap(stageManifest.dependencies, localManifest.dependencies, runtimePackage.name);
		mergeDependencyMap(
			stageManifest.optionalDependencies,
			localManifest.optionalDependencies,
			runtimePackage.name,
		);

		// npm recursively treats dependencies declared by a bundled package as part
		// of that bundle. Their real declarations are hoisted to pi-claude above;
		// clear them only in this staged copy so npm installs them normally instead
		// of considering an absent nested dependency tree already bundled.
		clearDependencyEdges(localManifest);
		await writeFile(localManifestPath, `${JSON.stringify(localManifest, null, 2)}\n`);

		const lockEntry = stageShrinkwrap.packages?.[lockPathForPackage(runtimePackage.name)];
		if (!lockEntry) {
			throw new Error(`npm-shrinkwrap.json is missing ${runtimePackage.name}`);
		}
		clearDependencyEdges(lockEntry);

		const [scope, name] = runtimePackage.name.split("/");
		const installParent = join(stagePackage, "node_modules", scope);
		await mkdir(installParent, { recursive: true });
		await cp(extractedPackage, join(installParent, name), { recursive: true, force: true });
	}

	// Bundle only the source-built workspace packages. Their third-party runtime
	// dependencies remain normal top-level dependencies and therefore retain npm's
	// target-platform installation behavior.
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
	const finalResult = parseNpmPackJson(finalOutput);
	const finalTarball = join(outputDir, finalResult.filename);

	// npm latest filters npm-shrinkwrap.json out of a directory passed to
	// `npm pack`, even when it exists in the staged package. Preserve npm's
	// selected file set and bundled dependency layout, then inject the exact
	// validated lock into the already-built archive and repack the same tree.
	await injectShrinkwrap(finalTarball, stageShrinkwrapPath, join(extractedDir, "final-release"));

	const archiveEntries = run("tar", ["-tzf", finalTarball], { capture: true })
		.split(/\r?\n/u)
		.filter(Boolean);
	if (!archiveEntries.includes("package/npm-shrinkwrap.json")) {
		throw new Error(`Final release tarball is missing package/npm-shrinkwrap.json: ${finalTarball}`);
	}
	process.stdout.write(`${finalTarball}\n`);
} finally {
	await rm(tempRoot, { recursive: true, force: true });
}
