# Automated npm publishing

The repository publishes only `@doubleflower/pi-claude`; it does not publish the upstream `@earendil-works/*` workspaces. Do not use the root monorepo publish command for fork releases.

## First publication

Because a trusted publisher is configured from an existing npm package's settings page, use an npm automation token for the first release:

1. Create a granular npm access token that can publish packages under the `doubleflower` account.
2. In GitHub, open **Settings → Secrets and variables → Actions**.
3. Add a repository secret named `NPM_TOKEN` containing that token.
4. Open **Actions → Publish pi-claude to npm → Run workflow**.
5. Run it from `main`, normally with the `patch` increment.

The workflow updates the version and generated lock files, builds and tests the repository, publishes the package, pushes a `pi-claude-v<version>` tag, and creates a GitHub Release.

## Switch to trusted publishing

After the package exists on npm:

1. Open the npm settings for `@doubleflower/pi-claude`.
2. Add a GitHub Actions trusted publisher with:
   - GitHub user or organization: `CoderDoubleflower`
   - Repository: `pi-claude`
   - Workflow filename: `publish-npm.yml`
   - Environment: leave blank
   - Allowed action: `npm publish`
3. Run the release workflow once to confirm OIDC publishing works.
4. Delete the `NPM_TOKEN` GitHub secret and revoke the npm automation token.

The workflow grants `id-token: write`, uses a GitHub-hosted runner, and installs a current npm CLI compatible with npm trusted publishing.

## Subsequent releases

Open **Actions → Publish pi-claude to npm → Run workflow**, select `patch`, `minor`, or `major`, and run it from `main`. You may optionally enter an exact `x.y.z` version.

Pushing an existing `pi-claude-v<version>` tag also runs the publish path. This is useful for retrying a release whose source commit and tag already exist.
