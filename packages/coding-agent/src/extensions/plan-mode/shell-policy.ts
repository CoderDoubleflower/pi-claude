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

const GIT_EXECUTION_OPTIONS = ["--ext-diff", "--textconv", "--filters", "--open-files-in-pager"] as const;
const GIT_BRANCH_MUTATION_OPTIONS = [
	"--delete",
	"--move",
	"--copy",
	"--edit-description",
	"--set-upstream-to",
	"--unset-upstream",
	"--create-reflog",
] as const;
const GIT_CONFIG_MUTATION_OPTIONS = [
	"--add",
	"--replace-all",
	"--unset",
	"--unset-all",
	"--rename-section",
	"--remove-section",
	"--edit",
] as const;
const GIT_CONFIG_READ_OPTIONS = ["--get", "--get-all", "--get-regexp", "--list"] as const;
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

function checkShellSyntax(command: string): PlanShellDecision | undefined {
	let quote: "'" | '"' | null = null;
	let escaped = false;

	for (const char of command) {
		if (char === "\r" || char === "\n") return unsafe("multi-line shell commands are not allowed in plan mode");

		if (escaped) {
			escaped = false;
			continue;
		}
		if (char === "\\" && quote !== "'") {
			escaped = true;
			continue;
		}
		if (quote === "'") {
			if (char === "'") quote = null;
			continue;
		}
		if (quote === '"') {
			if (char === '"') {
				quote = null;
				continue;
			}
			if (char === "$" || char === "`") {
				return unsafe("shell expansion and command substitution are not allowed in plan mode");
			}
			continue;
		}
		if (char === "'" || char === '"') {
			quote = char;
			continue;
		}
		if (char === "$" || char === "`") {
			return unsafe("shell expansion and command substitution are not allowed in plan mode");
		}
		if (";&|<>".includes(char)) {
			return unsafe("shell control operators and redirections are not allowed in plan mode");
		}
		if ("*?[]{}()".includes(char)) {
			return unsafe("unquoted shell expansion syntax is not allowed in plan mode");
		}
	}

	return escaped || quote ? unsafe("command could not be parsed safely") : undefined;
}

function isLongOption(token: string, option: string): boolean {
	if (!token.startsWith("--")) return false;
	const name = token.split("=", 1)[0];
	return name === option || (name.length > 2 && option.startsWith(name));
}

function hasLongOption(tokens: readonly string[], option: string): boolean {
	return tokens.some((token) => isLongOption(token, option));
}

function hasAnyLongOption(tokens: readonly string[], options: readonly string[]): boolean {
	return options.some((option) => hasLongOption(tokens, option));
}

function hasOption(tokens: readonly string[], short: string, long?: string): boolean {
	return tokens.some(
		(token) =>
			token === short ||
			(long !== undefined && isLongOption(token, long)) ||
			(short.length === 2 && token.startsWith(short) && token.length > 2),
	);
}

function checkSimpleReadCommand(executable: string, tokens: string[]): PlanShellDecision {
	const args = tokens.slice(1);
	switch (executable) {
		case "sort":
			return hasOption(args, "-o", "--output") || hasLongOption(args, "--compress-program")
				? unsafe("sort output and external compression options are not allowed")
				: { safe: true };
		case "diff":
		case "tree":
			return hasOption(args, "-o", "--output")
				? unsafe(`${executable} output-file options are not allowed`)
				: { safe: true };
		case "less":
			return hasOption(args, "-o", "--log-file") ||
				hasOption(args, "-O") ||
				hasLongOption(args, "--cmd") ||
				args.some((token) => token.startsWith("+!"))
				? unsafe("less log-file and shell-command options are not allowed")
				: { safe: true };
		case "uniq": {
			const positionals = args.filter((token) => !token.startsWith("-"));
			return positionals.length > 1 ? unsafe("uniq output files are not allowed") : { safe: true };
		}
		case "rg":
			return hasLongOption(args, "--pre")
				? unsafe("rg preprocessors may execute arbitrary commands")
				: { safe: true };
		case "fd":
			return args.some(
				(token) =>
					token === "-x" ||
					token === "-X" ||
					(token.startsWith("-x") && token.length > 2) ||
					(token.startsWith("-X") && token.length > 2) ||
					isLongOption(token, "--exec") ||
					isLongOption(token, "--exec-batch"),
			)
				? unsafe("fd command execution is not allowed")
				: { safe: true };
		case "file":
			return hasOption(args, "-C", "--compile")
				? unsafe("file compilation writes a magic database")
				: { safe: true };
		case "date":
			return hasOption(args, "-s", "--set") ? unsafe("date may not change the system clock") : { safe: true };
		case "bat":
			return args.includes("cache") || hasLongOption(args, "--pager") || hasLongOption(args, "--generate-config-file")
				? unsafe("bat cache, pager, and config-generation operations are not allowed")
				: { safe: true };
		default:
			return { safe: true };
	}
}

function checkGit(tokens: string[]): PlanShellDecision {
	const args = tokens.slice(1);
	if (hasLongOption(args, "--output")) {
		return unsafe("git output-file options are not allowed in plan mode");
	}
	if (
		hasAnyLongOption(args, GIT_EXECUTION_OPTIONS) ||
		args.some((token) => token === "-O" || token.startsWith("-O"))
	) {
		return unsafe("git options that invoke external helpers are not allowed in plan mode");
	}

	const subcommand = tokens[1];
	if (!subcommand) return unsafe("git requires an explicitly read-only subcommand");
	if (GIT_READ_SUBCOMMANDS.has(subcommand)) return { safe: true };

	if (subcommand === "branch") {
		const branchArgs = tokens.slice(2);
		const mutationFlag =
			branchArgs.some(
				(arg) => /^-(?:d|D|m|M|c|C)/.test(arg) || arg === "-u" || (arg.startsWith("-u") && arg.length > 2),
			) || hasAnyLongOption(branchArgs, GIT_BRANCH_MUTATION_OPTIONS);
		const positional = branchArgs.filter((arg) => !arg.startsWith("-"));
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
		const configArgs = tokens.slice(2);
		const mutationFlag = configArgs.includes("-e") || hasAnyLongOption(configArgs, GIT_CONFIG_MUTATION_OPTIONS);
		const hasReadAction = configArgs.includes("-l") || hasAnyLongOption(configArgs, GIT_CONFIG_READ_OPTIONS);
		return hasReadAction && !mutationFlag ? { safe: true } : unsafe("git config is allowed only for reads");
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

	const syntaxDecision = checkShellSyntax(trimmed);
	if (syntaxDecision) return syntaxDecision;

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
