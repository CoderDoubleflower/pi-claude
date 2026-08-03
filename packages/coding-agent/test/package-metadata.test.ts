import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

interface PackageJson {
	dependencies?: Record<string, string>;
	peerDependencies?: Record<string, string>;
	peerDependenciesMeta?: Record<string, { optional?: boolean }>;
}

const packageJsonPath = resolve(dirname(fileURLToPath(import.meta.url)), "../package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as PackageJson;
const remoteTypePackages = ["@earendil-works/pi-client", "@earendil-works/pi-protocol"] as const;

describe("published package metadata", () => {
	it.each(remoteTypePackages)("keeps %s as an optional peer dependency", (packageName) => {
		expect(packageJson.dependencies?.[packageName]).toBeUndefined();
		expect(packageJson.peerDependencies?.[packageName]).toBe("^0.83.0");
		expect(packageJson.peerDependenciesMeta?.[packageName]?.optional).toBe(true);
	});
});
