#!/usr/bin/env python3
from pathlib import Path

root = Path(__file__).resolve().parents[1]
needle = 'keeps the most recent plain-output lines in collapsed mode'
matched = []

for path in (root / 'packages' / 'coding-agent').rglob('*.ts'):
    content = path.read_text(encoding='utf-8')
    if needle not in content:
        continue

    original = content
    content = content.replace(
        needle,
        'keeps the leading plain-output lines in collapsed mode',
    )
    content = content.replace(
        'expect(plain).toContain("line 8\\nline 9\\nline 10");',
        'expect(plain).toContain("line 1\\nline 2\\nline 3");\n\t\texpect(plain).toContain("… +7 lines");',
    )
    content = content.replace(
        'expect(plain).toContain("CCC");\n\t\texpect(plain).not.toContain("AAAAA");',
        'expect(plain).toContain("AAAAA\\nBBBBB");\n\t\texpect(plain).toContain("… +1 lines");\n\t\texpect(plain).not.toContain("CCC");',
    )

    if content == original:
        raise RuntimeError(f'found target test but changed nothing: {path}')
    path.write_text(content, encoding='utf-8')
    matched.append(path)

if len(matched) != 1:
    raise RuntimeError(f'expected one Bash preview test file, found {len(matched)}: {matched}')

print(f'Updated Claude-style Bash output expectations in {matched[0].relative_to(root)}')
