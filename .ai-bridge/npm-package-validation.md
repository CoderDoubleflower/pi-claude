# npm package validation

- npm ci: 1
- build: 99
- shrinkwrap check: 99
- install-lock check: 99
- npm pack dry run: 99

## npm-ci
```text
npm warn EBADENGINE Unsupported engine {
npm warn EBADENGINE   package: '@earendil-works/gondolin@0.12.0',
npm warn EBADENGINE   required: { node: '>=23.6.0' },
npm warn EBADENGINE   current: { node: 'v22.19.0', npm: '10.9.3' }
npm warn EBADENGINE }
npm error code EUSAGE
npm error
npm error `npm ci` can only install packages when your package.json and package-lock.json or npm-shrinkwrap.json are in sync. Please update your lock file with `npm install` before continuing.
npm error
npm error Missing: @earendil-works/pi-coding-agent@0.82.1 from lock file
npm error
npm error Clean install a project
npm error
npm error Usage:
npm error npm ci
npm error
npm error Options:
npm error [--install-strategy <hoisted|nested|shallow|linked>] [--legacy-bundling]
npm error [--global-style] [--omit <dev|optional|peer> [--omit <dev|optional|peer> ...]]
npm error [--include <prod|dev|optional|peer> [--include <prod|dev|optional|peer> ...]]
npm error [--strict-peer-deps] [--foreground-scripts] [--ignore-scripts] [--no-audit]
npm error [--no-bin-links] [--no-fund] [--dry-run]
npm error [-w|--workspace <workspace-name> [-w|--workspace <workspace-name> ...]]
npm error [-ws|--workspaces] [--include-workspace-root] [--install-links]
npm error
npm error aliases: clean-install, ic, install-clean, isntall-clean
npm error
npm error Run "npm help ci" for more info
npm error A complete log of this run can be found in: /home/runner/.npm/_logs/2026-07-29T02_27_10_121Z-debug-0.log
```

## build
```text
Skipped because npm ci failed.
```

## shrinkwrap
```text
Skipped because npm ci failed.
```

## install-lock
```text
Skipped because npm ci failed.
```

## pack
```text
Skipped because install or build failed.
```

