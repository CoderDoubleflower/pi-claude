#!/usr/bin/env python3
import re
from pathlib import Path

root = Path(__file__).resolve().parents[1]
matched: list[Path] = []
candidates: list[Path] = []

for path in root.rglob('*'):
    if not path.is_file() or path.suffix not in {'.ts', '.tsx'}:
        continue
    try:
        content = path.read_text(encoding='utf-8')
    except UnicodeDecodeError:
        continue

    if any(token in content for token in ('line 8', 'AAAAA', 'most recent plain-output', 'counts wrapped visual rows')):
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

if len(matched) != 1:
    relative_candidates = [str(path.relative_to(root)) for path in candidates[:20]]
    raise RuntimeError(
        f'expected one Bash preview test file, changed {len(matched)}; '
        f'candidate files: {relative_candidates}'
    )

print(f'Updated Claude-style Bash output expectations in {matched[0].relative_to(root)}')
