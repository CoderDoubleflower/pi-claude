import chalk from "chalk";
import type { WorkingIndicatorOptions } from "../../../core/extensions/index.ts";

const CLAUDE_ORANGE = "#d77757";
const CLAUDE_SPINNER_INTERVAL_MS = 120;
const colorClaude = chalk.hex(CLAUDE_ORANGE);

// Mirrored from Claude Code's default loading verbs so each working row picks
// the same style of one-off activity label instead of always showing "Working".
const CLAUDE_WORKING_VERBS = [
	"Accomplishing",
	"Actioning",
	"Actualizing",
	"Architecting",
	"Baking",
	"Beaming",
	"Beboppin'",
	"Befuddling",
	"Billowing",
	"Blanching",
	"Bloviating",
	"Boogieing",
	"Boondoggling",
	"Booping",
	"Bootstrapping",
	"Brewing",
	"Bunning",
	"Burrowing",
	"Calculating",
	"Canoodling",
	"Caramelizing",
	"Cascading",
	"Catapulting",
	"Cerebrating",
	"Channeling",
	"Channelling",
	"Choreographing",
	"Churning",
	"Clauding",
	"Coalescing",
	"Cogitating",
	"Combobulating",
	"Composing",
	"Computing",
	"Concocting",
	"Considering",
	"Contemplating",
	"Cooking",
	"Crafting",
	"Creating",
	"Crunching",
	"Crystallizing",
	"Cultivating",
	"Deciphering",
	"Deliberating",
	"Determining",
	"Dilly-dallying",
	"Discombobulating",
	"Doing",
	"Doodling",
	"Drizzling",
	"Ebbing",
	"Effecting",
	"Elucidating",
	"Embellishing",
	"Enchanting",
	"Envisioning",
	"Evaporating",
	"Fermenting",
	"Fiddle-faddling",
	"Finagling",
	"Flambéing",
	"Flibbertigibbeting",
	"Flowing",
	"Flummoxing",
	"Fluttering",
	"Forging",
	"Forming",
	"Frolicking",
	"Frosting",
	"Gallivanting",
	"Galloping",
	"Garnishing",
	"Generating",
	"Gesticulating",
	"Germinating",
	"Gitifying",
	"Grooving",
	"Gusting",
	"Harmonizing",
	"Hashing",
	"Hatching",
	"Herding",
	"Honking",
	"Hullaballooing",
	"Hyperspacing",
	"Ideating",
	"Imagining",
	"Improvising",
	"Incubating",
	"Inferring",
	"Infusing",
	"Ionizing",
	"Jitterbugging",
	"Julienning",
	"Kneading",
	"Leavening",
	"Levitating",
	"Lollygagging",
	"Manifesting",
	"Marinating",
	"Meandering",
	"Metamorphosing",
	"Misting",
	"Moonwalking",
	"Moseying",
	"Mulling",
	"Mustering",
	"Musing",
	"Nebulizing",
	"Nesting",
	"Newspapering",
	"Noodling",
	"Nucleating",
	"Orbiting",
	"Orchestrating",
	"Osmosing",
	"Perambulating",
	"Percolating",
	"Perusing",
	"Philosophising",
	"Photosynthesizing",
	"Pollinating",
	"Pondering",
	"Pontificating",
	"Pouncing",
	"Precipitating",
	"Prestidigitating",
	"Processing",
	"Proofing",
	"Propagating",
	"Puttering",
	"Puzzling",
	"Quantumizing",
	"Razzle-dazzling",
	"Razzmatazzing",
	"Recombobulating",
	"Reticulating",
	"Roosting",
	"Ruminating",
	"Sautéing",
	"Scampering",
	"Schlepping",
	"Scurrying",
	"Seasoning",
	"Shenaniganing",
	"Shimmying",
	"Simmering",
	"Skedaddling",
	"Sketching",
	"Slithering",
	"Smooshing",
	"Sock-hopping",
	"Spelunking",
	"Spinning",
	"Sprouting",
	"Stewing",
	"Sublimating",
	"Swirling",
	"Swooping",
	"Symbioting",
	"Synthesizing",
	"Tempering",
	"Thinking",
	"Thundering",
	"Tinkering",
	"Tomfoolering",
	"Topsy-turvying",
	"Transfiguring",
	"Transmuting",
	"Twisting",
	"Undulating",
	"Unfurling",
	"Unravelling",
	"Vibing",
	"Waddling",
	"Wandering",
	"Warping",
	"Whatchamacalliting",
	"Whirlpooling",
	"Whirring",
	"Whisking",
	"Wibbling",
	"Working",
	"Wrangling",
	"Zesting",
	"Zigzagging",
] as const;

const CLAUDE_TURN_COMPLETION_VERBS = [
	"Baked",
	"Brewed",
	"Churned",
	"Cogitated",
	"Cooked",
	"Crunched",
	"Sautéed",
	"Worked",
] as const;
export const CLAUDE_TURN_DURATION_GLYPH = "✻";
export const CLAUDE_TURN_DURATION_THRESHOLD_MS = 30_000;

function getClaudeSpinnerCharacters(): string[] {
	if (process.env.TERM === "xterm-ghostty") {
		return ["·", "✢", "✳", "✶", "✻", "*"];
	}
	return process.platform === "darwin" ? ["·", "✢", "✳", "✶", "✻", "✽"] : ["·", "✢", "*", "✶", "✻", "✽"];
}

export function createClaudeWorkingMessage(): string {
	const verb = CLAUDE_WORKING_VERBS[Math.floor(Math.random() * CLAUDE_WORKING_VERBS.length)] ?? "Working";
	return `${verb}…`;
}

export function colorClaudeWorkingText(text: string): string {
	return colorClaude(text);
}

export function createClaudeTurnCompletionMessage(): string {
	return CLAUDE_TURN_COMPLETION_VERBS[Math.floor(Math.random() * CLAUDE_TURN_COMPLETION_VERBS.length)] ?? "Worked";
}

export function formatClaudeTurnDuration(ms: number): string {
	if (ms < 60_000) {
		if (ms === 0) return "0s";
		if (ms < 1) return (ms / 1000).toFixed(1) + "s";
		return Math.floor(ms / 1000).toString() + "s";
	}

	let days = Math.floor(ms / 86_400_000);
	let hours = Math.floor((ms % 86_400_000) / 3_600_000);
	let minutes = Math.floor((ms % 3_600_000) / 60_000);
	let seconds = Math.round((ms % 60_000) / 1000);

	if (seconds === 60) {
		seconds = 0;
		minutes++;
	}
	if (minutes === 60) {
		minutes = 0;
		hours++;
	}
	if (hours === 24) {
		hours = 0;
		days++;
	}

	if (days > 0) return days + "d " + hours + "h " + minutes + "m";
	if (hours > 0) return hours + "h " + minutes + "m " + seconds + "s";
	if (minutes > 0) return minutes + "m " + seconds + "s";
	return seconds + "s";
}

export function shouldShowClaudeTurnDuration({
	durationMs,
	aborted,
	willRetry,
}: {
	durationMs: number;
	aborted: boolean;
	willRetry: boolean;
}): boolean {
	return durationMs > CLAUDE_TURN_DURATION_THRESHOLD_MS && !aborted && !willRetry;
}

const spinnerCharacters = getClaudeSpinnerCharacters();

export const CLAUDE_WORKING_INDICATOR: WorkingIndicatorOptions = {
	frames: [...spinnerCharacters, ...[...spinnerCharacters].reverse()].map((character) => colorClaude(character)),
	intervalMs: CLAUDE_SPINNER_INTERVAL_MS,
};
