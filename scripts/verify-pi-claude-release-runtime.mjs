#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
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

async function hashTree(root) {
	const hash = createHash("sha256");

	async function walk(directory, prefix = "") {
		const entries = await readdir(directory, { withFileTypes: true });
		entries.sort((a, b) => a.name.localeCompare(b.name));
		for (const entry of entries) {
			const absolute = join(directory, entry.name);
			const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
			if (entry.isDirectory()) {
				await walk(absolute, relative);
			} else if (entry.isFile()) {
				const info = await stat(absolute);
				hash.update(`F\0${relative}\0${info.mode & 0o111 ? "x" : "-"}\0`);
				hash.update(await readFile(absolute));
				hash.update("\0");
			}
		}
	}

	await walk(root);
	return hash.digest("hex");
}

for (const [sourceRelative, installedRelative] of mappings) {
	const source = join(repoRoot, sourceRelative);
	const installed = join(installedRoot, installedRelative);
	const [sourceHash, installedHash] = await Promise.all([hashTree(source), hashTree(installed)]);
	if (sourceHash !== installedHash) {
		throw new Error(
			`Release runtime mismatch for ${sourceRelative}: source=${sourceHash} installed=${installedHash}`,
		);
	}
	console.log(`${sourceRelative}: ${sourceHash}`);
}
