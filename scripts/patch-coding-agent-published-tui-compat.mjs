#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";

const interactiveModePath = new URL(
	"../packages/coding-agent/dist/modes/interactive/interactive-mode.js",
	import.meta.url,
);
const incompatibleCall = "TuiLayouts.isViewportTUI(this.ui)";
const compatibleCheck = 'typeof this.ui.setLayoutRoot === "function"';

const source = readFileSync(interactiveModePath, "utf8");
const occurrences = source.split(incompatibleCall).length - 1;

if (occurrences !== 1) {
	throw new Error(
		`Expected exactly one ${incompatibleCall} call in the built interactive mode, found ${occurrences}. ` +
			"Update the published TUI compatibility patch before releasing.",
	);
}

writeFileSync(interactiveModePath, source.replace(incompatibleCall, compatibleCheck));
console.log("Patched built interactive mode for published pi-tui 0.83.0 compatibility.");
