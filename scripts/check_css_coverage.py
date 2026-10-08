#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""
Kiểm tra coverage CSS: mọi class tĩnh dùng trong page phải có rule trong
css (built tailwind / cdn css / inline style của chính page).
CSS selector escape: : . / [ ] ( ) # % , ! & ' * -> \char,
độ phủ tính trên toàn bộ file css ghép lại cho page đó.
"""
import os
import re
import sys
from pathlib import Path

# Đường dẫn dựa trên vị trí file (P1-5 audit) — chạy được ở mọi checkout.
REPO_ROOT = Path(__file__).resolve().parents[1]
PAGES = str(REPO_ROOT / "src" / "public" / "pages")
CSS = str(REPO_ROOT / "src" / "public" / "static" / "css")

CHECKS = [
    ("parent-home.html", ["cdn-parent_home.css"]),
    ("ung-vien.html", ["cdn-ung_vien.css"]),
    ("dang-viec-select.html", ["cdn-dang_viec_select.css"]),
    ("dang-viec-gia-su.html", ["cdn-dang_viec_gia_su.css"]),
    ("dang-viec-don-tre.html", ["cdn-dang_viec_don_tre.css"]),
    ("dang-viec-trong-tre.html", ["cdn-dang_viec_trong_tre.css"]),
    ("notifications.html", ["tailwind-plain.css", "cdn-notifications.css"]),
    ("chat.html", ["tailwind-plain.css", "cdn-chat.css"]),
    ("tracking.html", ["tailwind-plain.css", "cdn-tracking.css"]),
    ("parent-payments.html", ["tailwind-plain.css", "cdn-parent_payments.css"]),
    ("worker-complaints.html", ["tailwind-plain.css", "cdn-worker_complaints.css"]),
    ("worker-earnings.html", ["tailwind-plain.css", "cdn-worker_earnings.css"]),
    ("splash.html", ["tailwind-radius-a.css"]),
    ("login.html", ["tailwind-default.css"]),
    ("register.html", ["tailwind-radius-b.css"]),
    ("parent-tasks.html", ["tailwind-default.css"]),
    ("parent-task-detail.html", ["tailwind-default.css"]),
    ("parent-candidate-profile.html", ["tailwind-default.css"]),
    ("browse-candidates.html", ["tailwind-default.css"]),
    ("chatbot.html", ["tailwind-radius-a.css"]),
    ("review.html", ["tailwind-default.css"]),
    ("parent-profile.html", ["tailwind-default.css"]),
    ("worker-feed.html", ["tailwind-default.css"]),
    ("worker-jobs.html", ["tailwind-default.css"]),
    ("worker-profile.html", ["tailwind-default.css"]),
    ("worker-chatbot.html", ["tailwind-radius-a.css"]),
    ("worker-availability.html", ["tailwind-default.css"]),
    ("help-center.html", ["tailwind-radius-a.css"]),
    ("task-detail.html", ["tailwind-default.css"]),
    ("task-create-1.html", ["tailwind-radius-a.css"]),
    ("task-create-2.html", ["tailwind-radius-a.css"]),
    ("don.html", ["tailwind-default.css"]),
    ("khang-cao.html", ["tailwind-default.css"]),
    ("vi-credit.html", ["tailwind-default.css"]),
    ("don-cua-toi.html", ["tailwind-default.css"]),
    ("lich-ranh.html", ["tailwind-default.css"]),
    ("ngay-ban.html", ["tailwind-default.css"]),
    ("admin-dashboard.html", ["tailwind-default.css"]),
]

CLASS_ATTR_RE = re.compile(r'class=(["\'])([^"\']*)\1')
STYLE_BLOCK_RE = re.compile(r"<style[^>]*>([\s\S]*?)</style>", re.I)
SELECTOR_RE = re.compile(r"([^{}]+)\{")


def css_escape(token):
    """Token class -> dạng selector như trong file css minified."""
    return re.sub(r"([^\w-])", r"\\\1", token)


def collect_inline_style_classes(html):
    """Class do <style> nội tuyến của page tự định nghĩa -> coi như có sẵn."""
    out = set()
    for m in STYLE_BLOCK_RE.finditer(html):
        for sel in SELECTOR_RE.findall(m.group(1)):
            for tok in re.findall(r"\.([A-Za-z0-9_\\:.()\[\]#%/-]+)", sel):
                # .a.b (selector ghép) -> tính cả a lẫn b
                for part in tok.replace("\\", "").split("."):
                    if 1 < len(part) < 40:
                        out.add(part)
    return out


def page_class_tokens(html):
    toks = set()
    for m in CLASS_ATTR_RE.finditer(html):
        for t in m.group(2).split():
            if "$" not in t and "{" not in t and "}" not in t:
                toks.add(t)
    return toks


def covered(css_all, token, inline_classes):
    if token in inline_classes:
        return True
    # 1) substring trực tiếp (escape chuẩn \char)
    if ("." + css_escape(token)) in css_all:
        return True
    # 2) minifier có thể escape bằng hex \2c ... -> pattern linh hoạt
    parts = []
    for ch in token:
        if re.match(r"[\w-]", ch):
            parts.append(re.escape(ch))
        else:
            parts.append(r"(?:\\" + re.escape(ch) + r"|\\[0-9a-fA-F]{1,6}\s?)")
    pat = r"\." + "".join(parts) + r"(?![\w-])"
    if re.search(pat, css_all):
        return True
    return False


def main():
    total_missing = 0
    for page, css_files in CHECKS:
        p = os.path.join(PAGES, page)
        if not os.path.exists(p):
            print("THIẾU PAGE:", page)
            total_missing += 1
            continue
        css_all = ""
        ok = True
        for c in css_files:
            fp = os.path.join(CSS, c)
            if not os.path.exists(fp):
                print("THIẾU CSS:", c, "cho", page)
                ok = False
                total_missing += 1
                continue
            css_all += open(fp, encoding="utf-8").read()
        html = open(p, encoding="utf-8").read()
        inline = collect_inline_style_classes(html)
        toks = [t for t in page_class_tokens(html)
                if re.match(r"^[a-zA-Z][a-zA-Z0-9_:.\[\]/()%#!,$@-]*$", t)]
        missing = [t for t in toks if not covered(css_all, t, inline)]
        if missing or not ok:
            total_missing += len(missing)
            print("%-30s thiếu %3d/%3d: %s" % (page, len(missing), len(toks), ", ".join(missing[:14])))
        else:
            print("%-30s OK (%d class)" % (page, len(toks)))
    print("\nTổng thiếu:", total_missing)
    sys.exit(0 if total_missing == 0 else 2)


if __name__ == "__main__":
    main()
