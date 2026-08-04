import type { InlineExtension } from "../core/extensions/types.ts";
import { remoteCompactionExtension } from "../core/remote-compaction/index.ts";
import llamaExtension from "./llama/index.ts";
import planModeExtension from "./plan-mode/clean-session-wrapper.ts";
import todoPanelExtension from "./todo-panel.ts";

export const builtInExtensions: InlineExtension[] = [
	{ name: "remote-compaction", factory: remoteCompactionExtension, hidden: true },
	{ name: "llama.cpp", factory: llamaExtension, hidden: true },
	{ name: "todo-panel", factory: todoPanelExtension, hidden: true },
	{ name: "plan-mode", factory: planModeExtension, hidden: true },
];
