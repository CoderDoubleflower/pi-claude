#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const installedRoot = resolve(process.argv[2] ?? "");
if (!process.argv[2]) {
	throw new Error("Usage: verify-pi-claude-release-runtime.mjs <installed-package-root>");
}

const mappings = [
	["packages/coding-agent/dist", "dist"],
	["packages/ai/dist", "node_modules/@earendil-works/pi-ai/dist"],
	["packages/agent/dist", "node_modules/@earendil-works/pi-agent-core/dist"],
	["packages/tui/dist", "node_modules/@earendil-works/pi-tui/dist"],
];

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

for (const [sourceRelative, installedRelative] of mappings) {
	const source = join(repoRoot, sourceRelative);
	const installed = join(installedRoot, installedRelative);
	const [sourceFiles, installedFiles] = await Promise.all([collectFiles(source), collectFiles(installed)]);

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
		.map(([path, sourceMetadata]) => {
			const installedMetadata = installedFiles.get(path);
			return `${path} (source ${sourceMetadata.size}/${sourceMetadata.hash}, installed ${installedMetadata.size}/${installedMetadata.hash})`;
		});

	if (sourceOnly.length || installedOnly.length || changed.length) {
		const details = [
			sourceOnly.length ? `source-only: ${summarize(sourceOnly)}` : "",
			installedOnly.length ? `installed-only: ${summarize(installedOnly)}` : "",
			changed.length ? `byte-mismatched: ${summarize(changed)}` : "",
		]
			.filter(Boolean)
			.join("\n");
		throw new Error(`Release runtime mismatch for ${sourceRelative}\n${details}`);
	}

	console.log(`${sourceRelative}: ${sourceFiles.size} files, ${treeHash(sourceFiles)}`);
}
