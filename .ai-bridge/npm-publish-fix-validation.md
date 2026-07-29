# npm publish fix validation

## npm-latest
```text

removed 8 packages, and changed 77 packages in 3s

15 packages are looking for funding
  run `npm fund` for details
```
Exit code: 0

## prepare
```text
0.82.2
```
Exit code: 0

## refresh-lock
```text

up to date, audited 347 packages in 918ms

56 packages are looking for funding
  run `npm fund` for details

3 high severity vulnerabilities

To address all issues, run:
  npm audit fix

Run `npm audit` for details.
```
Exit code: 0

## shrinkwrap
```text
Wrote packages/coding-agent/npm-shrinkwrap.json (139 packages, 10 platform-specific).
```
Exit code: 0

## install-lock
```text
Wrote packages/coding-agent/install-lock/package.json and package-lock.json (140 packages, 10 platform-specific).
```
Exit code: 0

## npm-ci
```text
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
Exit code: 0

## hydrate-model-data
```text
npm notice run pi-monorepo@0.0.3 hydrate:model-data
npm notice run npm --prefix packages/ai run hydrate-model-data
npm notice run @earendil-works/pi-ai@0.82.1 hydrate-model-data
npm notice run node scripts/generate-models.ts --strict --data-only
Fetching models from models.dev API...
Fetching models from NVIDIA NIM API...
Fetched 102 model IDs from NVIDIA NIM
Loaded 616 tool-capable models from models.dev
Fetching models from OpenRouter API...
Fetched 301 tool-capable models from OpenRouter
Fetching models from Vercel AI Gateway API...
Fetched 193 tool-capable models from Vercel AI Gateway
Hydrated JSON model values under src/providers/data/

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
```
Exit code: 0

## build
```text
npm notice run pi-monorepo@0.0.3 build:offline
npm notice run cd packages/tui && npm run build && cd ../ai && npm run build:offline && cd ../agent && npm run build && cd ../storage/sqlite-node && npm run build && cd ../../coding-agent && npm run build && cd ../server && npm run build
npm notice run @earendil-works/pi-tui@0.82.1 build
npm notice run tsgo -p tsconfig.build.json
npm notice run @earendil-works/pi-ai@0.82.1 build:offline
npm notice run npm run check:model-data && tsgo -p tsconfig.build.json && shx rm -rf dist/providers/data && shx cp -r src/providers/data dist/providers/data
npm notice run @earendil-works/pi-ai@0.82.1 check:model-data
npm notice run node scripts/check-model-data.ts
Generated model data is valid.
npm notice run @earendil-works/pi-agent-core@0.82.1 build
npm notice run tsgo -p tsconfig.build.json
npm notice run @earendil-works/pi-storage-sqlite-node@0.82.1 build
npm notice run tsgo -p tsconfig.build.json && node ./scripts/prepare-dist.mjs copy-sqlite-migrations
npm notice run @doubleflower/pi-claude@0.82.2 build
npm notice run tsgo -p tsconfig.build.json && shx chmod +x dist/cli.js dist/rpc-entry.js && npm run copy-assets
npm notice run @doubleflower/pi-claude@0.82.2 copy-assets
npm notice run shx mkdir -p dist/modes/interactive/theme && shx cp src/modes/interactive/theme/*.json dist/modes/interactive/theme/ && shx mkdir -p dist/modes/interactive/assets && shx cp src/modes/interactive/assets/*.png dist/modes/interactive/assets/ && shx mkdir -p dist/core/export-html/vendor && shx cp src/core/export-html/template.html src/core/export-html/template.css src/core/export-html/template.js dist/core/export-html/ && shx cp src/core/export-html/vendor/*.js dist/core/export-html/vendor/
npm notice run @earendil-works/pi-server@0.82.1 build
npm notice run tsgo -p tsconfig.build.json && shx chmod +x dist/cli.js
```
Exit code: 0

## tests
```text

[41m[1m FAIL [22m[49m test/tools.test.ts[2m > [22mCoding Agent Tools[2m > [22mfind tool[2m > [22mshould surface fd glob parse errors
[31m[1mAssertionError[22m: expected [Function] to throw error matching /error parsing glob|fd exited with co…/i but got 'fd is not available and could not be …'[39m

[32m- Expected:[39m
/error parsing glob|fd exited with code 1|fd error/i

[31m+ Received:[39m
"fd is not available and could not be downloaded"

[36m [2m❯[22m test/tools.test.ts:[2m867:4[22m[39m
    [90m865|[39m      path[33m:[39m testDir[33m,[39m
    [90m866|[39m     })[33m,[39m
    [90m867|[39m    ).rejects.toThrow(/error parsing glob|fd exited with code 1|fd erro…
    [90m   |[39m    [31m^[39m
    [90m868|[39m   })[33m;[39m
    [90m869|[39m

[31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[4/14]⎯[22m[39m

[41m[1m FAIL [22m[49m test/suite/regressions/3302-find-path-glob.test.ts[2m > [22missue #3302 find returns no results for path-based glob patterns[2m > [22mbasename pattern still matches (regression-safe)
[41m[1m FAIL [22m[49m test/suite/regressions/3302-find-path-glob.test.ts[2m > [22missue #3302 find returns no results for path-based glob patterns[2m > [22mdirectory-prefixed pattern with ** tail matches subtree
[41m[1m FAIL [22m[49m test/suite/regressions/3302-find-path-glob.test.ts[2m > [22missue #3302 find returns no results for path-based glob patterns[2m > [22mleading ** wildcard with path segments matches
[41m[1m FAIL [22m[49m test/suite/regressions/3302-find-path-glob.test.ts[2m > [22missue #3302 find returns no results for path-based glob patterns[2m > [22msrc/**/*.spec.ts matches nested spec file
[41m[1m FAIL [22m[49m test/suite/regressions/3303-find-nested-gitignore.test.ts[2m > [22missue #3303 nested .gitignore rules leak into sibling directories[2m > [22mflat sibling case[2m > [22mapplies a/.gitignore only inside a/ and leaves b/ untouched
[41m[1m FAIL [22m[49m test/suite/regressions/3303-find-nested-gitignore.test.ts[2m > [22missue #3303 nested .gitignore rules leak into sibling directories[2m > [22mdeeply nested case[2m > [22mscopes each .gitignore to its own subtree
[31m[1mError[22m: fd is not available and could not be downloaded[39m
[36m [2m❯[22m src/core/tools/find.ts:[2m220:28[22m[39m
    [90m218|[39m       }
    [90m219|[39m       [35mif[39m ([33m![39mfdPath) {
    [90m220|[39m        settle(() => reject(new Error("fd is not available and could no…
    [90m   |[39m                            [31m^[39m
    [90m221|[39m        [35mreturn[39m[33m;[39m
    [90m222|[39m       }
[90m [2m❯[22m settle src/core/tools/find.ts:[2m140:6[22m[39m
[90m [2m❯[22m src/core/tools/find.ts:[2m220:8[22m[39m

[31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[5/14]⎯[22m[39m


[2m Test Files [22m [1m[31m4 failed[39m[22m[2m | [22m[1m[32m177 passed[39m[22m[2m | [22m[33m6 skipped[39m[90m (187)[39m
[2m      Tests [22m [1m[31m14 failed[39m[22m[2m | [22m[1m[32m1633 passed[39m[22m[2m | [22m[33m48 skipped[39m[90m (1695)[39m
[2m   Start at [22m 03:38:39
[2m   Duration [22m 81.07s[2m (transform 7.24s, setup 0ms, import 143.55s, tests 67.60s, environment 28ms)[22m


::error file=/home/runner/work/pi-claude/pi-claude/packages/coding-agent/test/first-time-setup.test.ts,title=test/first-time-setup.test.ts > shouldRunFirstTimeSetup > returns true when experimental%2C default agent dir%2C and no settings.json,line=37,column=49::AssertionError: expected false to be true // Object.is equality%0A%0A- Expected%0A+ Received%0A%0A- true%0A+ false%0A%0A ❯ test/first-time-setup.test.ts:37:49%0A%0A

::error file=/home/runner/work/pi-claude/pi-claude/packages/coding-agent/src/core/tools/grep.ts,title=test/tools.test.ts > Coding Agent Tools > grep tool > should include filename when searching a single file,line=174,column=28::Error: ripgrep (rg) is not available and could not be downloaded%0A ❯ src/core/tools/grep.ts:174:28%0A ❯ settle src/core/tools/grep.ts:166:7%0A ❯ src/core/tools/grep.ts:174:8%0A%0A

::error file=/home/runner/work/pi-claude/pi-claude/packages/coding-agent/src/core/tools/grep.ts,title=test/tools.test.ts > Coding Agent Tools > grep tool > should respect global limit and include context lines,line=174,column=28::Error: ripgrep (rg) is not available and could not be downloaded%0A ❯ src/core/tools/grep.ts:174:28%0A ❯ settle src/core/tools/grep.ts:166:7%0A ❯ src/core/tools/grep.ts:174:8%0A%0A

::error file=/home/runner/work/pi-claude/pi-claude/packages/coding-agent/src/core/tools/grep.ts,title=test/tools.test.ts > Coding Agent Tools > grep tool > should treat flag-like patterns as search text,line=174,column=28::Error: ripgrep (rg) is not available and could not be downloaded%0A ❯ src/core/tools/grep.ts:174:28%0A ❯ settle src/core/tools/grep.ts:166:7%0A ❯ src/core/tools/grep.ts:174:8%0A%0A

::error file=/home/runner/work/pi-claude/pi-claude/packages/coding-agent/src/core/tools/find.ts,title=test/tools.test.ts > Coding Agent Tools > find tool > should include hidden files that are not gitignored,line=220,column=28::Error: fd is not available and could not be downloaded%0A ❯ src/core/tools/find.ts:220:28%0A ❯ settle src/core/tools/find.ts:140:6%0A ❯ src/core/tools/find.ts:220:8%0A%0A

::error file=/home/runner/work/pi-claude/pi-claude/packages/coding-agent/src/core/tools/find.ts,title=test/tools.test.ts > Coding Agent Tools > find tool > should respect .gitignore,line=220,column=28::Error: fd is not available and could not be downloaded%0A ❯ src/core/tools/find.ts:220:28%0A ❯ settle src/core/tools/find.ts:140:6%0A ❯ src/core/tools/find.ts:220:8%0A%0A

::error file=/home/runner/work/pi-claude/pi-claude/packages/coding-agent/test/tools.test.ts,title=test/tools.test.ts > Coding Agent Tools > find tool > should surface fd glob parse errors,line=867,column=4::AssertionError: expected [Function] to throw error matching /error parsing glob|fd exited with co…/i but got 'fd is not available and could not be …'%0A%0A- Expected:%0A/error parsing glob|fd exited with code 1|fd error/i%0A%0A+ Received:%0A"fd is not available and could not be downloaded"%0A%0A ❯ test/tools.test.ts:867:4%0A%0A

::error file=/home/runner/work/pi-claude/pi-claude/packages/coding-agent/src/core/tools/find.ts,title=test/tools.test.ts > Coding Agent Tools > find tool > should treat flag-like patterns as search text,line=220,column=28::Error: fd is not available and could not be downloaded%0A ❯ src/core/tools/find.ts:220:28%0A ❯ settle src/core/tools/find.ts:140:6%0A ❯ src/core/tools/find.ts:220:8%0A%0A

::error file=/home/runner/work/pi-claude/pi-claude/packages/coding-agent/src/core/tools/find.ts,title=test/suite/regressions/3302-find-path-glob.test.ts > issue #3302 find returns no results for path-based glob patterns > basename pattern still matches (regression-safe),line=220,column=28::Error: fd is not available and could not be downloaded%0A ❯ src/core/tools/find.ts:220:28%0A ❯ settle src/core/tools/find.ts:140:6%0A ❯ src/core/tools/find.ts:220:8%0A%0A

::error file=/home/runner/work/pi-claude/pi-claude/packages/coding-agent/src/core/tools/find.ts,title=test/suite/regressions/3302-find-path-glob.test.ts > issue #3302 find returns no results for path-based glob patterns > directory-prefixed pattern with ** tail matches subtree,line=220,column=28::Error: fd is not available and could not be downloaded%0A ❯ src/core/tools/find.ts:220:28%0A ❯ settle src/core/tools/find.ts:140:6%0A ❯ src/core/tools/find.ts:220:8%0A%0A

::error file=/home/runner/work/pi-claude/pi-claude/packages/coding-agent/src/core/tools/find.ts,title=test/suite/regressions/3302-find-path-glob.test.ts > issue #3302 find returns no results for path-based glob patterns > leading ** wildcard with path segments matches,line=220,column=28::Error: fd is not available and could not be downloaded%0A ❯ src/core/tools/find.ts:220:28%0A ❯ settle src/core/tools/find.ts:140:6%0A ❯ src/core/tools/find.ts:220:8%0A%0A

::error file=/home/runner/work/pi-claude/pi-claude/packages/coding-agent/src/core/tools/find.ts,title=test/suite/regressions/3302-find-path-glob.test.ts > issue #3302 find returns no results for path-based glob patterns > src/**/*.spec.ts matches nested spec file,line=220,column=28::Error: fd is not available and could not be downloaded%0A ❯ src/core/tools/find.ts:220:28%0A ❯ settle src/core/tools/find.ts:140:6%0A ❯ src/core/tools/find.ts:220:8%0A%0A

::error file=/home/runner/work/pi-claude/pi-claude/packages/coding-agent/src/core/tools/find.ts,title=test/suite/regressions/3303-find-nested-gitignore.test.ts > issue #3303 nested .gitignore rules leak into sibling directories > flat sibling case > applies a/.gitignore only inside a/ and leaves b/ untouched,line=220,column=28::Error: fd is not available and could not be downloaded%0A ❯ src/core/tools/find.ts:220:28%0A ❯ settle src/core/tools/find.ts:140:6%0A ❯ src/core/tools/find.ts:220:8%0A%0A

::error file=/home/runner/work/pi-claude/pi-claude/packages/coding-agent/src/core/tools/find.ts,title=test/suite/regressions/3303-find-nested-gitignore.test.ts > issue #3303 nested .gitignore rules leak into sibling directories > deeply nested case > scopes each .gitignore to its own subtree,line=220,column=28::Error: fd is not available and could not be downloaded%0A ❯ src/core/tools/find.ts:220:28%0A ❯ settle src/core/tools/find.ts:140:6%0A ❯ src/core/tools/find.ts:220:8%0A%0A
npm error Lifecycle script `test` failed with error:
npm error code 1
npm error path /home/runner/work/pi-claude/pi-claude/packages/coding-agent
npm error workspace @doubleflower/pi-claude@0.82.2
npm error location /home/runner/work/pi-claude/pi-claude/packages/coding-agent
npm error command failed
npm error command sh -c vitest --run
```
Exit code: 1

Result: FAILED at tests
