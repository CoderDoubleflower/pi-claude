#!/usr/bin/env bash
set -euo pipefail

python <<'PY'
from pathlib import Path

agent_path = Path("packages/agent/src/agent.ts")
text = agent_path.read_text()
replacements = [
    ('\ttoolExecution?: ToolExecutionMode;\n\t/** Stop gracefully after a completed turn and before another provider request. */\n\tshouldStopAfterTurn?: (context: ShouldStopAfterTurnContext) => boolean | Promise<boolean>;\n}', '\ttoolExecution?: ToolExecutionMode;\n}'),
    ('\t/** Hook to stop the agent loop after the current turn completes. */\n\tpublic shouldStopAfterTurn?: (context: ShouldStopAfterTurnContext) => boolean | Promise<boolean>;\n\n\tconstructor(options: AgentOptions) {', '\tconstructor(options: AgentOptions) {'),
    ('\t\tthis.toolExecution = runtimeOptions.toolExecution ?? "parallel";\n\t\tthis.shouldStopAfterTurn = runtimeOptions.shouldStopAfterTurn;\n\t}', '\t\tthis.toolExecution = runtimeOptions.toolExecution ?? "parallel";\n\t}'),
    ('\t\t\tshouldStopAfterTurn: this.shouldStopAfterTurn,\n\t\t\tbeforeToolCall: this.beforeToolCall,', '\t\t\tbeforeToolCall: this.beforeToolCall,'),
]
for old, new in replacements:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"Expected one Agent overlap block, found {count}: {old[:80]!r}")
    text = text.replace(old, new)
agent_path.write_text(text)

compaction_path = Path("packages/coding-agent/src/core/remote-compaction/extension.ts")
text = compaction_path.read_text()
insertion_point = '\t\tconst [localResult, remoteResult] = await Promise.allSettled(['
headers_block = '''\t\tconst requestHeaders = auth.headers
\t\t\t? (Object.fromEntries(
\t\t\t\t\tObject.entries(auth.headers).filter(([, value]) => value !== null),
\t\t\t\t) as Record<string, string>)
\t\t\t: undefined;

'''
if text.count(insertion_point) != 1:
    raise SystemExit("Remote compaction insertion point changed")
text = text.replace(insertion_point, headers_block + insertion_point)
compact_headers = '\t\t\t\tauth.apiKey,\n\t\t\t\tauth.headers,\n'
if text.count(compact_headers) != 1:
    raise SystemExit("Native compaction header call changed")
text = text.replace(compact_headers, '\t\t\t\tauth.apiKey,\n\t\t\t\trequestHeaders,\n')
remote_headers = '\t\t\t\theaders: auth.headers,\n'
if text.count(remote_headers) != 1:
    raise SystemExit("Remote compaction header call changed")
text = text.replace(remote_headers, '\t\t\t\theaders: requestHeaders,\n')
compaction_path.write_text(text)
PY

npm ci --ignore-scripts
npm run build
npx vitest --run \
  packages/agent/test/agent.test.ts \
  packages/ai/test/google-shared-gemini3-unsigned-tool-call.test.ts \
  packages/ai/test/google-shared-retry.test.ts \
  packages/ai/test/sampling-options.test.ts \
  packages/ai/test/validation.test.ts \
  packages/coding-agent/test/model-resolver.test.ts \
  packages/coding-agent/test/package-manager.test.ts \
  packages/coding-agent/test/suite/agent-session-tool-result-images.test.ts \
  packages/coding-agent/test/suite/regressions/6104-find-root-relativization.test.ts \
  packages/coding-agent/test/suite/regressions/7150-rpc-prompt-during-compaction.test.ts \
  packages/coding-agent/test/suite/regressions/7497-session-discovery-symlink.test.ts
node --test --test-reporter=dot --test-reporter-destination=stdout \
  packages/tui/test/terminal-colors.test.ts \
  packages/tui/test/terminal.test.ts

git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git checkout -- packages/ai/src/models.generated.ts packages/ai/src/providers/data || true
rm -f .github/workflows/upstream-sync-batch1-validate.yml
rm -f .github/workflows/upstream-sync-batch1-validate-v2.yml
rm -f .github/workflows/upstream-sync-batch1-runner.yml
rm -f .github/scripts/upstream-batch1-reconcile.sh
rm -f .upstream-batch1-trigger
git add -A
git commit -m "fix: reconcile upstream provider and agent APIs"
git push origin HEAD:sync/upstream-batch1-20260805
