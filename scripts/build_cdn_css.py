#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Build CSS precompiled cho các trang gốc dùng Tailwind CDN.
- Trích xuất nguyên vẹn tailwind.config inline của từng template gốc
- Tạo config CLI per-page (content = file html ĐÃ emit)
- Chạy npx tailwindcss (v3.4.x — cùng engine CDN v3) -> static/css/cdn-<name>.css
Kết quả: các trang render y hệt lúc còn dùng CDN, nhưng offline + nhanh.

Fix P1-5 (audit 08/10/2026):
- Đường dẫn dựa trên __file__ (chạy được ở mọi checkout Windows/Linux)
- Lỗi tailwind / CSS probe FAIL -> exit nonzero (bản cũ exit 0 dù CSS hỏng)
"""
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
# Repo gốc nằm CẠNH repo zalo (quy ước README) — CHỈ ĐỌC; override bằng $EDUCARELINK_SRC
SRC = (os.environ.get("EDUCARELINK_SRC")
       or str(REPO_ROOT.parent / "educarelink-backend-4-12-2026"
              / "frontend" / "templates" / "frontend"))
PAGES_DIR = REPO_ROOT / "src" / "public" / "pages"
OUT_CSS = REPO_ROOT / "src" / "public" / "static" / "css"
CONF_DIR = REPO_ROOT / "scripts" / "tailwind-cdn"

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


def main(argv=None):
    if not os.path.isdir(SRC):
        sys.exit(
            "LỖI: không tìm thấy template gốc tại:\n  %s\n"
            "  -> clone repo gốc CẠNH repo này hoặc đặt EDUCARELINK_SRC" % SRC)
    os.makedirs(CONF_DIR, exist_ok=True)
    os.makedirs(OUT_CSS, exist_ok=True)

    only = set(argv) if argv else None
    npx = shutil.which("npx")
    if not npx:
        sys.exit("LỖI: không tìm thấy npx trong PATH (cần Node.js). Cài Node >= 18.")

    failures = []
    for tpl, name in CDN_PAGES:
        if only and name not in only:
            continue
        with open(os.path.join(SRC, tpl), encoding="utf-8") as f:
            cfg = extract_config(f.read())
        if not cfg:
            print("-- %s không có config inline -> dùng Tailwind mặc định" % tpl)
        page_html = str(PAGES_DIR / tpl.replace("_", "-"))
        # Content path TƯƠNG ĐỐI THEO REPO ROOT: tailwind v3 resolve content
        # theo CWD, mà script luôn chạy npx với cwd=REPO_ROOT (xem
        # subprocess.run bên dưới) -> config sinh ra GIỐNG NHAU ở mọi
        # checkout, không bake đường dẫn máy (P1-5 audit).
        content_path = ("src/public/pages/" + tpl.replace("_", "-"))
        conf_path = str(CONF_DIR / (name + ".config.js"))
        with open(conf_path, "w", encoding="utf-8") as f:
            f.write("/** Tự sinh từ %s — KHÔNG sửa tay, chạy build_cdn_css.py */\n" % tpl)
            if cfg:
                f.write("var cfg = %s;\n" % cfg)
                f.write("cfg.content = [\"%s\"];\n" % content_path)
                f.write("cfg.plugins = cfg.plugins || [];\n")
                f.write("module.exports = cfg;\n")
            else:
                # Trang dùng CDN không khai báo config -> Tailwind mặc định 100%
                f.write("module.exports = { content: [\"%s\"] };\n" % content_path)
        out = str(OUT_CSS / ("cdn-%s.css" % name))
        r = subprocess.run(
            [npx, "tailwindcss", "-c", conf_path, "-o", out, "--minify"],
            cwd=str(REPO_ROOT), capture_output=True, text=True)
        if r.returncode != 0:
            print("!! tailwindcss LỖI cho %s (exit %d)" % (name, r.returncode))
            print(r.stdout[-800:], r.stderr[-800:])
            failures.append(name)
            continue
        if not os.path.isfile(out):
            print("!! tailwindcss báo OK nhưng không tạo được %s" % out)
            failures.append(name)
            continue
        size = os.path.getsize(out)
        # Verify nhanh (heuristic): CSS phải là Tailwind thật đã quét content
        # của page — chứa ít nhất 1 trong các utility nền. KHÔNG yêu cầu
        # text-primary/bg-primary: nhiều trang gốc không dùng màu primary mà
        # dùng giá trị trực tiếp (vd bg-[#F26522]) — probe cũ gây báo sai.
        with open(out, encoding="utf-8") as f:
            content = f.read()
        probe = (".flex" in content or ".grid" in content or ".px-" in content)
        ok = size > 5000 and probe
        if not ok:
            failures.append(name)
        print("%-24s cdn-%s.css %6.1fKB %s" % (
            tpl, name, size / 1024, "OK" if ok else "KIỂM TRA!"))

    if failures:
        print("\n!!! CSS BUILD THẤT BẠT (%d): %s" % (len(failures), ", ".join(failures)))
        sys.exit(1)
    print("OK: CSS build thành công")


if __name__ == "__main__":
    main(sys.argv[1:])
