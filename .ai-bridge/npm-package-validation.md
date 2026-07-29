# npm package validation

- npm ci: 0
- build: 0
- shrinkwrap check: 0
- install-lock check: 0
- npm pack dry run: 0

## npm-ci
```text
npm warn EBADENGINE Unsupported engine {
npm warn EBADENGINE   package: '@earendil-works/gondolin@0.12.0',
npm warn EBADENGINE   required: { node: '>=23.6.0' },
npm warn EBADENGINE   current: { node: 'v22.19.0', npm: '10.9.3' }
npm warn EBADENGINE }
npm warn deprecated prebuild-install@7.1.3: No longer maintained. Please contact the author of the relevant native addon; alternatives are available.
npm warn deprecated node-domexception@1.0.0: Use your platform's native DOMException instead

added 333 packages, and audited 347 packages in 8s

56 packages are looking for funding
  run `npm fund` for details

3 high severity vulnerabilities

To address all issues, run:
  npm audit fix

Run `npm audit` for details.
```

## build
```text

> pi-monorepo@0.0.3 build
> cd packages/tui && npm run build && cd ../ai && npm run build && cd ../agent && npm run build && cd ../storage/sqlite-node && npm run build && cd ../../coding-agent && npm run build && cd ../server && npm run build


> @earendil-works/pi-tui@0.82.1 build
> tsgo -p tsconfig.build.json


> @earendil-works/pi-ai@0.82.1 build
> npm run generate-models && npm run build:offline


> @earendil-works/pi-ai@0.82.1 generate-models
> node scripts/generate-models.ts --strict

Fetching models from models.dev API...
Fetching models from NVIDIA NIM API...
Fetched 102 model IDs from NVIDIA NIM
Loaded 616 tool-capable models from models.dev
Fetching models from OpenRouter API...
Fetched 301 tool-capable models from OpenRouter
Fetching models from Vercel AI Gateway API...
Fetched 193 tool-capable models from Vercel AI Gateway
Generated provider catalogs and src/models.generated.ts
Generated JSON model values under src/providers/data/

Model Statistics:
  Total tool-capable models: 1153
  Reasoning-capable models: 897
  amazon-bedrock: 114 models
  anthropic: 15 models
  google: 24 models
  google-vertex: 12 models
  openai: 38 models
  groq: 7 models
  cerebras: 3 models
  cloudflare-workers-ai: 13 models
  cloudflare-ai-gateway: 43 models
  xai: 3 models
  zai: 6 models
  zai-coding-cn: 6 models
  mistral: 30 models
  huggingface: 51 models
  fireworks: 16 models
  nvidia: 30 models
  together: 17 models
  opencode: 59 models
  opencode-go: 16 models
  github-copilot: 29 models
  minimax: 3 models
  minimax-cn: 3 models
  kimi-coding: 4 models
  moonshotai: 10 models
  moonshotai-cn: 10 models
  xiaomi: 6 models
  xiaomi-token-plan-cn: 3 models
  xiaomi-token-plan-ams: 3 models
  xiaomi-token-plan-sgp: 3 models
  qwen-token-plan: 15 models
  qwen-token-plan-cn: 15 models
  openrouter: 303 models
  vercel-ai-gateway: 193 models
  deepseek: 2 models
  ant-ling: 3 models
  openai-codex: 7 models
  azure-openai-responses: 38 models

> @earendil-works/pi-ai@0.82.1 build:offline
> npm run check:model-data && tsgo -p tsconfig.build.json && shx rm -rf dist/providers/data && shx cp -r src/providers/data dist/providers/data


> @earendil-works/pi-ai@0.82.1 check:model-data
> node scripts/check-model-data.ts

Generated model data is valid.

> @earendil-works/pi-agent-core@0.82.1 build
> tsgo -p tsconfig.build.json


> @earendil-works/pi-storage-sqlite-node@0.82.1 build
> tsgo -p tsconfig.build.json && node ./scripts/prepare-dist.mjs copy-sqlite-migrations


> @coderdoubleflower/pi-claude@0.82.1 build
> tsgo -p tsconfig.build.json && shx chmod +x dist/cli.js dist/rpc-entry.js && npm run copy-assets


> @coderdoubleflower/pi-claude@0.82.1 copy-assets
> shx mkdir -p dist/modes/interactive/theme && shx cp src/modes/interactive/theme/*.json dist/modes/interactive/theme/ && shx mkdir -p dist/modes/interactive/assets && shx cp src/modes/interactive/assets/*.png dist/modes/interactive/assets/ && shx mkdir -p dist/core/export-html/vendor && shx cp src/core/export-html/template.html src/core/export-html/template.css src/core/export-html/template.js dist/core/export-html/ && shx cp src/core/export-html/vendor/*.js dist/core/export-html/vendor/


> @earendil-works/pi-server@0.82.1 build
> tsgo -p tsconfig.build.json && shx chmod +x dist/cli.js

```

## shrinkwrap
```text

> pi-monorepo@0.0.3 check:shrinkwrap
> node scripts/generate-coding-agent-shrinkwrap.mjs --check

packages/coding-agent/npm-shrinkwrap.json is up to date.
```

## install-lock
```text

> pi-monorepo@0.0.3 check:install-lock:coding-agent
> node scripts/generate-coding-agent-install-lock.mjs --check

packages/coding-agent/install-lock is up to date.
```

## pack
```text
npm notice 3.4kB examples/extensions/doom-overlay/doom/build.sh
npm notice 64.6kB examples/extensions/doom-overlay/doom/build/doom.js
npm notice 380.2kB examples/extensions/doom-overlay/doom/build/doom.wasm
npm notice 1.7kB examples/extensions/doom-overlay/doom/doomgeneric_pi.c
npm notice 2.1kB examples/extensions/doom-overlay/index.ts
npm notice 1.3kB examples/extensions/doom-overlay/README.md
npm notice 1.6kB examples/extensions/doom-overlay/wad-finder.ts
npm notice 2.0kB examples/extensions/dynamic-resources/dynamic.json
npm notice 160B examples/extensions/dynamic-resources/dynamic.md
npm notice 454B examples/extensions/dynamic-resources/index.ts
npm notice 177B examples/extensions/dynamic-resources/SKILL.md
npm notice 2.2kB examples/extensions/dynamic-tools.ts
npm notice 1.3kB examples/extensions/entry-renderer.ts
npm notice 1.3kB examples/extensions/event-bus.ts
npm notice 1.0kB examples/extensions/file-trigger.ts
npm notice 1.5kB examples/extensions/git-checkpoint.ts
npm notice 4.1kB examples/extensions/git-merge-and-resolve.ts
npm notice 5.3kB examples/extensions/github-issue-autocomplete.ts
npm notice 16.6kB examples/extensions/gondolin/index.ts
npm notice 6.0kB examples/extensions/gondolin/package-lock.json
npm notice 340B examples/extensions/gondolin/package.json
npm notice 6.3kB examples/extensions/handoff.ts
npm notice 637B examples/extensions/hello.ts
npm notice 1.4kB examples/extensions/hidden-thinking-label.ts
npm notice 3.0kB examples/extensions/inline-bash.ts
npm notice 1.2kB examples/extensions/input-transform-streaming.ts
npm notice 1.4kB examples/extensions/input-transform.ts
npm notice 4.8kB examples/extensions/interactive-shell.ts
npm notice 1.8kB examples/extensions/kimi-deferred-tools.ts
npm notice 1.2kB examples/extensions/mac-system-theme.ts
npm notice 1.9kB examples/extensions/message-renderer.ts
npm notice 13.9kB examples/extensions/minimal-mode.ts
npm notice 2.4kB examples/extensions/modal-editor.ts
npm notice 954B examples/extensions/model-status.ts
npm notice 1.9kB examples/extensions/notify.ts
npm notice 46.1kB examples/extensions/overlay-qa-tests.ts
npm notice 5.5kB examples/extensions/overlay-test.ts
npm notice 1.0kB examples/extensions/permission-gate.ts
npm notice 1.5kB examples/extensions/pirate.ts
npm notice 12.1kB examples/extensions/plan-mode/index.ts
npm notice 2.0kB examples/extensions/plan-mode/README.md
npm notice 4.1kB examples/extensions/plan-mode/utils.ts
npm notice 14.4kB examples/extensions/preset.ts
npm notice 2.1kB examples/extensions/project-trust.ts
npm notice 3.1kB examples/extensions/prompt-customizer.ts
npm notice 805B examples/extensions/protected-paths.ts
npm notice 761B examples/extensions/provider-payload.ts
npm notice 3.8kB examples/extensions/qna.ts
npm notice 8.5kB examples/extensions/question.ts
npm notice 13.6kB examples/extensions/questionnaire.ts
npm notice 2.4kB examples/extensions/rainbow-editor.ts
npm notice 10.0kB examples/extensions/README.md
npm notice 1.2kB examples/extensions/reload-runtime.ts
npm notice 3.6kB examples/extensions/rpc-demo.ts
npm notice 9.0kB examples/extensions/sandbox/index.ts
npm notice 3.1kB examples/extensions/sandbox/package-lock.json
npm notice 344B examples/extensions/sandbox/package.json
npm notice 2.8kB examples/extensions/send-user-message.ts
npm notice 782B examples/extensions/session-name.ts
npm notice 2.0kB examples/extensions/shutdown-command.ts
npm notice 9.4kB examples/extensions/snake.ts
npm notice 15.2kB examples/extensions/space-invaders.ts
npm notice 7.3kB examples/extensions/ssh.ts
npm notice 934B examples/extensions/status-line.ts
npm notice 2.2kB examples/extensions/structured-output.ts
npm notice 3.4kB examples/extensions/subagent/agents.ts
npm notice 896B examples/extensions/subagent/agents/planner.md
npm notice 933B examples/extensions/subagent/agents/reviewer.md
npm notice 1.3kB examples/extensions/subagent/agents/scout.md
npm notice 664B examples/extensions/subagent/agents/worker.md
npm notice 35.1kB examples/extensions/subagent/index.ts
npm notice 494B examples/extensions/subagent/prompts/implement-and-review.md
npm notice 579B examples/extensions/subagent/prompts/implement.md
npm notice 496B examples/extensions/subagent/prompts/scout-and-plan.md
npm notice 6.1kB examples/extensions/subagent/README.md
npm notice 5.3kB examples/extensions/summarize.ts
npm notice 525B examples/extensions/system-prompt-header.ts
npm notice 35.4kB examples/extensions/tic-tac-toe.ts
npm notice 2.2kB examples/extensions/timed-confirm.ts
npm notice 1.6kB examples/extensions/titlebar-spinner.ts
npm notice 8.8kB examples/extensions/todo.ts
npm notice 4.8kB examples/extensions/tool-override.ts
npm notice 3.9kB examples/extensions/tools.ts
npm notice 1.3kB examples/extensions/trigger-compact.ts
npm notice 6.5kB examples/extensions/truncated-tool.ts
npm notice 364B examples/extensions/widget-placement.ts
npm notice 1.0kB examples/extensions/with-deps/index.ts
npm notice 894B examples/extensions/with-deps/package-lock.json
npm notice 396B examples/extensions/with-deps/package.json
npm notice 3.4kB examples/extensions/working-indicator.ts
npm notice 901B examples/extensions/working-message-test.ts
npm notice 906B examples/README.md
npm notice 16.7kB examples/rpc-extension-ui.ts
npm notice 686B examples/sdk/01-minimal.ts
npm notice 1.4kB examples/sdk/02-custom-model.ts
npm notice 1.9kB examples/sdk/03-custom-prompt.ts
npm notice 1.4kB examples/sdk/04-skills.ts
npm notice 1.6kB examples/sdk/05-tools.ts
npm notice 2.7kB examples/sdk/06-extensions.ts
npm notice 1.2kB examples/sdk/07-context-files.ts
npm notice 1.4kB examples/sdk/08-prompt-templates.ts
npm notice 1.1kB examples/sdk/09-api-keys-and-oauth.ts
npm notice 1.7kB examples/sdk/10-settings.ts
npm notice 1.8kB examples/sdk/11-sessions.ts
npm notice 1.9kB examples/sdk/12-full-control.ts
npm notice 1.9kB examples/sdk/13-session-runtime.ts
npm notice 4.7kB examples/sdk/README.md
npm notice 61.5kB npm-shrinkwrap.json
npm notice 3.9kB package.json
npm notice Tarball Details
npm notice name: @coderdoubleflower/pi-claude
npm notice version: 0.82.1
npm notice filename: coderdoubleflower-pi-claude-0.82.1.tgz
npm notice package size: 5.0 MB
npm notice unpacked size: 13.1 MB
npm notice shasum: a03dd8420b3f7fc126f1a096c8b8ae6cd24d2dfd
npm notice integrity: sha512-W+VZrfVCKWPiT[...]xj36N9JBWuAAQ==
npm notice total files: 884
npm notice
coderdoubleflower-pi-claude-0.82.1.tgz
```

