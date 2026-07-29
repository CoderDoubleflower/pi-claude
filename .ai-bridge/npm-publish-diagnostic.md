# npm publish diagnostic

Commit: 3d6b7c4d077da1e8a8ee1316ba3a1844e0b1578a

## npm-latest
```text
npm warn Unknown user config "always-auth". This will stop working in the next major version of npm. See `npm help npmrc` for supported config options.

removed 8 packages, and changed 77 packages in 5s

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
npm warn Unknown user config "always-auth". This will stop working in the next major version of npm. See `npm help npmrc` for supported config options.

up to date, audited 347 packages in 2s

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
npm warn Unknown user config "always-auth". This will stop working in the next major version of npm. See `npm help npmrc` for supported config options.
npm warn deprecated prebuild-install@7.1.3: No longer maintained. Please contact the author of the relevant native addon; alternatives are available.
npm warn deprecated node-domexception@1.0.0: Use your platform's native DOMException instead

added 333 packages, and audited 347 packages in 7s

56 packages are looking for funding
  run `npm fund` for details

3 high severity vulnerabilities

To address all issues, run:
  npm audit fix

Run `npm audit` for details.
```
Exit code: 0

## build
```text
npm warn Unknown user config "always-auth". This will stop working in the next major version of npm. See `npm help npmrc` for supported config options.
npm notice run pi-monorepo@0.0.3 build:offline
npm notice run cd packages/tui && npm run build && cd ../ai && npm run build:offline && cd ../agent && npm run build && cd ../storage/sqlite-node && npm run build && cd ../../coding-agent && npm run build && cd ../server && npm run build
npm warn Unknown user config "always-auth". This will stop working in the next major version of npm. See `npm help npmrc` for supported config options.
npm notice run @earendil-works/pi-tui@0.82.1 build
npm notice run tsgo -p tsconfig.build.json
npm warn Unknown user config "always-auth". This will stop working in the next major version of npm. See `npm help npmrc` for supported config options.
npm notice run @earendil-works/pi-ai@0.82.1 build:offline
npm notice run npm run check:model-data && tsgo -p tsconfig.build.json && shx rm -rf dist/providers/data && shx cp -r src/providers/data dist/providers/data
npm warn Unknown user config "always-auth". This will stop working in the next major version of npm. See `npm help npmrc` for supported config options.
npm notice run @earendil-works/pi-ai@0.82.1 check:model-data
npm notice run node scripts/check-model-data.ts
amazon-bedrock.json is not valid JSON: ENOENT: no such file or directory, open '/home/runner/work/pi-claude/pi-claude/packages/ai/src/providers/data/amazon-bedrock.json'

Model data is missing or stale. Run `npm run hydrate:model-data` from the repository root.
npm error Lifecycle script `check:model-data` failed with error:
npm error code 1
npm error path /home/runner/work/pi-claude/pi-claude/packages/ai
npm error workspace @earendil-works/pi-ai@0.82.1
npm error location /home/runner/work/pi-claude/pi-claude/packages/ai
npm error command failed
npm error command sh -c node scripts/check-model-data.ts
npm error Lifecycle script `build:offline` failed with error:
npm error code 1
npm error path /home/runner/work/pi-claude/pi-claude/packages/ai
npm error workspace @earendil-works/pi-ai@0.82.1
npm error location /home/runner/work/pi-claude/pi-claude/packages/ai
npm error command failed
npm error command sh -c npm run check:model-data && tsgo -p tsconfig.build.json && shx rm -rf dist/providers/data && shx cp -r src/providers/data dist/providers/data
```
Exit code: 1

