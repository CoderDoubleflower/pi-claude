#!/usr/bin/env bash
set -euo pipefail

python <<'PY'
from pathlib import Path

replacements = {
    Path("packages/ai/test/context-overflow.test.ts"): [
        ("gemini-2.5-pro - should detect overflow via isContextOverflow", "gemini-3.1-pro-preview - should detect overflow via isContextOverflow"),
        ('getModel("github-copilot", "gemini-2.5-pro")', 'getModel("github-copilot", "gemini-3.1-pro-preview")'),
    ],
    Path("packages/ai/test/openai-completions-tool-choice.test.ts"): [
        ('getModel("groq", "qwen/qwen3-32b")', 'getModel("groq", "qwen/qwen3.6-27b")'),
    ],
}

for path, pairs in replacements.items():
    text = path.read_text()
    for old, new in pairs:
        count = text.count(old)
        if count != 1:
            raise SystemExit(f"Expected exactly one occurrence in {path}: {old!r}; found {count}")
        text = text.replace(old, new)
    path.write_text(text)
PY

npm ci --ignore-scripts
npm run build
npm run check
npm test

git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git checkout -- packages/ai/src/models.generated.ts || true
rm -f .github/batch1-ci-trigger.txt
rm -f .github/workflows/upstream-sync-batch1-model-tests.yml
rm -f .github/scripts/upstream-batch1-model-tests.sh
git add -A
git commit -m "fix(ai): refresh model catalog regression IDs"
git push origin HEAD:sync/upstream-batch1-20260805
