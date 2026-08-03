import { matchesKey } from "@earendil-works/pi-tui";
import { describe, expect, it } from "vitest";
import { KEYBINDINGS } from "../src/core/keybindings.ts";
import { PLAN_MODE_SHORTCUT } from "../src/extensions/plan-mode/index.ts";

describe("plan mode shortcut", () => {
	it("uses Shift+Tab and accepts the standard terminal backtab sequence", () => {
		expect(PLAN_MODE_SHORTCUT).toBe("shift+tab");
		expect(matchesKey("\x1b[Z", PLAN_MODE_SHORTCUT)).toBe(true);
	});

	it("moves thinking-level cycling away from the reserved Shift+Tab binding", () => {
		expect(KEYBINDINGS["app.thinking.cycle"].defaultKeys).toBe("ctrl+alt+p");
	});
});
