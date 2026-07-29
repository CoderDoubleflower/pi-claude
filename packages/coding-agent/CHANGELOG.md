# Changelog

## [Unreleased]

### Changed

- Changed interactive built-in and extension tool calls to show a compact command with orange running, green success, and red failure indicators; running output now previews only the latest five visual lines and completed output is hidden.
- Added aligned Claude-style markers: `∴` before thinking content and `❯` before submitted prompts and the live input editor.

### Fixed

- Added a status line when the tool output expansion is toggled ([#7180](https://github.com/earendil-works/pi/issues/7180)).

## [0.82.1] - 2026-07-25

### New Features

- **Claude Opus 5** — Available on Anthropic and Amazon Bedrock with adaptive thinking (including `xhigh`), inference profiles, and prompt caching. See [Providers](docs/providers.md#api-keys).
- **Anthropic gateway bearer auth** — `ANTHROPIC_AUTH_TOKEN` authenticates against Anthropic-compatible gateways that require `Authorization: Bearer`, including compaction and branch summaries. See [Environment Variables or Auth File](docs/providers.md#environment-variables-or-auth-file).
- **Faster, more resilient model catalogs** — pi.dev catalogs revalidate with `If-None-Match` so unchanged providers answer with an empty `304`, and llama.cpp models stay listed across restarts. See [llama.cpp](docs/providers.md#llamacpp).

### Added

- Exposed the `outputPad` setting to custom message renderers. See [Extensions](docs/extensions.md) ([#7045](https://github.com/earendil-works/pi/pull/7045) by [@xl0](https://github.com/xl0)).
- Added inherited `ANTHROPIC_AUTH_TOKEN` bearer authentication for Anthropic-compatible gateways. See [Providers](docs/providers.md#environment-variables-or-auth-file) ([#5871](https://github.com/earendil-works/pi/issues/5871)).
- Added inherited Claude Opus 5 support for Anthropic and Amazon Bedrock with adaptive thinking, inference profiles, prompt caching, and preserved AWS validation messages ([#7081](https://github.com/earendil-works/pi/pull/7081) by [@unexge](https://github.com/unexge), [#7083](https://github.com/earendil-works/pi/pull/7083) by [@davidbrai](https://github.com/davidbrai)).

### Changed

- Changed pi.dev model catalog refreshes to revalidate with `If-None-Match`, so unchanged provider catalogs answer with an empty `304` instead of a full download.
- Changed inherited Radius OAuth device authorization, token exchange, and refresh requests to use the configured gateway directly.
- Changed inherited model loading errors to append the underlying cause, so auth failures such as `OAuth refresh failed for openai-codex` report the provider response instead of a bare wrapper message.

### Fixed

- Fixed compaction and branch summaries for providers whose authentication resolves entirely to request headers ([#5871](https://github.com/earendil-works/pi/issues/5871))
- Fixed unavailable scoped models being hidden from `/models`, allowing them to be removed without editing settings manually ([#6949](https://github.com/earendil-works/pi/issues/6949), [#7032](https://github.com/earendil-works/pi/pull/7032) by [@davidbrai](https://github.com/davidbrai)).
- Fixed startup context file discovery to skip directories that match context file names such as `AGENTS.md`, which produced `EISDIR` warnings ([#7106](https://github.com/earendil-works/pi/pull/7106) by [@mrexodia](https://github.com/mrexodia)).
- Fixed the llama.cpp extension to persist its model catalog, so llama.cpp models stay listed before the first successful refresh. See [llama.cpp](docs/providers.md#llamacpp) ([#7072](https://github.com/earendil-works/pi/pull/7072) by [@davidbrai](https://github.com/davidbrai)).

## [0.82.0] - 2026-07-24

### New Features

- **Constrained tool sampling** — Tools can prefer or require strict JSON Schema sampling or use OpenAI Lark/regex grammars, with model capability metadata preventing unsupported requests. See [Constrained Sampling for Tools](../ai/README.md#constrained-sampling-for-tools).
- **OpenRouter and Kimi Code sign-in** — Use `/login` to authorize OpenRouter or a Kimi Code subscription without manually configuring API keys. See [OpenRouter](docs/providers.md#openrouter).
- **Session-aware, streaming bash integrations** — Bash tools receive current session/model metadata, while direct RPC bash commands stream correlated output. See [Bash Tool Session Environment](docs/environment-variables.md#bash-tool-session-environment) and [RPC bash events](docs/rpc.md#bash_execution_update).

### Added

- Added inherited `Tool.constrainedSampling` with strict JSON Schema (`prefer`/`require`) and OpenAI Lark/regex grammar variants across OpenAI, Anthropic, Amazon Bedrock, Google Gemini, and Mistral. See [Constrained Sampling for Tools](../ai/README.md#constrained-sampling-for-tools).
- Added inherited Kimi Code subscription OAuth login for the Kimi For Coding provider, including device authorization and automatic token refresh ([#6935](https://github.com/earendil-works/pi/pull/6935) by [@zaycray](https://github.com/zaycray)).
- Added inherited OpenRouter OAuth PKCE login through `/login`, minting a user-controlled API key. See [API Keys](docs/providers.md#api-keys) ([#6927](https://github.com/earendil-works/pi/pull/6927) by [@rsaryev](https://github.com/rsaryev)).
- Exposed `PI_SESSION_ID`, `PI_SESSION_FILE`, `PI_PROVIDER`, `PI_MODEL`, and `PI_REASONING_LEVEL` to commands run by built-in and factory-created bash tools. See [Bash Tool Session Environment](docs/environment-variables.md#bash-tool-session-environment).
- Added streaming `bash_execution_update` events for direct RPC bash commands, correlated with request IDs. See [RPC bash events](docs/rpc.md#bash_execution_update) ([#6971](https://github.com/earendil-works/pi/pull/6971) by [@ananthakumaran](https://github.com/ananthakumaran)).

### Changed

- Changed inherited generated model catalogs to expose only provider-verified reasoning effort levels from models.dev ([#6928](https://github.com/earendil-works/pi/pull/6928) by [@davidbrai](https://github.com/davidbrai)).

### Fixed

- Fixed inherited DNS lookup failures such as `getaddrinfo`, `ENOTFOUND`, and `EAI_AGAIN` to trigger automatic assistant retries ([#6946](https://github.com/earendil-works/pi/pull/6946) by [@christianklotz](https://github.com/christianklotz)).
- Fixed inherited OpenRouter Anthropic cache breakpoints to advance through tool results and enabled cache control for `~anthropic/*-latest` aliases ([#6941](https://github.com/earendil-works/pi/pull/6941) by [@mteam88](https://github.com/mteam88)).
- Fixed inherited OpenAI Codex WebSocket sessions to retry once without a missing previous-response continuation after `previous_response_not_found` errors ([#6955](https://github.com/earendil-works/pi/pull/6955) by [@davidbrai](https://github.com/davidbrai)).
- Fixed TUI debug and crash logs to respect custom agent directories instead of always writing under `~/.pi/agent` ([#6958](https://github.com/earendil-works/pi/pull/6958) by [@davidbrai](https://github.com/davidbrai)).
- Fixed slow Ctrl+G external-editor startup when the system temporary directory contains many entries ([#6903](https://github.com/earendil-works/pi/pull/6903) by [@christianklotz](https://github.com/christianklotz)).
- Fixed startup resource display to preserve relative paths for sibling npm extensions loaded by a package ([#6964](https://github.com/earendil-works/pi/pull/6964) by [@davidbrai](https://github.com/davidbrai)).
- Fixed compaction and branch-summary requests to use fresh routing session IDs with prompt caching disabled where supported ([#6618](https://github.com/earendil-works/pi/pull/6618) by [@tmustier](https://github.com/tmustier)).
- Fixed explicit self-updates when `PI_SKIP_VERSION_CHECK` is set ([#6977](https://github.com/earendil-works/pi/issues/6977)).
- Fixed scoped model IDs containing brackets to resolve as literal exact matches before glob matching ([#6210](https://github.com/earendil-works/pi/issues/6210)).
- Fixed inherited OpenAI and Anthropic provider retry waits to honor abort signals and configured delay limits ([#6980](https://github.com/earendil-works/pi/pull/6980) by [@petrroll](https://github.com/petrroll)).
- Fixed fresh installs from preferring bundled model catalogs over newer remote catalogs because package file mtimes were newer ([#7016](https://github.com/earendil-works/pi/pull/7016) by [@davidbrai](https://github.com/davidbrai)).
- Fixed inherited editor scroll indicators overflowing narrow terminals ([#7015](https://github.com/earendil-works/pi/pull/7015) by [@christianklotz](https://github.com/christianklotz)).
- Fixed llama.cpp models to use the loaded context window as their output token limit instead of capping it at 16K ([#7034](https://github.com/earendil-works/pi/pull/7034) by [@christianklotz](https://github.com/christianklotz)).
- Fixed release source archives to include the generated provider model data used to build standalone binaries.
- Updated the packaged `protobufjs` dependency to 7.6.5 to address GHSA-j3f2-48v5-ccww ([#7005](https://github.com/earendil-works/pi/issues/7005)).
- Fixed `/copy` on Wayland to fall back to X11 or OSC 52 when `wl-copy` fails ([#7009](https://github.com/earendil-works/pi/issues/7009)).
- Fixed `/model` to reload updated `models.json` configuration when opening the model picker ([#6999](https://github.com/earendil-works/pi/issues/6999)).

## [0.81.1] - 2026-07-21

### New Features

- **Verifiable release source archives** — GitHub releases now include deterministic, checksummed source archives with instructions for rebuilding standalone binaries. See [Building standalone binaries from release source](../../README.md#building-standalone-binaries-from-release-source).
- **Resilient compaction and branch summaries** — Transient provider failures now follow the configured retry policy, with retry lifecycle events available to interactive, JSON, RPC, and SDK consumers. See [Compaction & Branch Summarization](docs/compaction.md) and [RPC retry events](docs/rpc.md#summarization_retry_scheduled--summarization_retry_attempt_start--summarization_retry_finished).

### Added

- Added Qwen Token Plan and Qwen Token Plan China to built-in provider setup, default model resolution, and provider documentation ([#6858](https://github.com/earendil-works/pi/pull/6858) by [@QuintinShaw](https://github.com/QuintinShaw)).
- Added inherited Kimi Code subscription OAuth login for the Kimi For Coding provider, including device authorization and automatic token refresh ([#6935](https://github.com/earendil-works/pi/pull/6935) by [@zaycray](https://github.com/zaycray)).
- Added inherited OpenRouter OAuth PKCE login through `/login`, minting a user-controlled API key. See [API Keys](docs/providers.md#api-keys) ([#6927](https://github.com/earendil-works/pi/pull/6927) by [@rsaryev](https://github.com/rsaryev)).
- Exposed `PI_SESSION_ID`, `PI_SESSION_FILE`, `PI_PROVIDER`, `PI_MODEL`, and `PI_REASONING_LEVEL` to commands run by built-in and factory-created bash tools. See [Bash Tool Session Environment](docs/environment-variables.md#bash-tool-session-environment).
- Added streaming `bash_execution_update` events for direct RPC bash commands, correlated with request IDs. See [RPC bash events](docs/rpc.md#bash_execution_update) ([#6971](https://github.com/earendil-works/pi/pull/6971) by [@ananthakumaran](https://github.com/ananthakumaran)).

### Fixed

- Updated the packaged `brace-expansion` dependency to 5.0.7 ([#6896](https://github.com/earendil-works/pi/pull/6896) by [@QuintinShaw](https://github.com/QuintinShaw)).
- Fixed persisted remote model catalogs from overriding newer bundled catalogs after an upgrade.
