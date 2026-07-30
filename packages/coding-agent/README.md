<p align="center">
  <a href="https://github.com/CoderDoubleflower/pi-claude">
    <img alt="Pi logo" src="https://pi.dev/logo-auto.svg" width="128">
  </a>
</p>

<h1 align="center">@doubleflower/pi-claude</h1>

<p align="center">
  <strong>A Claude Code-styled coding-agent CLI built on Pi.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@doubleflower/pi-claude"><img alt="npm" src="https://img.shields.io/npm/v/@doubleflower/pi-claude?style=flat-square" /></a>
  <a href="https://github.com/CoderDoubleflower/pi-claude/blob/main/LICENSE"><img alt="License" src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" /></a>
</p>

> [!IMPORTANT]
> This package is an independent fork of [Pi](https://github.com/earendil-works/pi). It is not affiliated with Anthropic. The goal is to move most of Pi's interactive terminal UI toward the visual style and interaction feel of Claude Code while preserving Pi's extensibility and model-provider support.

## What this package is

`@doubleflower/pi-claude` provides the `pi-claude` terminal coding-agent command. It keeps Pi's agent runtime, tools, sessions, extensions, and provider integrations, then progressively replaces the interactive presentation with a denser Claude Code-style interface.

The project focuses on UI and interaction design. It does not reproduce Claude Code's proprietary backend, hosted services, or internal implementation.

## UI migration status

The migration is active and incomplete. The following work is already implemented in the published package:

| Area | Current behavior |
|---|---|
| Tool calls | Built-in and extension tools render as compact command-oriented rows |
| Tool state | A leading `●` is orange while running, green on success, and red on failure |
| Running output | Only the latest five visual lines are previewed to reduce terminal noise |
| Completed output | Tool output is collapsed by default instead of occupying a permanent result panel |
| Tool background | Tool rows use the terminal background rather than colored success/error blocks |
| Assistant responses | The first formal response block receives a themeable `●` marker aligned with tool markers |
| User prompts | The prompt background follows the actual rendered prompt height, including wrapping |
| Transcript density | Extra vertical spacing between messages and tool calls has been reduced |
| Themes | Dark/light themes and custom-theme schema support assistant and tool-state colors |

Theme authors can optionally define:

- `assistantMarker`
- `toolRunning`
- `toolSuccess`
- `toolError`

Older themes remain compatible because each token has a fallback.

The remaining interactive surfaces are being migrated incrementally. The current version should be treated as a work in progress rather than a complete one-to-one Claude Code replica.

## Installation

Requires Node.js **22.19.0 or newer**.

```bash
npm install -g --ignore-scripts @doubleflower/pi-claude
```

Then start the interactive agent:

```bash
pi-claude
```

`--ignore-scripts` disables dependency lifecycle scripts during installation. This package does not require install scripts for normal npm usage.

To update an existing installation:

```bash
npm install -g --ignore-scripts @doubleflower/pi-claude@latest
```

## Authentication

Use `/login` inside the interactive CLI, or configure a provider API key before launch. For example:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
pi-claude
```

Pi's multi-provider model layer is retained, so the fork can also use supported OpenAI, Google, OpenRouter, Bedrock, local, and other configured providers.

## Core capabilities

The package inherits Pi's main coding-agent features:

- Read, bash, edit, and write tools
- Streaming interactive terminal UI
- Optional alternate-screen TUI with application-owned scrolling via `pi-claude --alt`
- Persistent sessions with resume, branching, and compaction
- Multi-provider model selection
- Project and user context files
- TypeScript extensions and custom tools
- Skills and prompt templates
- Installable packages and themes
- Interactive, print/JSON, RPC, and SDK modes
- HTML session export

Useful interactive commands include `/login`, `/model`, `/resume`, `/tree`, `/settings`, and `/help`.

## Configuration and compatibility

Configuration, sessions, extensions, skills, prompts, and themes continue to use Pi's `~/.pi` directory. This lets existing Pi setups remain usable while the UI fork evolves.

Because `pi-claude` tracks upstream Pi, most Pi workflows and resources should continue to work. Fork-specific changes are concentrated in the coding-agent package, interactive components, themes, package identity, and release pipeline.

## Customization

Pi's customization model is intentionally preserved:

- **Extensions** add tools, commands, event hooks, and UI components.
- **Skills** provide reusable instructions and workflows.
- **Prompt templates** create reusable prompts.
- **Themes** control terminal colors, including the additional Claude-style marker colors.
- **Pi packages** bundle and distribute extensions, skills, prompts, and themes through npm or Git.

See the package documentation for the complete APIs and examples.

## Documentation

- [Coding-agent documentation](https://github.com/CoderDoubleflower/pi-claude/tree/main/packages/coding-agent/docs)
- [Examples](https://github.com/CoderDoubleflower/pi-claude/tree/main/packages/coding-agent/examples)
- [Theme documentation](https://github.com/CoderDoubleflower/pi-claude/blob/main/packages/coding-agent/docs/themes.md)
- [Containerization and sandboxing](https://github.com/CoderDoubleflower/pi-claude/blob/main/packages/coding-agent/docs/containerization.md)
- [Repository overview and UI progress](https://github.com/CoderDoubleflower/pi-claude#readme)
- [Issue tracker](https://github.com/CoderDoubleflower/pi-claude/issues)

## Permissions and sandboxing

`pi-claude` runs tools with the permissions of the user and process that launched it. It does not include a built-in filesystem, process, network, or credential permission boundary.

Review requested operations before allowing them to affect important files or systems. For stronger isolation, run the agent inside a container, micro-VM, or policy-controlled sandbox.

## Development

From the repository root:

```bash
npm install --ignore-scripts
npm run build
npm run check
./test.sh
```

To work on this package directly:

```bash
cd packages/coding-agent
npm run build
npm test
```

## Upstream and attribution

This package is derived from Pi by Mario Zechner and the `earendil-works/pi` contributors. Upstream authors and contributors remain credited in package metadata and repository history.

Claude Code is a product of Anthropic. References to Claude Code describe the UI and interaction style this independent project is attempting to approximate.

## License

MIT
