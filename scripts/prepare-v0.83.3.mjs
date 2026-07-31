import { readFileSync, writeFileSync } from "node:fs";

const oldVersion = "0.83.2";
const newVersion = "0.83.3";
const packageName = "@doubleflower/pi-claude";

function readJson(path) {
	return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, value) {
	writeFileSync(path, `${JSON.stringify(value, null, "\t")}\n`);
}

function expectEqual(actual, expected, label) {
	if (actual !== expected) {
		throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
	}
}

{
	const path = "packages/coding-agent/package.json";
	const json = readJson(path);
	expectEqual(json.version, oldVersion, `${path} version`);
	json.version = newVersion;
	writeJson(path, json);
}

{
	const path = "packages/coding-agent/npm-shrinkwrap.json";
	const json = readJson(path);
	expectEqual(json.version, oldVersion, `${path} version`);
	expectEqual(json.packages[""].version, oldVersion, `${path} root package version`);
	json.version = newVersion;
	json.packages[""].version = newVersion;
	writeJson(path, json);
}

{
	const path = "packages/coding-agent/install-lock/package.json";
	const json = readJson(path);
	expectEqual(json.version, oldVersion, `${path} version`);
	expectEqual(json.dependencies[packageName], oldVersion, `${path} dependency`);
	json.version = newVersion;
	json.dependencies[packageName] = newVersion;
	writeJson(path, json);
}

{
	const path = "packages/coding-agent/install-lock/package-lock.json";
	const json = readJson(path);
	const entry = json.packages[`node_modules/${packageName}`];
	expectEqual(json.version, oldVersion, `${path} version`);
	expectEqual(json.packages[""].version, oldVersion, `${path} root package version`);
	expectEqual(json.packages[""].dependencies[packageName], oldVersion, `${path} root dependency`);
	expectEqual(entry.version, oldVersion, `${path} installed version`);
	json.version = newVersion;
	json.packages[""].version = newVersion;
	json.packages[""].dependencies[packageName] = newVersion;
	entry.version = newVersion;
	entry.resolved = `https://registry.npmjs.org/${packageName}/-/pi-claude-${newVersion}.tgz`;
	writeJson(path, json);
}

{
	const path = "packages/evals/package.json";
	const json = readJson(path);
	expectEqual(json.devDependencies[packageName], `^${oldVersion}`, `${path} dependency`);
	json.devDependencies[packageName] = `^${newVersion}`;
	writeJson(path, json);
}

{
	const path = "packages/server/package.json";
	const json = readJson(path);
	expectEqual(json.dependencies[packageName], `^${oldVersion}`, `${path} dependency`);
	json.dependencies[packageName] = `^${newVersion}`;
	writeJson(path, json);
}

{
	const path = "package-lock.json";
	const json = readJson(path);
	const codingAgent = json.packages["packages/coding-agent"];
	const evals = json.packages["packages/evals"];
	const server = json.packages["packages/server"];
	expectEqual(codingAgent.version, oldVersion, `${path} coding-agent version`);
	expectEqual(evals.devDependencies[packageName], `^${oldVersion}`, `${path} eval dependency`);
	expectEqual(server.dependencies[packageName], `^${oldVersion}`, `${path} server dependency`);
	codingAgent.version = newVersion;
	evals.devDependencies[packageName] = `^${newVersion}`;
	server.dependencies[packageName] = `^${newVersion}`;
	writeJson(path, json);
}

{
	const path = "packages/coding-agent/CHANGELOG.md";
	const bullet =
		"- Fixed published npm installs failing at startup when the bundled 0.83.0 runtime packages predate newer workspace exports.";
	const nextRelease = "## [0.83.0] - 2026-07-29";
	let changelog = readFileSync(path, "utf8");
	if (!changelog.includes(bullet)) throw new Error("Release changelog bullet is missing");
	if (changelog.includes("## [0.83.3]")) throw new Error("0.83.3 changelog section already exists");
	changelog = changelog.replace(`${bullet}\n`, "");
	const section = `## [0.83.3] - 2026-07-31\n\n### Fixed\n\n${bullet}\n\n`;
	if (!changelog.includes(nextRelease)) throw new Error("Unable to locate changelog insertion point");
	changelog = changelog.replace(nextRelease, `${section}${nextRelease}`);
	writeFileSync(path, changelog);
}
