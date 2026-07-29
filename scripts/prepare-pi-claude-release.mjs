#!/usr/bin/env node

import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { findPackageDirectories } from "./package-workspaces.mjs";

const PACKAGE_NAME = "@doubleflower/pi-claude";
const PACKAGE_PATH = "packages/coding-agent/package.json";
const target = process.argv[2] ?? "patch";
const bumpTypes = new Set(["major", "minor", "patch"]);
const semverPattern = /^(\d+)\.(\d+)\.(\d+)$/;

function readJson(path) {
	return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, data) {
	writeFileSync(path, `${JSON.stringify(data, null, "\t")}\n`);
}

function nextVersion(currentVersion, requestedTarget) {
	if (semverPattern.test(requestedTarget)) {
		return requestedTarget;
	}
	if (!bumpTypes.has(requestedTarget)) {
		throw new Error(`Expected major, minor, patch, or x.y.z; received: ${requestedTarget}`);
	}

	const match = semverPattern.exec(currentVersion);
	if (!match) {
		throw new Error(`Current package version must be plain semver x.y.z; received: ${currentVersion}`);
	}

	let major = Number(match[1]);
	let minor = Number(match[2]);
	let patch = Number(match[3]);

	if (requestedTarget === "major") {
		major += 1;
		minor = 0;
		patch = 0;
	} else if (requestedTarget === "minor") {
		minor += 1;
		patch = 0;
	} else {
		patch += 1;
	}

	return `${major}.${minor}.${patch}`;
}

const codingAgentPackage = readJson(PACKAGE_PATH);
if (codingAgentPackage.name !== PACKAGE_NAME) {
	throw new Error(`${PACKAGE_PATH} has package name ${codingAgentPackage.name}; expected ${PACKAGE_NAME}`);
}

const version = nextVersion(codingAgentPackage.version, target);
if (version === codingAgentPackage.version) {
	throw new Error(`Release version ${version} is already the current version.`);
}

codingAgentPackage.version = version;
writeJson(PACKAGE_PATH, codingAgentPackage);

for (const directory of findPackageDirectories()) {
	const packagePath = join(directory, "package.json");
	if (packagePath === PACKAGE_PATH) continue;

	const packageJson = readJson(packagePath);
	let changed = false;
	for (const dependencyType of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) {
		const dependencies = packageJson[dependencyType];
		if (!dependencies || dependencies[PACKAGE_NAME] === undefined) continue;
		dependencies[PACKAGE_NAME] = `^${version}`;
		changed = true;
	}

	if (changed) {
		writeJson(packagePath, packageJson);
	}
}

if (process.env.GITHUB_OUTPUT) {
	appendFileSync(process.env.GITHUB_OUTPUT, `version=${version}\n`);
}

console.log(version);
