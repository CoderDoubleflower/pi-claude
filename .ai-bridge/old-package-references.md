# References to @earendil-works/pi-coding-agent

```text
.github/workflows/scan-old-package-references.yml:25:            echo '# References to @earendil-works/pi-coding-agent'
.github/workflows/scan-old-package-references.yml:28:            git grep -n '@earendil-works/pi-coding-agent' -- ':!.ai-bridge/*' || true
.pi/extensions/import-repro.ts:21:import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
.pi/extensions/prompt-url-widget.ts:4:import { DynamicBorder, type ExtensionAPI, type ExtensionContext } from "@earendil-works/pi-coding-agent";
.pi/extensions/redraws.ts:7:import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
.pi/extensions/tps.ts:2:import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
README.md:8:  <a href="https://www.npmjs.com/package/@earendil-works/pi-coding-agent"><img alt="npm" src="https://img.shields.io/npm/v/@earendil-works/pi-coding-agent?style=flat-square" /></a>
README.md:17:* **[@earendil-works/pi-coding-agent](packages/coding-agent)**: Interactive coding agent CLI
README.md:32:| **[@earendil-works/pi-coding-agent](packages/coding-agent)** | Interactive coding agent CLI |
package-lock.json:5626:				"@earendil-works/pi-coding-agent": "^0.82.1",
package-lock.json:5656:				"@earendil-works/pi-coding-agent": "^0.82.1"
packages/coding-agent/CHANGELOG.md:1023:- **Self-update support for the npm scope migration**: `pi update --self` now supports the upcoming package rename from `@mariozechner/pi-coding-agent` to `@earendil-works/pi-coding-agent`. After the new package is published, existing global installs can update through the normal self-update flow; pi will uninstall the old global package and install the package name returned by the version check endpoint.
packages/coding-agent/README.md:8:  <a href="https://www.npmjs.com/package/@earendil-works/pi-coding-agent"><img alt="npm" src="https://img.shields.io/npm/v/@earendil-works/pi-coding-agent?style=flat-square" /></a>
packages/coding-agent/README.md:66:npm install -g --ignore-scripts @earendil-works/pi-coding-agent
packages/coding-agent/README.md:462:import { createAgentSession, ModelRuntime, SessionManager } from "@earendil-works/pi-coding-agent";
packages/coding-agent/docs/compaction.md:12:For TypeScript definitions in your project, inspect `node_modules/@earendil-works/pi-coding-agent/dist/`.
packages/coding-agent/docs/compaction.md:317:import { convertToLlm, serializeConversation } from "@earendil-works/pi-coding-agent";
packages/coding-agent/docs/containerization.md:57:RUN npm install -g --ignore-scripts @earendil-works/pi-coding-agent
packages/coding-agent/docs/custom-provider.md:37:import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
packages/coding-agent/docs/custom-provider.md:128:import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
packages/coding-agent/docs/extensions.md:61:import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
packages/coding-agent/docs/extensions.md:143:| `@earendil-works/pi-coding-agent` | Extension types (`ExtensionAPI`, `ExtensionContext`, events) |
packages/coding-agent/docs/extensions.md:159:import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
packages/coding-agent/docs/extensions.md:188:import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
packages/coding-agent/docs/extensions.md:768:import { isToolCallEventType } from "@earendil-works/pi-coding-agent";
packages/coding-agent/docs/extensions.md:804:import { isToolCallEventType } from "@earendil-works/pi-coding-agent";
packages/coding-agent/docs/extensions.md:828:import { isBashToolResult } from "@earendil-works/pi-coding-agent";
packages/coding-agent/docs/extensions.md:856:import { createLocalBashOperations } from "@earendil-works/pi-coding-agent";
packages/coding-agent/docs/extensions.md:955:import { CONFIG_DIR_NAME, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
packages/coding-agent/docs/extensions.md:1210:import { SessionManager } from "@earendil-works/pi-coding-agent";
packages/coding-agent/docs/extensions.md:1304:import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
packages/coding-agent/docs/extensions.md:1876:import { withFileMutationQueue } from "@earendil-works/pi-coding-agent";
packages/coding-agent/docs/extensions.md:2059:import { createReadTool, createBashTool, type ReadOperations } from "@earendil-works/pi-coding-agent";
packages/coding-agent/docs/extensions.md:2090:import { createBashTool } from "@earendil-works/pi-coding-agent";
packages/coding-agent/docs/extensions.md:2128:} from "@earendil-works/pi-coding-agent";
packages/coding-agent/docs/extensions.md:2264:import { keyHint } from "@earendil-works/pi-coding-agent";
packages/coding-agent/docs/extensions.md:2346:import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
packages/coding-agent/docs/extensions.md:2742:import { CustomEditor, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
packages/coding-agent/docs/extensions.md:2852:import { highlightCode, getLanguageFromPath } from "@earendil-works/pi-coding-agent";
packages/coding-agent/docs/index.md:10:npm install -g --ignore-scripts @earendil-works/pi-coding-agent
packages/coding-agent/docs/index.md:24:npm uninstall -g @earendil-works/pi-coding-agent
packages/coding-agent/docs/index.md:27:For pnpm, Yarn, or Bun installs, use the matching global remove command: `pnpm remove -g @earendil-works/pi-coding-agent`, `yarn global remove @earendil-works/pi-coding-agent`, or `bun uninstall -g @earendil-works/pi-coding-agent`.
packages/coding-agent/docs/packages.md:171:Pi bundles core packages for extensions and skills. If you import any of these, list them in `peerDependencies` with a `"*"` range and do not bundle them: `@earendil-works/pi-ai`, `@earendil-works/pi-agent-core`, `@earendil-works/pi-coding-agent`, `@earendil-works/pi-tui`, `typebox`.
packages/coding-agent/docs/quickstart.md:10:npm install -g --ignore-scripts @earendil-works/pi-coding-agent
packages/coding-agent/docs/quickstart.md:21:npm uninstall -g @earendil-works/pi-coding-agent
packages/coding-agent/docs/quickstart.md:24:pnpm remove -g @earendil-works/pi-coding-agent
packages/coding-agent/docs/quickstart.md:27:yarn global remove @earendil-works/pi-coding-agent
packages/coding-agent/docs/quickstart.md:30:bun uninstall -g @earendil-works/pi-coding-agent
packages/coding-agent/docs/rpc.md:5:**Note for Node.js/TypeScript users**: If you're building a Node.js application, consider using `AgentSession` directly from `@earendil-works/pi-coding-agent` instead of spawning a subprocess. See [`src/core/agent-session.ts`](../src/core/agent-session.ts) for the API. For a subprocess-based TypeScript client, see [`src/modes/rpc/rpc-client.ts`](../src/modes/rpc/rpc-client.ts).
packages/coding-agent/docs/sdk.md:19:import { createAgentSession, ModelRuntime, SessionManager } from "@earendil-works/pi-coding-agent";
packages/coding-agent/docs/sdk.md:39:npm install @earendil-works/pi-coding-agent
packages/coding-agent/docs/sdk.md:53:import { createAgentSession, SessionManager } from "@earendil-works/pi-coding-agent";
packages/coding-agent/docs/sdk.md:131:} from "@earendil-works/pi-coding-agent";
packages/coding-agent/docs/sdk.md:371:import { ModelRuntime } from "@earendil-works/pi-coding-agent";
packages/coding-agent/docs/sdk.md:411:} from "@earendil-works/pi-coding-agent";
packages/coding-agent/docs/sdk.md:443:import { createAgentSession, ModelRuntime } from "@earendil-works/pi-coding-agent";
packages/coding-agent/docs/sdk.md:479:import { createAgentSession, DefaultResourceLoader } from "@earendil-works/pi-coding-agent";
packages/coding-agent/docs/sdk.md:504:import { createAgentSession } from "@earendil-works/pi-coding-agent";
packages/coding-agent/docs/sdk.md:527:import { createAgentSession, SessionManager } from "@earendil-works/pi-coding-agent";
packages/coding-agent/docs/sdk.md:551:import { createAgentSession, defineTool } from "@earendil-works/pi-coding-agent";
packages/coding-agent/docs/sdk.md:586:import { createAgentSession, DefaultResourceLoader } from "@earendil-works/pi-coding-agent";
packages/coding-agent/docs/sdk.md:608:import type { InlineExtension } from "@earendil-works/pi-coding-agent";
packages/coding-agent/docs/sdk.md:629:import { createEventBus, DefaultResourceLoader } from "@earendil-works/pi-coding-agent";
packages/coding-agent/docs/sdk.md:649:} from "@earendil-works/pi-coding-agent";
packages/coding-agent/docs/sdk.md:675:import { createAgentSession, DefaultResourceLoader } from "@earendil-works/pi-coding-agent";
packages/coding-agent/docs/sdk.md:699:} from "@earendil-works/pi-coding-agent";
packages/coding-agent/docs/sdk.md:734:} from "@earendil-works/pi-coding-agent";
packages/coding-agent/docs/sdk.md:828:import { createAgentSession, SettingsManager, SessionManager } from "@earendil-works/pi-coding-agent";
packages/coding-agent/docs/sdk.md:884:} from "@earendil-works/pi-coding-agent";
packages/coding-agent/docs/sdk.md:934:} from "@earendil-works/pi-coding-agent";
packages/coding-agent/docs/sdk.md:1015:} from "@earendil-works/pi-coding-agent";
packages/coding-agent/docs/sdk.md:1055:} from "@earendil-works/pi-coding-agent";
packages/coding-agent/docs/sdk.md:1092:} from "@earendil-works/pi-coding-agent";
packages/coding-agent/docs/session-format.md:37:For TypeScript definitions in your project, inspect `node_modules/@earendil-works/pi-coding-agent/dist/` and `node_modules/@earendil-works/pi-ai/dist/`.
packages/coding-agent/docs/termux.md:20:npm install -g --ignore-scripts @earendil-works/pi-coding-agent
packages/coding-agent/docs/tui.md:452:import { getMarkdownTheme } from "@earendil-works/pi-coding-agent";
packages/coding-agent/docs/tui.md:617:import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
packages/coding-agent/docs/tui.md:618:import { DynamicBorder } from "@earendil-works/pi-coding-agent";
packages/coding-agent/docs/tui.md:677:import { BorderedLoader } from "@earendil-works/pi-coding-agent";
packages/coding-agent/docs/tui.md:709:import { getSettingsListTheme } from "@earendil-works/pi-coding-agent";
packages/coding-agent/docs/tui.md:849:import { CustomEditor, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/README.md:145:import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/auto-commit-on-exit.ts:8:import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/bash-spawn-hook.ts:10:import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/bash-spawn-hook.ts:11:import { createBashTool } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/bookmark.ts:10:import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/border-status-editor.ts:6:} from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/built-in-tool-renderer.ts:28:import type { BashToolDetails, EditToolDetails, ExtensionAPI, ReadToolDetails } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/built-in-tool-renderer.ts:29:import { createBashTool, createEditTool, createReadTool, createWriteTool } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/claude-rules.ts:22:import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/commands.ts:13:import type { ExtensionAPI, SlashCommandInfo } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/confirm-destructive.ts:8:import type { ExtensionAPI, SessionBeforeSwitchEvent, SessionMessageEntry } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/custom-compaction.ts:18:import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/custom-compaction.ts:19:import { convertToLlm, serializeConversation } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/custom-footer.ts:12:import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/custom-header.ts:8:import type { ExtensionAPI, Theme } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/custom-header.ts:9:import { VERSION } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/custom-provider-anthropic/index.ts:46:import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/custom-provider-gitlab-duo/index.ts:25:import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/dirty-repo-guard.ts:8:import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/doom-overlay/index.ts:12:import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/dynamic-resources/index.ts:3:import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/dynamic-tools.ts:10:import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/entry-renderer.ts:11:import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/event-bus.ts:10:import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/file-trigger.ts:12:import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/git-checkpoint.ts:8:import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/git-merge-and-resolve.ts:17:import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/github-issue-autocomplete.ts:4:import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/gondolin/index.ts:24:import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/gondolin/index.ts:45:} from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/handoff.ts:18:import type { ExtensionAPI, SessionEntry } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/handoff.ts:19:import { BorderedLoader, convertToLlm, serializeConversation } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/hello.ts:6:import { defineTool, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/hidden-thinking-label.ts:21:import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/inline-bash.ts:17:import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/input-transform-streaming.ts:14:import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/input-transform.ts:12:import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/interactive-shell.ts:24:import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/kimi-deferred-tools.ts:8:import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/mac-system-theme.ts:10:import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/message-renderer.ts:10:import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/minimal-mode.ts:19:import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/minimal-mode.ts:28:} from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/modal-editor.ts:12:import { CustomEditor, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/model-status.ts:10:import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/notify.ts:11:import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/overlay-qa-tests.ts:22:import type { ExtensionAPI, ExtensionCommandContext, Theme } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/overlay-test.ts:11:import type { ExtensionAPI, ExtensionCommandContext, Theme } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/permission-gate.ts:8:import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/pirate.ts:13:import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/plan-mode/index.ts:17:import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/preset.ts:44:import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/preset.ts:45:import { CONFIG_DIR_NAME, DynamicBorder, getAgentDir } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/project-trust.ts:16:import type { ExtensionAPI, ProjectTrustEventResult } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/prompt-customizer.ts:15:import type { BuildSystemPromptOptions, ExtensionAPI } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/protected-paths.ts:8:import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/provider-payload.ts:3:import { CONFIG_DIR_NAME, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/qna.ts:11:import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/qna.ts:12:import { BorderedLoader } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/question.ts:7:import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/questionnaire.ts:8:import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/rainbow-editor.ts:7:import { CustomEditor, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/reload-runtime.ts:8:import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/rpc-demo.ts:20:import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/sandbox/index.ts:48:import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/sandbox/index.ts:49:import { type BashOperations, CONFIG_DIR_NAME, createBashTool, getAgentDir } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/send-user-message.ts:14:import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/session-name.ts:10:import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/shutdown-command.ts:8:import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/snake.ts:5:import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/space-invaders.ts:6:import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/ssh.ts:17:import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/ssh.ts:27:} from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/status-line.ts:8:import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/structured-output.ts:8:import { defineTool, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/subagent/agents.ts:7:import { CONFIG_DIR_NAME, getAgentDir, parseFrontmatter } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/subagent/index.ts:28:} from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/summarize.ts:3:import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/summarize.ts:4:import { DynamicBorder, getMarkdownTheme } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/system-prompt-header.ts:6:import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/tic-tac-toe.ts:21:import type { ExtensionAPI, ExtensionContext, Theme, ToolExecutionMode } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/timed-confirm.ts:10:import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/titlebar-spinner.ts:12:import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/todo.ts:14:import type { ExtensionAPI, ExtensionContext, Theme } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/tool-override.ts:24:import { type ExtensionAPI, getAgentDir, withFileMutationQueue } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/tools.ts:12:import type { ExtensionAPI, ExtensionContext, ToolInfo } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/tools.ts:13:import { getSettingsListTheme } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/trigger-compact.ts:1:import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/truncated-tool.ts:18:import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/truncated-tool.ts:26:} from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/widget-placement.ts:1:import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/with-deps/index.ts:8:import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/working-indicator.ts:19:import type { ExtensionAPI, ExtensionContext, WorkingIndicatorOptions } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/extensions/working-message-test.ts:15:import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/sdk/01-minimal.ts:8:import { createAgentSession } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/sdk/02-custom-model.ts:8:import { createAgentSession, ModelRuntime } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/sdk/03-custom-prompt.ts:12:} from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/sdk/04-skills.ts:15:} from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/sdk/05-tools.ts:13:import { createAgentSession, SessionManager } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/sdk/06-extensions.ts:21:} from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/sdk/06-extensions.ts:60:import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/sdk/07-context-files.ts:12:} from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/sdk/08-prompt-templates.ts:14:} from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/sdk/09-api-keys-and-oauth.ts:7:import { createAgentSession, ModelRuntime, SessionManager } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/sdk/10-settings.ts:7:import { createAgentSession, SessionManager, SettingsManager } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/sdk/11-sessions.ts:7:import { createAgentSession, SessionManager } from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/sdk/12-full-control.ts:15:} from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/sdk/13-session-runtime.ts:18:} from "@earendil-works/pi-coding-agent";
packages/coding-agent/examples/sdk/README.md:42:} from "@earendil-works/pi-coding-agent";
packages/coding-agent/install-lock/package-lock.json:2:	"name": "@earendil-works/pi-coding-agent-install",
packages/coding-agent/install-lock/package-lock.json:8:			"name": "@earendil-works/pi-coding-agent-install",
packages/coding-agent/install-lock/package-lock.json:11:				"@earendil-works/pi-coding-agent": "0.82.1"
packages/coding-agent/install-lock/package-lock.json:491:		"node_modules/@earendil-works/pi-coding-agent": {
packages/coding-agent/install-lock/package-lock.json:493:			"resolved": "https://registry.npmjs.org/@earendil-works/pi-coding-agent/-/pi-coding-agent-0.82.1.tgz",
packages/coding-agent/install-lock/package.json:2:	"name": "@earendil-works/pi-coding-agent-install",
packages/coding-agent/install-lock/package.json:7:		"@earendil-works/pi-coding-agent": "0.82.1"
packages/coding-agent/src/cli/startup-ui.ts:26:const OFFICIAL_PACKAGE_NAME = "@earendil-works/pi-coding-agent";
packages/coding-agent/src/config.ts:488:export const PACKAGE_NAME: string = pkg.name || "@earendil-works/pi-coding-agent";
packages/coding-agent/src/core/extensions/loader.ts:26:// avoiding a circular dependency. Extensions can import from @earendil-works/pi-coding-agent.
packages/coding-agent/src/core/extensions/loader.ts:64:	"@earendil-works/pi-coding-agent": _bundledPiCodingAgent,
packages/coding-agent/src/core/extensions/loader.ts:115:		"@earendil-works/pi-coding-agent": piCodingAgentEntry,
packages/coding-agent/src/core/extensions/types.ts:236:	 * extend `CustomEditor` from `@earendil-works/pi-coding-agent` and call
packages/coding-agent/src/core/extensions/types.ts:241:	 * import { CustomEditor } from "@earendil-works/pi-coding-agent";
packages/coding-agent/src/modes/interactive/theme/theme.ts:832:const THEME_KEY = Symbol.for("@earendil-works/pi-coding-agent:theme");
packages/coding-agent/test/config.test.ts:155:		expect(getUpdateInstruction("@earendil-works/pi-coding-agent")).toBe(
packages/coding-agent/test/config.test.ts:156:			"Run: pnpm install -g --ignore-scripts --config.minimumReleaseAge=0 @earendil-works/pi-coding-agent",
packages/coding-agent/test/config.test.ts:164:		expect(getSelfUpdateCommand("@earendil-works/pi-coding-agent")).toBeUndefined();
packages/coding-agent/test/config.test.ts:165:		expect(getUpdateInstruction("@earendil-works/pi-coding-agent")).toBe(
packages/coding-agent/test/config.test.ts:166:			"Update @earendil-works/pi-coding-agent using the package manager, wrapper, or source checkout that provides this installation.",
packages/coding-agent/test/config.test.ts:173:		const command = getSelfUpdateCommand("@earendil-works/pi-coding-agent");
packages/coding-agent/test/config.test.ts:185:				"@earendil-works/pi-coding-agent",
packages/coding-agent/test/config.test.ts:187:			display: `npm --prefix ${prefix} install -g --ignore-scripts --min-release-age=0 @earendil-works/pi-coding-agent`,
packages/coding-agent/test/config.test.ts:194:		const command = getSelfUpdateCommand("@earendil-works/pi-coding-agent", undefined, {
packages/coding-agent/test/config.test.ts:195:			packageName: "@earendil-works/pi-coding-agent",
packages/coding-agent/test/config.test.ts:196:			installSpec: "@earendil-works/pi-coding-agent@1.2.3",
packages/coding-agent/test/config.test.ts:208:				"@earendil-works/pi-coding-agent@1.2.3",
packages/coding-agent/test/config.test.ts:210:			display: `npm --prefix ${prefix} install -g --ignore-scripts --min-release-age=0 @earendil-works/pi-coding-agent@1.2.3`,
packages/coding-agent/test/config.test.ts:241:		const command = getSelfUpdateCommand("@earendil-works/pi-coding-agent", ["npm", "--prefix", prefix]);
packages/coding-agent/test/config.test.ts:252:				"@earendil-works/pi-coding-agent",
packages/coding-agent/test/config.test.ts:254:			display: `npm --prefix ${prefix} install -g --ignore-scripts --min-release-age=0 @earendil-works/pi-coding-agent`,
packages/coding-agent/test/config.test.ts:261:		const command = getSelfUpdateCommand("@earendil-works/pi-coding-agent", []);
packages/coding-agent/test/config.test.ts:270:			"@earendil-works/pi-coding-agent",
packages/coding-agent/test/config.test.ts:277:		const command = getSelfUpdateCommand("@earendil-works/pi-coding-agent");
packages/coding-agent/test/config.test.ts:280:			`npm --prefix "${prefix}" install -g --ignore-scripts --min-release-age=0 @earendil-works/pi-coding-agent`,
packages/coding-agent/test/config.test.ts:290:		expect(getUpdateInstruction("@earendil-works/pi-coding-agent")).toBe(
packages/coding-agent/test/config.test.ts:291:			"Run: npm install -g --ignore-scripts --min-release-age=0 @earendil-works/pi-coding-agent",
packages/coding-agent/test/config.test.ts:298:		const command = getSelfUpdateCommand("@earendil-works/pi-coding-agent");
packages/coding-agent/test/config.test.ts:303:			args: ["install", "-g", "--ignore-scripts", "--minimum-release-age=0", "@earendil-works/pi-coding-agent"],
packages/coding-agent/test/config.test.ts:304:			display: "bun install -g --ignore-scripts --minimum-release-age=0 @earendil-works/pi-coding-agent",
packages/coding-agent/test/config.test.ts:338:		const packageName = "@earendil-works/pi-coding-agent";
packages/coding-agent/test/config.test.ts:432:		expect(getSelfUpdateCommand("@earendil-works/pi-coding-agent")).toBeUndefined();
packages/coding-agent/test/config.test.ts:433:		expect(getSelfUpdateUnavailableInstruction("@earendil-works/pi-coding-agent")).toContain(
packages/coding-agent/test/extensions-discovery.test.ts:58:				import { getAgentDir } from "@earendil-works/pi-coding-agent";
packages/coding-agent/test/resource-loader.test.ts:753:import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
packages/coding-agent/test/resource-loader.test.ts:768:import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
packages/coding-agent/test/resource-loader.test.ts:795:import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
packages/coding-agent/test/resource-loader.test.ts:814:import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
packages/coding-agent/test/suite/agent-session-queue.test.ts:3:import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
packages/coding-agent/test/suite/regressions/2023-queued-slash-command-followup.test.ts:3:import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
packages/coding-agent/tsconfig.examples.json:6:			"@earendil-works/pi-coding-agent": ["./src/index.ts"],
packages/coding-agent/tsconfig.examples.json:7:			"@earendil-works/pi-coding-agent/hooks": ["./src/core/hooks/index.ts"],
packages/evals/package.json:12:		"@earendil-works/pi-coding-agent": "^0.82.1",
packages/evals/src/pi-harness.ts:14:} from "@earendil-works/pi-coding-agent";
packages/server/package.json:43:		"@earendil-works/pi-coding-agent": "^0.82.1"
packages/server/src/cli.ts:7:import type { RpcCommand, RpcExtensionUIResponse } from "@earendil-works/pi-coding-agent";
packages/server/src/handler.ts:7:} from "@earendil-works/pi-coding-agent";
packages/server/src/ipc/protocol.ts:7:} from "@earendil-works/pi-coding-agent";
packages/server/src/ipc/server.ts:3:import type { AgentSessionEvent, RpcExtensionUIRequest, RpcResponse } from "@earendil-works/pi-coding-agent";
packages/server/src/radius.ts:3:import { readStoredCredential } from "@earendil-works/pi-coding-agent";
packages/server/src/rpc-process.ts:11:} from "@earendil-works/pi-coding-agent";
packages/server/src/rpc-process.ts:59:			args: [require.resolve("@earendil-works/pi-coding-agent/rpc-entry")],
packages/server/src/supervisor.ts:9:} from "@earendil-works/pi-coding-agent";
scripts/generate-coding-agent-install-lock.mjs:15:const installPackageName = "@earendil-works/pi-coding-agent-install";
scripts/local-release.mjs:13:	{ directory: "packages/coding-agent", name: "@earendil-works/pi-coding-agent" },
scripts/publish.mjs:12:	{ directory: "packages/coding-agent", name: "@earendil-works/pi-coding-agent" },
scripts/sync-versions.test.mjs:36:			name: "@earendil-works/pi-coding-agent",
scripts/sync-versions.test.mjs:44:				"@earendil-works/pi-coding-agent": "^1.0.0",
scripts/sync-versions.test.mjs:53:				"@earendil-works/pi-coding-agent": "^1.0.0",
scripts/sync-versions.test.mjs:61:		assert.equal(evalsManifest.dependencies["@earendil-works/pi-coding-agent"], "^2.0.0");
scripts/sync-versions.test.mjs:64:		assert.equal(generatedManifest.dependencies["@earendil-works/pi-coding-agent"], "^1.0.0");
tsconfig.json:16:			"@earendil-works/pi-coding-agent": ["./packages/coding-agent/src/index.ts"],
tsconfig.json:17:			"@earendil-works/pi-coding-agent/hooks": ["./packages/coding-agent/src/core/hooks/index.ts"],
tsconfig.json:18:			"@earendil-works/pi-coding-agent/*": ["./packages/coding-agent/src/*"],
```
