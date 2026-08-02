import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, join, normalize, resolve, sep } from "node:path";
import { getAgentDir } from "../../config.ts";

const ADJECTIVES = [
	"calm",
	"bright",
	"gentle",
	"steady",
	"quiet",
	"clear",
	"swift",
	"patient",
	"focused",
	"careful",
] as const;
const VERBS = [
	"rising",
	"walking",
	"mapping",
	"building",
	"guiding",
	"tracing",
	"shaping",
	"turning",
	"seeking",
	"weaving",
] as const;
const NOUNS = [
	"cedar",
	"harbor",
	"river",
	"meadow",
	"summit",
	"lantern",
	"willow",
	"garden",
	"bridge",
	"compass",
] as const;

export interface PlanIdentity {
	planSlug: string;
	planPath: string;
}

function hashString(value: string): number {
	let hash = 2166136261;
	for (let index = 0; index < value.length; index++) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}
	return hash >>> 0;
}

function getPlansDirectoryPath(agentDir = getAgentDir()): string {
	return join(dirname(agentDir), "plans");
}

export function getPlansDirectory(agentDir = getAgentDir()): string {
	const directory = getPlansDirectoryPath(agentDir);
	mkdirSync(directory, { recursive: true });
	return directory;
}

export function createPlanIdentity(
	sessionId: string,
	options: { agentDir?: string; pathExists?: (path: string) => boolean } = {},
): PlanIdentity {
	const plansDirectory = getPlansDirectory(options.agentDir);
	const pathExists = options.pathExists ?? existsSync;
	const hash = hashString(sessionId);
	const adjective = ADJECTIVES[hash % ADJECTIVES.length];
	const verb = VERBS[Math.floor(hash / ADJECTIVES.length) % VERBS.length];
	const noun = NOUNS[Math.floor(hash / (ADJECTIVES.length * VERBS.length)) % NOUNS.length];
	const baseSlug = `${adjective}-${verb}-${noun}`;

	for (let suffix = 0; suffix < 100; suffix++) {
		const planSlug = suffix === 0 ? baseSlug : `${baseSlug}-${suffix + 1}`;
		const planPath = join(plansDirectory, `${planSlug}.md`);
		if (!pathExists(planPath)) return { planSlug, planPath };
	}

	const fallback = `${baseSlug}-${sessionId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8)}`;
	return { planSlug: fallback, planPath: join(plansDirectory, `${fallback}.md`) };
}

export function readPlanFile(planPath: string | undefined): string | null {
	if (!planPath) return null;
	try {
		return readFileSync(planPath, "utf-8");
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
		throw error;
	}
}

function cleanupTemporaryFile(path: string): void {
	try {
		if (existsSync(path)) unlinkSync(path);
	} catch {
		// Best-effort cleanup.
	}
}

function replaceFile(temporaryPath: string, destinationPath: string): void {
	try {
		renameSync(temporaryPath, destinationPath);
		return;
	} catch (error) {
		const code = (error as NodeJS.ErrnoException).code;
		const windowsReplaceFailure =
			process.platform === "win32" &&
			existsSync(destinationPath) &&
			(code === "EACCES" || code === "EEXIST" || code === "ENOTEMPTY" || code === "EPERM");
		if (!windowsReplaceFailure) throw error;
	}

	const backupPath = `${temporaryPath}.previous`;
	renameSync(destinationPath, backupPath);
	try {
		renameSync(temporaryPath, destinationPath);
		cleanupTemporaryFile(backupPath);
	} catch (error) {
		if (!existsSync(destinationPath) && existsSync(backupPath)) {
			renameSync(backupPath, destinationPath);
		}
		throw error;
	} finally {
		cleanupTemporaryFile(backupPath);
	}
}

export function writePlanFile(planPath: string, content: string): void {
	mkdirSync(dirname(planPath), { recursive: true });
	const temporaryPath = join(dirname(planPath), `.${basename(planPath)}.${process.pid}.${randomUUID()}.tmp`);
	try {
		writeFileSync(temporaryPath, content, { encoding: "utf-8", mode: 0o600 });
		replaceFile(temporaryPath, planPath);
	} finally {
		cleanupTemporaryFile(temporaryPath);
	}
}

export function copyPlanFile(sourcePath: string | undefined, destinationPath: string): boolean {
	const content = readPlanFile(sourcePath);
	if (content === null) return false;
	writePlanFile(destinationPath, content);
	return true;
}

function normalizeComparablePath(path: string): string {
	const normalized = normalize(path);
	return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

export function resolveToolPath(path: string, cwd: string): string {
	return normalizeComparablePath(resolve(cwd, path));
}

export function isCurrentPlanFile(path: unknown, planPath: string | undefined, cwd: string): boolean {
	if (typeof path !== "string" || !planPath) return false;
	return resolveToolPath(path, cwd) === normalizeComparablePath(planPath);
}

export function isPathInsidePlansDirectory(path: string, agentDir = getAgentDir()): boolean {
	const plansDirectory = normalizeComparablePath(getPlansDirectoryPath(agentDir));
	const candidate = normalizeComparablePath(resolve(path));
	return candidate === plansDirectory || candidate.startsWith(`${plansDirectory}${sep}`);
}
