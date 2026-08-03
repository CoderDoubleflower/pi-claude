#!/usr/bin/env bash
set -euo pipefail

branch="feat/plan-clear-context-session-clean"
git fetch origin "$branch"
git checkout -B "$branch" "origin/$branch"

python3 <<'PY'
from pathlib import Path

types = Path("packages/coding-agent/src/core/extensions/types.ts")
text = types.read_text()
required = "\tnewSession(options?: {\n\t\tparentSession?: string;\n\t\tsetup?: (sessionManager: SessionManager) => Promise<void>;\n\t\twithSession?: (ctx: ReplacedSessionContext) => Promise<void>;\n\t}): Promise<{ cancelled: boolean }>;\n\t/** Get the current effective system prompt. */"
optional = required.replace("\tnewSession(", "\tnewSession?(", 1)
if optional not in text:
    if text.count(required) != 1:
        raise SystemExit("Could not uniquely locate ExtensionContext.newSession")
    types.write_text(text.replace(required, optional, 1))

plan = Path("packages/coding-agent/src/extensions/plan-mode/index.ts")
text = plan.read_text()
old = '''\t\tsetTimeout(() => {
\t\t\tlet deliveredInFreshSession = false;
\t\t\tvoid ctx
\t\t\t\t.newSession({
'''
new = '''\t\tsetTimeout(() => {
\t\t\tconst startFreshSession = ctx.newSession;
\t\t\tif (!startFreshSession) {
\t\t\t\tdeliverInCurrentSession("Context clear is unavailable; starting implementation in the current context.");
\t\t\t\treturn;
\t\t\t}
\t\t\tlet deliveredInFreshSession = false;
\t\t\tvoid startFreshSession({
'''
if new not in text:
    if text.count(old) != 1:
        raise SystemExit("Could not uniquely locate fresh-session transition")
    plan.write_text(text.replace(old, new, 1))
PY

rm -f .github/trigger-plan-clear-context-compat

git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git add packages/coding-agent/src/core/extensions/types.ts \
        packages/coding-agent/src/extensions/plan-mode/index.ts \
        .github/trigger-plan-clear-context-compat
if ! git diff --cached --quiet; then
  git commit -m "fix(coding-agent): make plan context replacement capability optional"
  git push origin "HEAD:$branch"
fi
