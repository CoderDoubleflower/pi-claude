#!/usr/bin/env bash
set -euo pipefail

runtime_root="${RUNNER_TEMP:-${TMPDIR:-/tmp}}"
pack_dir="$(mktemp -d "$runtime_root/pi-claude-pack.XXXXXX")"
install_prefix="$(mktemp -d "$runtime_root/pi-claude-smoke-prefix.XXXXXX")"
smoke_home="$(mktemp -d "$runtime_root/pi-claude-smoke-home.XXXXXX")"

cleanup() {
  rm -rf -- "$pack_dir" "$install_prefix" "$smoke_home"
}
trap cleanup EXIT

if [[ $# -gt 0 ]]; then
  package_path="$1"
else
  package_path="$(node scripts/build-pi-claude-release-tarball.mjs --output-dir "$pack_dir")"
fi

npm install --global --ignore-scripts --prefix "$install_prefix" "$package_path"
installed_root="$install_prefix/lib/node_modules/@doubleflower/pi-claude"
node scripts/verify-pi-claude-release-runtime.mjs "$installed_root"

cli="$install_prefix/bin/pi-claude"
"$cli" --version

set +e
startup_output="$(
  timeout --signal=INT --kill-after=5s 4s \
    script --quiet --return --command \
      "env HOME='$smoke_home' TERM=xterm-256color PI_OFFLINE=1 '$cli'" \
      /dev/null 2>&1
)"
startup_status=$?
set -e

printf '%s\n' "$startup_output"

if grep -Eiq \
  'uncaughtException|does not provide an export|ERR_MODULE_NOT_FOUND|Cannot find package|is not a function|TypeError:|ReferenceError:|SyntaxError:' \
  <<<"$startup_output"; then
  echo '::error::The packed CLI crashed during interactive startup.'
  exit 1
fi

if [[ $startup_status -ne 0 && $startup_status -ne 124 && $startup_status -ne 130 && $startup_status -ne 143 ]]; then
  echo "::error::The packed CLI exited unexpectedly with status $startup_status."
  exit "$startup_status"
fi
