#!/usr/bin/env python3
import re
from pathlib import Path

root = Path(__file__).resolve().parents[1]
matched: list[Path] = []
candidates: list[Path] = []
allowed_suffixes = {'.ts', '.tsx', '.js', '.mjs', '.cjs', '.json', '.map'}

for path in root.rglob('*'):
    if not path.is_file() or path.suffix not in allowed_suffixes or '.git' in path.parts:
        continue
    try:
        if path.stat().st_size > 5_000_000:
            continue
        content = path.read_text(encoding='utf-8')
    except (UnicodeDecodeError, OSError):
        continue

    if any(token in content for token in ('plain-output', 'wrapped visual rows', 'line 8', 'AAAAA')):
        candidates.append(path)

    original = content
    content = content.replace(
        'keeps the most recent plain-output lines in collapsed mode',
        'keeps the leading plain-output lines in collapsed mode',
    )
    content, _ = re.subn(
        r'expect\(plain\)\.toContain\((?:"|\'|`)line 8\\nline 9\\nline 10(?:"|\'|`)\);',
        'expect(plain).toContain("line 1\\nline 2\\nline 3");\n\t\texpect(plain).toContain("… +7 lines");',
        content,
        count=1,
    )
    content, _ = re.subn(
        r'expect\(plain\)\.toContain\((?:"|\'|`)CCC(?:"|\'|`)\);\s*expect\(plain\)\.not\.toContain\((?:"|\'|`)AAAAA(?:"|\'|`)\);',
        'expect(plain).toContain("AAAAA\\nBBBBB");\n\t\texpect(plain).toContain("… +1 lines");\n\t\texpect(plain).not.toContain("CCC");',
        content,
        count=1,
    )

    if content != original:
        path.write_text(content, encoding='utf-8')
        matched.append(path)

print('Bash preview test candidates:')
for path in candidates[:100]:
    print(f'  {path.relative_to(root)}')
print('Filename candidates:')
for path in root.rglob('*'):
    if path.is_file() and ('bash-output-preview' in path.name or 'output-preview' in path.name):
        print(f'  {path.relative_to(root)}')

if matched:
    for path in matched:
        print(f'Updated Claude-style Bash output expectations in {path.relative_to(root)}')
else:
    print('No legacy Bash preview assertion source was directly patchable; continuing for diagnostic test output.')
