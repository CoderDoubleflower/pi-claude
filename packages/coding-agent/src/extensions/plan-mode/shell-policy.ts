export interface PlanShellDecision {
	safe: boolean;
	reason?: string;
}

const SIMPLE_READ_COMMANDS = new Set([
	"pwd",
	"ls",
	"cat",
	"head",
	"tail",
	"less",
	"more",
	"grep",
	"rg",
	"fd",
	"wc",
	"sort",
	"uniq",
	"diff",
	"file",
	"stat",
	"du",
	"df",
	"tree",
	"which",
	"whereis",
	"type",
	"printenv",
	"uname",
	"whoami",
	"id",
	"date",
	"ps",
	"jq",
	"bat",
	"eza",
	"echo",
	"printf",
]);

const GIT_READ_SUBCOMMANDS = new Set([
	"status",
	"log",
	"diff",
	"show",
	"ls-files",
	"ls-tree",
	"rev-parse",
	"cat-file",
	"blame",
	"grep",
	"describe",
	"shortlog",
]);

const PACKAGE_READ_SUBCOMMANDS = new Set(["list", "ls", "view", "info", "search", "outdated", "audit", "why"]);

function tokenize(command: string): string[] | null {
	const tokens: string[] = [];
	let current = "";
	let quote: "'" | '"' | null = null;
	let escaped = false;

	for (const char of command.trim()) {
		if (escaped) {
			current += char;
			escaped = false;
			continue;
		}
		if (char === "\\" && quote !== "'") {
			escaped = true;
			continue;
		}
		if (quote) {
			if (char === quote) quote = null;
			else current += char;
			continue;
		}
		if (char === "'" || char === '"') {
			quote = char;
			continue;
		}
		if (/\s/.test(char)) {
			if (current) {
				tokens.push(current);
				current = "";
			}
			continue;
		}
		current += char;
	}
	if (escaped || quote) return null;
	if (current) tokens.push(current);
	return tokens;
}

function unsafe(reason: string): PlanShellDecision {
	return { safe: false, reason };
}

function hasOption(tokens: readonly string[], short: string, long: string): boolean {
	return tokens.some(
		(token, index) =>
			token === short ||
			token === long ||
			token.startsWith(`${long}=`) ||
			(short.length === 2 && token.startsWith(short) && token.length > 2 && index > 0),
	);
}

function checkSimpleReadCommand(executable: string, tokens: string[]): PlanShellDecision {
	switch (executable) {
		case "sort":
		case "diff":
		case "tree":
		case "less":
			return hasOption(tokens.slice(1), "-o", "--output") || (executable === "less" && tokens.includes("-O"))
				? unsafe(`${executable} output-file options are not allowed`)
				: { safe: true };
		case "uniq": {
			const positionals = tokens.slice(1).filter((token) => !token.startsWith("-"));
			return positionals.length > 1 ? unsafe("uniq output files are not allowed") : { safe: true };
		}
		case "fd":
			return tokens.some((token) => ["-x", "-X", "--exec", "--exec-batch"].includes(token))
				? unsafe("fd command execution is not allowed")
				: { safe: true };
		case "date":
			return tokens.some((token) => token === "-s" || token === "--set" || token.startsWith("--set="))
				? unsafe("date may not change the system clock")
				: { safe: true };
		default:
			return { safe: true };
	}
}

function checkGit(tokens: string[]): PlanShellDecision {
	if (tokens.some((token) => token === "--output" || token.startsWith("--output="))) {
		return unsafe("git output-file options are not allowed in plan mode");
	}
	const subcommand = tokens[1];
	if (!subcommand) return unsafe("git requires an explicitly read-only subcommand");
	if (GIT_READ_SUBCOMMANDS.has(subcommand)) return { safe: true };

	if (subcommand === "branch") {
		const args = tokens.slice(2);
		const mutationFlag = args.some((arg) => /^-(?:d|D|m|M|c|C)$/.test(arg) || arg.startsWith("--delete"));
		const positional = args.filter((arg) => !arg.startsWith("-"));
		return mutationFlag || positional.length > 0
			? unsafe("git branch mutation is not allowed in plan mode")
			: { safe: true };
	}

	if (subcommand === "remote") {
		const action = tokens[2];
		return action === undefined || action === "-v" || action === "show" || action === "get-url"
			? { safe: true }
			: unsafe("only read-only git remote operations are allowed");
	}

	if (subcommand === "config") {
		const args = tokens.slice(2);
		return args.some((arg) => ["--get", "--get-all", "--get-regexp", "--list", "-l"].includes(arg))
			? { safe: true }
			: unsafe("git config is allowed only for reads");
	}

	return unsafe(`git ${subcommand} may change repository state`);
}

function checkFind(tokens: string[]): PlanShellDecision {
	const unsafePrimary = tokens.find((token) =>
		["-delete", "-exec", "-execdir", "-ok", "-okdir", "-fprint", "-fprint0", "-fprintf", "-fls"].includes(token),
	);
	return unsafePrimary ? unsafe(`find ${unsafePrimary} can change state or write files`) : { safe: true };
}

export function checkPlanReadOnlyCommand(command: string): PlanShellDecision {
	const trimmed = command.trim();
	if (!trimmed) return unsafe("empty command");

	if (/\r|\n/.test(trimmed)) return unsafe("multi-line shell commands are not allowed in plan mode");
	if (/`|\$\(|<\(|>\(/.test(trimmed)) return unsafe("command and process substitution are not allowed");
	if (/(^|[^\\])[;&|<>]/.test(trimmed)) return unsafe("shell control operators and redirections are not allowed");

	const tokens = tokenize(trimmed);
	if (!tokens || tokens.length === 0) return unsafe("command could not be parsed safely");
	const executable = tokens[0];
	if (executable.includes("/") || executable.includes("\\")) {
		return unsafe("commands must use a known executable name, not an arbitrary path");
	}

	if (SIMPLE_READ_COMMANDS.has(executable)) return checkSimpleReadCommand(executable, tokens);
	if (executable === "find") return checkFind(tokens);
	if (executable === "git") return checkGit(tokens);
	if (executable === "npm" || executable === "pnpm" || executable === "yarn") {
		const subcommand = tokens[1];
		const requestsMutation = tokens
			.slice(2)
			.some((token) => token === "fix" || token === "--fix" || token.startsWith("--fix="));
		return subcommand && PACKAGE_READ_SUBCOMMANDS.has(subcommand) && !requestsMutation
			? { safe: true }
			: unsafe(`${executable} is allowed only for metadata and audit reads`);
	}
	if (["node", "python", "python3", "ruby", "go", "rustc", "cargo"].includes(executable)) {
		return tokens.length === 2 && ["--version", "-V", "version"].includes(tokens[1])
			? { safe: true }
			: unsafe(`${executable} can execute code and is limited to version output`);
	}

	return unsafe(`${executable} is not in the plan-mode read-only allowlist`);
}

export function isPlanReadOnlyCommand(command: string): boolean {
	return checkPlanReadOnlyCommand(command).safe;
}
