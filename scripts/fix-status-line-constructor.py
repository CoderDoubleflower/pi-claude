from pathlib import Path

path = Path("packages/coding-agent/src/core/status-line.ts")
text = path.read_text()
old = '''\tconstructor(private readonly requestRender: () => void = () => {}) {}
'''
new = '''\tprivate readonly requestRender: () => void;

\tconstructor(requestRender: () => void = () => {}) {
\t\tthis.requestRender = requestRender;
\t}
'''
if old not in text:
    raise SystemExit("Expected StatusLineCommandRunner constructor anchor was not found")
path.write_text(text.replace(old, new, 1))
