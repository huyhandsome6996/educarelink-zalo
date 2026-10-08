#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Quét 44 trang đã build: không được còn mảnh Django cụt (%}/{%/{{) —
regression cho P0-1 audit. Chạy: python3 scripts/scan_leak_pages.py [port]"""
import re
import sys
import urllib.request

PORT = sys.argv[1] if len(sys.argv) > 1 else "3001"
PAGES = [
    "splash", "landing", "login", "register", "onboarding-parent", "onboarding-worker",
    "parent-home", "task-create-1", "task-create-2", "parent-tasks", "parent-task-detail",
    "parent-candidate-profile", "browse-candidates", "chatbot", "review", "parent-profile",
    "parent-care-diary-detail", "parent-care-diary-history", "tracking", "parent-payments",
    "worker-feed", "task-detail", "worker-jobs", "worker-profile", "worker-availability",
    "worker-chatbot", "help-center", "worker-care-diary-form", "worker-complaints",
    "worker-earnings", "chat", "notifications", "dang-viec-select", "dang-viec-gia-su",
    "dang-viec-trong-tre", "dang-viec-don-tre", "ung-vien", "don", "khang-cao",
    "vi-credit", "lich-ranh", "ngay-ban", "don-cua-toi", "admin-dashboard",
]

def fetch(page):
    with urllib.request.urlopen("http://localhost:%s/pages/%s.html" % (PORT, page), timeout=30) as r:
        return r.read().decode("utf-8")

bad = 0
for page in PAGES:
    try:
        html = fetch(page)
    except Exception as e:
        print("LỖI tải %s: %s" % (page, e))
        bad += 1
        continue
    spans = [(m.start(), m.end()) for m in re.finditer(r"\{%[\s\S]*?%\}", html)]
    leaks = []
    for m in re.finditer(r"%\}", html):
        if not any(a <= m.start() < b for a, b in spans):
            ctx = html[max(0, m.start() - 50):m.start()].replace("\n", " ")[-50:]
            leaks.append("..." + ctx + "%}")
    orphans_open = [m.group(0) for m in re.finditer(r"(?<!\{)\{%(?! %[\s\S]*?%\})", html)]
    vars_left = re.findall(r"\{\{\s*[a-zA-Z_][a-zA-Z0-9_.|'\" ]{0,40}\}\}", html)
    status = "OK" if not (leaks or vars_left) else "RÒ RÌ"
    if leaks or vars_left:
        bad += 1
        print("%-34s %s | leak=%d var=%d | %s" % (page, status, len(leaks), len(vars_left), (leaks + vars_left)[:2]))
print("\nKết quả: %d/%d trang sạch mảnh Django" % (len(PAGES) - bad, len(PAGES)))
sys.exit(1 if bad else 0)
