#!/usr/bin/env node
import { createHash } from "node:crypto";
import { access, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const installedRoot = resolve(process.argv[2] ?? "");
const globalNodeModulesRoot = resolve(process.argv[3] ?? "");
if (!process.argv[2] || !process.argv[3]) {
	throw new Error(
		"Usage: verify-pi-claude-release-runtime.mjs <installed-package-root> <global-node-modules-root>",
	);
}

const diagnosticPath = resolve(
	process.env.PI_RUNTIME_DIFF_PATH ?? join(repoRoot, ".artifacts", "release-runtime-diff.json"),
);
const runtimeMappings = [
	{ sourceRelative: "packages/ai/dist", packageName: "@earendil-works/pi-ai" },
	{ sourceRelative: "packages/agent/dist", packageName: "@earendil-works/pi-agent-core" },
	{ sourceRelative: "packages/tui/dist", packageName: "@earendil-works/pi-tui" },
];
let diagnosticWritten = false;

async function pathExists(path) {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}

async function writeDiagnostic(diagnostic) {
	await mkdir(dirname(diagnosticPath), { recursive: true });
	await writeFile(diagnosticPath, `${JSON.stringify(diagnostic, null, 2)}\n`);
	diagnosticWritten = true;
}

async function resolveInstalledPackageRoot(packageName) {
	const packageSegments = packageName.split("/");
	const candidates = [
		join(installedRoot, "node_modules", ...packageSegments),
		join(globalNodeModulesRoot, ...packageSegments),
	];

	for (const candidate of candidates) {
		const manifestPath = join(candidate, "package.json");
		if (!(await pathExists(manifestPath))) continue;
		const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
		if (manifest.name === packageName) {
			return candidate;
		}
	}

	await writeDiagnostic({
		kind: "package-resolution-error",
		packageName,
		installedRoot,
		globalNodeModulesRoot,
		candidates,
	});
	throw new Error(`Could not locate the installed runtime package ${packageName}`);
}

async function collectFiles(root) {
	const files = new Map();

	async function walk(directory, prefix = "") {
		const entries = await readdir(directory, { withFileTypes: true });
		entries.sort((a, b) => a.name.localeCompare(b.name));
		for (const entry of entries) {
			const absolute = join(directory, entry.name);
			const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
			if (entry.isDirectory()) {
				await walk(absolute, relative);
			} else if (entry.isFile()) {
				const content = await readFile(absolute);
				files.set(relative, {
					hash: createHash("sha256").update(content).digest("hex"),
					size: content.length,
				});
			} else {
				throw new Error(`Unsupported runtime entry: ${absolute}`);
			}
		}
	}

	await walk(root);
	return files;
}

function summarize(items) {
	return items.slice(0, 20).join(", ");
}

function treeHash(files) {
	const hash = createHash("sha256");
	for (const [path, metadata] of [...files.entries()].sort(([a], [b]) => a.localeCompare(b))) {
		hash.update(`${path}\0${metadata.size}\0${metadata.hash}\0`);
	}
	return hash.digest("hex");
}

async function compareTrees(sourceRelative, installedDist, runtimeIdentity) {
	const source = join(repoRoot, sourceRelative);
	const [sourceFiles, installedFiles] = await Promise.all([
		collectFiles(source),
		collectFiles(installedDist),
	]);

	const sourceOnly = [...sourceFiles.keys()].filter((path) => !installedFiles.has(path));
	const installedOnly = [...installedFiles.keys()].filter((path) => !sourceFiles.has(path));
	const changed = [...sourceFiles.entries()]
		.filter(([path, metadata]) => {
			const installedMetadata = installedFiles.get(path);
			return (
				installedMetadata &&
				(installedMetadata.hash !== metadata.hash || installedMetadata.size !== metadata.size)
			);
		})
		.map(([path, sourceMetadata]) => ({
			path,
			source: sourceMetadata,
			installed: installedFiles.get(path),
		}));

	if (sourceOnly.length || installedOnly.length || changed.length) {
		await writeDiagnostic({
			kind: "runtime-content-mismatch",
			runtimeIdentity,
			sourceRelative,
			installedDist,
			sourceOnly,
			installedOnly,
			changed,
		});

		const changedSummary = changed.map(
			({ path, source: sourceMetadata, installed: installedMetadata }) =>
				`${path} (source ${sourceMetadata.size}/${sourceMetadata.hash}, installed ${installedMetadata.size}/${installedMetadata.hash})`,
		);
		const details = [
			sourceOnly.length ? `source-only: ${summarize(sourceOnly)}` : "",
			installedOnly.length ? `installed-only: ${summarize(installedOnly)}` : "",
			changed.length ? `byte-mismatched: ${summarize(changedSummary)}` : "",
		]
			.filter(Boolean)
			.join("\n");
		console.error(`::error title=Release runtime mismatch::${details.replaceAll("\n", "%0A")}`);
		throw new Error(`Release runtime mismatch for ${sourceRelative}\n${details}`);
	}

	console.log(`${sourceRelative}: ${sourceFiles.size} files, ${treeHash(sourceFiles)}`);
}

async function main() {
	await compareTrees("packages/coding-agent/dist", join(installedRoot, "dist"), "@doubleflower/pi-claude");

	for (const mapping of runtimeMappings) {
		const packageRoot = await resolveInstalledPackageRoot(mapping.packageName);
		console.log(`${mapping.packageName}: resolved to ${packageRoot}`);
		await compareTrees(
			mapping.sourceRelative,
			join(packageRoot, "dist"),
			mapping.packageName,
		);
	}
}

try {
	await main();
} catch (error) {
	if (!diagnosticWritten) {
		await writeDiagnostic({
			kind: "verification-error",
			message: error instanceof Error ? error.message : String(error),
			stack: error instanceof Error ? error.stack : undefined,
			installedRoot,
			globalNodeModulesRoot,
		});
	}
	throw error;
}
