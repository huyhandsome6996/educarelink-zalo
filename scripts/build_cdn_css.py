#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Build CSS precompiled cho các trang gốc dùng Tailwind CDN.
- Trích xuất nguyên vẹn tailwind.config inline của từng template gốc
- Tạo config CLI per-page (content = file html ĐÃ emit)
- Chạy npx tailwindcss (v3.4.3 — cùng engine CDN v3) -> static/css/cdn-<name>.css
Kết quả: các trang render y hệt lúc còn dùng CDN, nhưng offline + nhanh.
"""
import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE_REPO = Path(os.environ.get("EDUCARELINK_SOURCE", ROOT.parent / "educarelink-main"))
SRC = str(SOURCE_REPO / "frontend/templates/frontend")
PAGES_DIR = str(ROOT / "src/public/pages")
OUT_CSS = str(ROOT / "src/public/static/css")
CONF_DIR = str(ROOT / "scripts/tailwind-cdn")

CDN_PAGES = [
    ("parent_home.html", "parent_home"),
    ("ung_vien.html", "ung_vien"),
    ("dang_viec_select.html", "dang_viec_select"),
    ("dang_viec_gia_su.html", "dang_viec_gia_su"),
    ("dang_viec_trong_tre.html", "dang_viec_trong_tre"),
    ("dang_viec_don_tre.html", "dang_viec_don_tre"),
    ("chat.html", "chat"),
    ("tracking.html", "tracking"),
    ("notifications.html", "notifications"),
    ("parent_payments.html", "parent_payments"),
    ("worker_complaints.html", "worker_complaints"),
    ("worker_earnings.html", "worker_earnings"),
]


def extract_config(text):
    """Trích object `tailwind.config = {...}` bằng brace counting."""
    key = text.find("tailwind.config")
    if key < 0:
        return None
    m = re.search(r"tailwind\.config\s*=\s*\{", text[key:])
    if not m:
        return None
    start = key + m.end() - 1  # vị trí '{'
    depth = 0
    for i in range(start, len(text)):
        c = text[i]
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                return text[start:i + 1]
    return None


def main():
    os.makedirs(CONF_DIR, exist_ok=True)
    os.makedirs(OUT_CSS, exist_ok=True)
    only = sys.argv[1:] if len(sys.argv) > 1 else None
    for tpl, name in CDN_PAGES:
        if only and name not in only:
            continue
        with open(os.path.join(SRC, tpl), encoding="utf-8") as f:
            cfg = extract_config(f.read())
        if not cfg:
            print("-- %s không có config inline -> dùng Tailwind mặc định" % tpl)
        page_html = "./src/public/pages/" + tpl.replace("_", "-")
        conf_path = os.path.join(CONF_DIR, name + ".config.js")
        with open(conf_path, "w", encoding="utf-8") as f:
            f.write("/** Tự sinh từ %s — KHÔNG sửa tay, chạy build_cdn_css.py */\n" % tpl)
            if cfg:
                f.write("var cfg = %s;\n" % cfg)
                f.write("cfg.content = [\"%s\"];\n" % page_html)
                f.write("cfg.plugins = cfg.plugins || [];\n")
                f.write("module.exports = cfg;\n")
            else:
                # Trang dùng CDN không khai báo config -> Tailwind mặc định 100%
                f.write("module.exports = { content: [\"%s\"] };\n" % page_html)
            # Các partial mới dùng token chung kể cả khi trang chỉ khai báo brand.
            f.write("var shared = require('../upstream-tailwind/shared-theme');\n")
            f.write("var theme = module.exports.theme = module.exports.theme || {};\n")
            f.write("var ext = theme.extend = theme.extend || {};\n")
            f.write("ext.colors = Object.assign({}, shared.colors, ext.colors || {});\n")
            f.write("ext.fontFamily = Object.assign({}, shared.fontFamily, ext.fontFamily || {});\n")
        out = os.path.join(OUT_CSS, "cdn-%s.css" % name)
        r = subprocess.run(
            ["node", str(ROOT / "node_modules/tailwindcss/lib/cli.js"), "-c", conf_path, "-o", out, "--minify"],
            cwd=str(ROOT),
            capture_output=True, text=True)
        if r.returncode != 0:
            print("!! tailwindcss lỗi cho", name)
            print(r.stdout[-800:], r.stderr[-800:])
            sys.exit(r.returncode)
        size = os.path.getsize(out)
        # verify nhanh: css phải chứa class chủ đạo của page
        with open(out, encoding="utf-8") as f:
            content = f.read()
        probe = "text-primary" in content or "bg-primary" in content
        print("%-24s cdn-%s.css %6.1fKB %s" % (
            tpl, name, size / 1024, "OK" if (size > 5000 and probe) else "KIỂM TRA!"))


if __name__ == "__main__":
    main()
