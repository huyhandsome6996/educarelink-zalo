#!/usr/bin/env python3
"""Fix React unitless line-height bug: lineHeight: N (số) -> lineHeight: 'Npx' (chuỗi px).
React chuyển số lineHeight thành unitless multiplier (16 x fontSize = 168px) — sai chuẩn RN (dp)."""
import pathlib, re

ROOT = pathlib.Path(__file__).resolve().parent.parent / "src"
pattern = re.compile(r"lineHeight:\s*(\d+)\s*([,}])")
fixed_files = 0, 0
total = 0
for p in ROOT.rglob("*.ts*"):
    src = p.read_text()
    new, n = pattern.subn(lambda m: f"lineHeight: '{m.group(1)}px'{m.group(2)}", src)
    # bỏ qua nếu đã là chuỗi 'Npx' (regex chỉ bắt số trần nên an toàn)
    if n:
        p.write_text(new)
        total += n
        fixed_files += 1
print(f"Fixed {total} lineHeight in {fixed_files} files")
