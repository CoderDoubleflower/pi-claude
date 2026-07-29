<p align="center">
  <a href="https://github.com/CoderDoubleflower/pi-claude">
    <img alt="Pi logo" src="https://pi.dev/logo-auto.svg" width="128">
  </a>
</p>

<h1 align="center">pi-claude</h1>

<p align="center">
  <strong>A Claude Code-styled terminal coding agent built on Pi.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@doubleflower/pi-claude"><img alt="npm" src="https://img.shields.io/npm/v/@doubleflower/pi-claude?style=flat-square" /></a>
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" /></a>
</p>

> [!IMPORTANT]
> `pi-claude` is an independent fork of [Pi](https://github.com/earendil-works/pi). It is not affiliated with Anthropic. The project aims to reproduce the visual language and interaction feel of Claude Code while retaining Pi's runtime, provider support, and extension system.

## What is pi-claude?

`pi-claude` is a fork of the Pi coding-agent monorepo. Its main goal is to progressively restyle **most of Pi's interactive terminal UI** so the conversation, tool execution, input, spacing, and status presentation feel much closer to Claude Code.

The project deliberately keeps the parts of Pi that already work well:

- Multi-provider model support
- Read, bash, edit, and write tools
- Persistent sessions, branching, and compaction
- Extensions, skills, prompt templates, themes, and packages
- Interactive, print/JSON, RPC, and SDK usage modes

This is a UI-focused fork, not a reimplementation of Claude Code's proprietary runtime or services.

## Project goal

The long-term target is to make the majority of the interactive experience use a consistent Claude Code-style design language, including:

- Conversation hierarchy and message markers
- Tool call rows, statuses, previews, and expansion behavior
- User prompt and editor presentation
- Message density, indentation, and alignment
- Selectors, dialogs, session views, and other interactive surfaces
- Dark/light themes and custom-theme compatibility

Visual parity is being implemented incrementally. The current release is **not yet a complete one-to-one replica**.

## Current progress

### Completed

- **Independent distribution** — published as [`@doubleflower/pi-claude`](https://www.npmjs.com/package/@doubleflower/pi-claude) with the `pi-claude` CLI.
- **Compact tool calls** — built-in and extension tools use a concise command-oriented row instead of a large result panel.
- **Tool status markers** — the leading `●` is orange while running, green on success, and red on failure.
- **Reduced tool noise** — running tools preview only the latest five visual output lines; completed output is collapsed by default.
- **Background-free tool rows** — tool execution lines use the terminal background rather than success/error background blocks.
- **Assistant response marker** — the first formal text block in each assistant response is prefixed with a themeable `●` marker and aligned with tool markers.
- **Prompt-height background** — the user prompt background follows the prompt's actual rendered height, including wrapped lines.
- **Denser transcript spacing** — vertical padding between user messages, assistant responses, and tool calls has been reduced.
- **Theme support** — added optional `assistantMarker`, `toolRunning`, `toolSuccess`, and `toolError` color tokens with backward-compatible fallbacks; built-in dark and light themes are updated.
- **Automated npm releases** — the fork has its own release and publishing workflow.
- **Upstream synchronization** — upstream Pi improvements can continue to be merged while preserving fork-specific UI changes.

### Still in progress

- Migrating the remaining interactive surfaces to the same visual system
- Refining spacing and alignment across terminal widths and renderers
- Expanding visual regression coverage for built-in and extension-rendered tools
- Closing smaller behavioral and styling differences from Claude Code

## Quick start

Requirements: Node.js **22.19.0 or newer**.

```bash
npm install -g --ignore-scripts @doubleflower/pi-claude
pi-claude
```

`--ignore-scripts` disables dependency lifecycle scripts during installation. The package does not require install scripts for normal npm usage.

Authenticate with `/login` inside the CLI or set a provider API key, for example:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
pi-claude
```

Configuration and sessions continue to use Pi's `~/.pi` directory so existing Pi workflows can be reused.

## Monorepo packages

| Package | Description |
|---|---|
| **[@doubleflower/pi-claude](packages/coding-agent)** | Claude Code-styled interactive coding-agent CLI |
| **[@earendil-works/pi-agent-core](packages/agent)** | Agent runtime, tool calling, and state management |
| **[@earendil-works/pi-ai](packages/ai)** | Unified multi-provider LLM API |
| **[@earendil-works/pi-tui](packages/tui)** | Differential-rendering terminal UI library |

## Development

```bash
npm install --ignore-scripts
npm run build
npm run build:offline
npm run check
./test.sh
./pi-test.sh
```

The coding-agent package can also be built and tested directly:

```bash
cd packages/coding-agent
npm run build
npm test
```

## Permissions and sandboxing

`pi-claude`, like upstream Pi, runs tools with the permissions of the user and process that launched it. It does not provide a built-in filesystem, process, network, or credential permission boundary.

For stronger isolation, use a container or sandbox. See [the containerization guide](packages/coding-agent/docs/containerization.md).

## Upstream and attribution

This repository is derived from [earendil-works/pi](https://github.com/earendil-works/pi) and continues to incorporate upstream work. The original Pi authors and contributors remain credited in the package metadata and repository history.

Claude Code is a product of Anthropic. References to Claude Code describe the UI and interaction style this independent project is trying to approximate.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines and [AGENTS.md](AGENTS.md) for repository-specific instructions.

Issues and pull requests that improve Claude Code-style UI parity, terminal compatibility, tests, or upstream synchronization are welcome.

## License

MIT
