import type { InlineExtension } from "../core/extensions/types.ts";
import { remoteCompactionExtension } from "../core/remote-compaction/index.ts";
import llamaExtension from "./llama/index.ts";

export const builtInExtensions: InlineExtension[] = [
	{ name: "remote-compaction", factory: remoteCompactionExtension, hidden: true },
	{ name: "llama.cpp", factory: llamaExtension, hidden: true },
];
