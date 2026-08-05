#!/usr/bin/env bash
set -euo pipefail

runtime_root="${RUNNER_TEMP:-${TMPDIR:-/tmp}}"
diagnostic_dir="$PWD/.artifacts"
diagnostic_log="$diagnostic_dir/smoke-packed-cli.log"
mkdir -p "$diagnostic_dir"
: > "$diagnostic_log"
exec > >(tee -a "$diagnostic_log") 2>&1

pack_dir="$(mktemp -d "$runtime_root/pi-claude-pack.XXXXXX")"
install_prefix="$(mktemp -d "$runtime_root/pi-claude-smoke-prefix.XXXXXX")"
smoke_home="$(mktemp -d "$runtime_root/pi-claude-smoke-home.XXXXXX")"
current_stage="initialization"

cleanup() {
  rm -rf -- "$pack_dir" "$install_prefix" "$smoke_home"
}
report_error() {
  local status=$?
  echo "::error title=Packed CLI smoke failure::stage=$current_stage status=$status"
  exit "$status"
}
trap cleanup EXIT
trap report_error ERR

if [[ $# -gt 0 ]]; then
  package_path="$1"
else
  current_stage="release tarball build"
  package_path="$(node scripts/build-pi-claude-release-tarball.mjs --output-dir "$pack_dir")"
fi

echo "package_path=$package_path"
echo "install_prefix=$install_prefix"

current_stage="tarball installation"
npm install --global --ignore-scripts --prefix "$install_prefix" "$package_path"

installed_root="$install_prefix/lib/node_modules/@doubleflower/pi-claude"
global_node_modules_root="$(npm root --global --prefix "$install_prefix")"
echo "installed_root=$installed_root"
echo "global_node_modules_root=$global_node_modules_root"
echo "installed top-level packages:"
find "$global_node_modules_root" -mindepth 1 -maxdepth 2 -type d -print | sort

current_stage="runtime byte verification"
node scripts/verify-pi-claude-release-runtime.mjs "$installed_root" "$global_node_modules_root"

cli="$install_prefix/bin/pi-claude"
current_stage="version startup"
"$cli" --version

current_stage="interactive startup"
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
echo "startup_status=$startup_status"

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

current_stage="completed"
echo "packed_cli_smoke=success"
