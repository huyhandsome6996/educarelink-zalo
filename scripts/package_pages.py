"""Zalo không nhận .html: đóng gói nội dung trang trong JSON để shell tải."""
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
pages = root / "src/www/pages"
count = 0
for source in pages.glob("*.html"):
    target = source.with_suffix(".json")
    target.write_text(json.dumps({"html": source.read_text(encoding="utf-8")}, ensure_ascii=False), encoding="utf-8")
    source.unlink()
    count += 1
print(f"Đã đóng gói {count} trang JSON cho CDN Zalo")
