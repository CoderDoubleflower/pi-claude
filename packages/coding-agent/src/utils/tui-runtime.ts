import * as tuiRuntime from "@earendil-works/pi-tui";
import type { Terminal, TUI } from "@earendil-works/pi-tui";

type MainScreenConstructor = new (
	terminal: Terminal,
	showHardwareCursor?: boolean,
	logDirectory?: string,
) => TUI;

interface AltScreenOptions {
	openUrl?: (url: string) => void;
}

type AltScreenConstructor = new (
	terminal: Terminal,
	showHardwareCursor?: boolean,
	logDirectory?: string,
	options?: AltScreenOptions,
) => TUI;

interface CompatibleTuiRuntime {
	TUI?: MainScreenConstructor;
	TuiMainScreen?: MainScreenConstructor;
	TuiAltScreen?: AltScreenConstructor;
}

// Published pi-tui 0.83.0 exposes TUI, while the newer workspace exposes
// TuiMainScreen/TuiAltScreen. Namespace access keeps both runtimes loadable.
const compatibleRuntime = tuiRuntime as unknown as CompatibleTuiRuntime;
let warnedAboutAltScreenFallback = false;

function getMainScreenConstructor(): MainScreenConstructor {
	const Constructor = compatibleRuntime.TuiMainScreen ?? compatibleRuntime.TUI;
	if (!Constructor) {
		throw new Error(
			"The installed @earendil-works/pi-tui package does not expose a compatible main-screen TUI constructor.",
		);
	}
	return Constructor;
}

export function createMainScreenTui(
	terminal: Terminal,
	showHardwareCursor?: boolean,
	logDirectory?: string,
): TUI {
	const Constructor = getMainScreenConstructor();
	return new Constructor(terminal, showHardwareCursor, logDirectory);
}

export function createAltScreenTui(
	terminal: Terminal,
	showHardwareCursor?: boolean,
	logDirectory?: string,
	options: AltScreenOptions = {},
): TUI {
	const Constructor = compatibleRuntime.TuiAltScreen;
	if (Constructor) {
		return new Constructor(terminal, showHardwareCursor, logDirectory, options);
	}

	if (!warnedAboutAltScreenFallback) {
		warnedAboutAltScreenFallback = true;
		process.emitWarning(
			"The installed @earendil-works/pi-tui version does not support alternate-screen mode; falling back to the main-screen renderer.",
			{ code: "PI_TUI_ALT_SCREEN_UNAVAILABLE" },
		);
	}

	return createMainScreenTui(terminal, showHardwareCursor, logDirectory);
}
