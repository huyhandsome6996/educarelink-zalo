#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
EduCareLink Zalo Mini App — Page Compiler
=========================================
Copy Y XÌ giao diện từ repo gốc educarelink-backend-4-12-2026 (Django
templates) sang educarelink-zalo (Zalo Mini App) dưới dạng file HTML tĩnh
chạy trong iframe của shell React.

Nguyên tắc: KHÔNG tự vẽ lại UI. Mỗi trang = template gốc, chỉ thay thế:
  1) Django tags: {% url %} {% static %} {% include %} {% if %} {{ var }}
  2) Path nội bộ Django (/parent/tasks/) -> file .html tương đương
  3) API base: dev = proxy tương đối, prod = Render (window.API_BASE)
  4) Tailwind CDN -> CSS precompiled (build_cdn_css.py)
Repo gốc chỉ ĐỌC, không hề bị sửa.
"""
import os
import re
import sys

SRC = "/home/z/my-project/work/educarelink-backend-4-12-2026/frontend/templates/frontend"
OUT = "/home/z/my-project/work/educarelink-zalo/src/public/pages"

# ------------------------------------------------------------- ROUTES ------
URL_NAMES = {
    "splash": "/",
    "landing_page": "/landing/",
    "login": "/login/",
    "register": "/register/",
    "parent_onboarding": "/onboarding/parent/",
    "worker_onboarding": "/onboarding/worker/",
    "parent_home": "/parent/",
    "task_create_1": "/parent/create-1/",
    "task_create_2": "/parent/create-2/",
    "parent_tasks": "/parent/tasks/",
    "parent_task_detail": "/parent/task-detail/",
    "parent_candidate_profile": "/parent/candidate-profile/",
    "browse_candidates": "/parent/browse-candidates/",
    "chatbot": "/parent/chatbot/",
    "review": "/parent/review/",
    "parent_profile": "/parent/profile/",
    "parent_care_diary_detail": "/parent/care-diary/",
    "parent_care_diary_history": "/parent/care-diary-history/",
    "live_tracking": "/parent/tracking/",
    "parent_payments": "/parent/payments/",
    "worker_feed": "/worker/",
    "task_detail": "/worker/task-detail/",
    "worker_jobs": "/worker/my-jobs/",
    "worker_profile": "/worker/profile/",
    "worker_availability": "/worker/availability/",
    "worker_chatbot": "/worker/chatbot/",
    "help_center": "/worker/help-center/",
    "worker_care_diary": "/worker/care-diary/",
    "worker_complaints": "/worker/complaints/",
    "worker_earnings": "/worker/earnings/",
    "chat": "/chat/",
    "notifications": "/notifications/",
    "dang_viec_select": "/dang-viec/",
    "dang_viec_gia_su": "/dang-viec/gia-su/",
    "dang_viec_trong_tre": "/dang-viec/trong-tre/",
    "dang_viec_don_tre": "/dang-viec/don-tre/",
    "ung_vien": "/ung-vien/<id>/",
    "don": "/don/<id>/",
    "khang_cao": "/khang-cao/<id>/",
    "vi_credit": "/vi-credit/",
    "lich_ranh": "/lich-ranh/",
    "ngay_ban": "/ngay-ban/",
    "don_cua_toi": "/don-cua-toi/",
    "admin_dashboard": "/admin-dashboard/",
    "site_gate": "/site-gate/",
}

PATH_TO_PAGE = {
    "/": "splash.html",
    "/landing/": "landing.html",
    "/login/": "login.html",
    "/register/": "register.html",
    "/onboarding/parent/": "onboarding-parent.html",
    "/onboarding/worker/": "onboarding-worker.html",
    "/parent/": "parent-home.html",
    "/parent/create-1/": "task-create-1.html",
    "/parent/create-2/": "task-create-2.html",
    "/parent/tasks/": "parent-tasks.html",
    "/parent/task-detail/": "parent-task-detail.html",
    "/parent/candidate-profile/": "parent-candidate-profile.html",
    "/parent/browse-candidates/": "browse-candidates.html",
    "/parent/chatbot/": "chatbot.html",
    "/parent/review/": "review.html",
    "/parent/profile/": "parent-profile.html",
    "/parent/care-diary/": "parent-care-diary-detail.html",
    "/parent/care-diary-history/": "parent-care-diary-history.html",
    "/parent/tracking/": "tracking.html",
    "/parent/payments/": "parent-payments.html",
    "/worker/": "worker-feed.html",
    "/worker/task-detail/": "task-detail.html",
    "/worker/my-jobs/": "worker-jobs.html",
    "/worker/profile/": "worker-profile.html",
    "/worker/availability/": "worker-availability.html",
    "/worker/chatbot/": "worker-chatbot.html",
    "/worker/help-center/": "help-center.html",
    "/worker/care-diary/": "worker-care-diary-form.html",
    "/worker/complaints/": "worker-complaints.html",
    "/worker/earnings/": "worker-earnings.html",
    "/chat/": "chat.html",
    "/notifications/": "notifications.html",
    "/dang-viec/": "dang-viec-select.html",
    "/dang-viec/gia-su/": "dang-viec-gia-su.html",
    "/dang-viec/trong-tre/": "dang-viec-trong-tre.html",
    "/dang-viec/don-tre/": "dang-viec-don-tre.html",
    "/ung-vien/<id>/": "ung-vien.html",
    "/don/<id>/": "don.html",
    "/khang-cao/<id>/": "khang-cao.html",
    "/vi-credit/": "vi-credit.html",
    "/lich-ranh/": "lich-ranh.html",
    "/ngay-ban/": "ngay-ban.html",
    "/don-cua-toi/": "don-cua-toi.html",
    "/admin-dashboard/": "admin-dashboard.html",
    "/site-gate/": "site-gate.html",
}

PARAM_PREFIXES = {p: PATH_TO_PAGE[p] for p in PATH_TO_PAGE if "<id>" in p}

# ----------------------------------------------------------- PAGES ---------
PAGES = [
    ("splash.html", "splash.html", {}),
    ("landing.html", "landing.html", {}),
    ("login.html", "login.html", {}),
    ("register.html", "register.html", {}),
    ("onboarding_parent.html", "onboarding-parent.html", {}),
    ("onboarding_worker.html", "onboarding-worker.html", {}),
    ("parent_home.html", "parent-home.html", {"cdn": "parent_home", "dj": "/parent/"}),
    ("task_create_1.html", "task-create-1.html", {"dj": "/parent/create-1/"}),
    ("task_create_2.html", "task-create-2.html", {"dj": "/parent/create-2/"}),
    ("parent_tasks.html", "parent-tasks.html", {"dj": "/parent/tasks/"}),
    ("parent_task_detail.html", "parent-task-detail.html", {"dj": "/parent/task-detail/"}),
    ("parent_candidate_profile.html", "parent-candidate-profile.html", {"dj": "/parent/candidate-profile/"}),
    ("browse_candidates.html", "browse-candidates.html", {"dj": "/parent/browse-candidates/"}),
    ("chatbot.html", "chatbot.html", {"dj": "/parent/chatbot/"}),
    ("review.html", "review.html", {"dj": "/parent/review/"}),
    ("parent_profile.html", "parent-profile.html", {"dj": "/parent/profile/"}),
    ("parent_care_diary_detail.html", "parent-care-diary-detail.html", {"dj": "/parent/care-diary/"}),
    ("parent_care_diary_history.html", "parent-care-diary-history.html", {"dj": "/parent/care-diary-history/"}),
    ("tracking.html", "tracking.html", {"cdn": "tracking", "dj": "/parent/tracking/"}),
    ("parent_payments.html", "parent-payments.html", {"cdn": "parent_payments", "dj": "/parent/payments/"}),
    ("worker_feed.html", "worker-feed.html", {"dj": "/worker/"}),
    ("task_detail.html", "task-detail.html", {"dj": "/worker/task-detail/"}),
    ("worker_jobs.html", "worker-jobs.html", {"dj": "/worker/my-jobs/"}),
    ("worker_profile.html", "worker-profile.html", {"dj": "/worker/profile/"}),
    ("worker_availability.html", "worker-availability.html", {"dj": "/worker/availability/"}),
    ("worker_chatbot.html", "worker-chatbot.html", {"dj": "/worker/chatbot/"}),
    ("help_center.html", "help-center.html", {"dj": "/worker/help-center/"}),
    ("worker_care_diary_form.html", "worker-care-diary-form.html", {"dj": "/worker/care-diary/"}),
    ("worker_complaints.html", "worker-complaints.html", {"cdn": "worker_complaints", "dj": "/worker/complaints/"}),
    ("worker_earnings.html", "worker-earnings.html", {"cdn": "worker_earnings", "dj": "/worker/earnings/"}),
    ("chat.html", "chat.html", {"cdn": "chat", "dj": "/chat/"}),
    ("notifications.html", "notifications.html", {"cdn": "notifications", "dj": "/notifications/"}),
    ("dang_viec_select.html", "dang-viec-select.html", {"cdn": "dang_viec_select", "dj": "/dang-viec/"}),
    ("dang_viec_gia_su.html", "dang-viec-gia-su.html", {"cdn": "dang_viec_gia_su", "dj": "/dang-viec/gia-su/"}),
    ("dang_viec_trong_tre.html", "dang-viec-trong-tre.html", {"cdn": "dang_viec_trong_tre", "dj": "/dang-viec/trong-tre/"}),
    ("dang_viec_don_tre.html", "dang-viec-don-tre.html", {"cdn": "dang_viec_don_tre", "dj": "/dang-viec/don-tre/"}),
    ("ung_vien.html", "ung-vien.html", {"cdn": "ung_vien", "path_id": True, "dj": "/ung-vien/"}),
    ("don.html", "don.html", {"path_id": True, "dj": "/don/"}),
    ("khang_cao.html", "khang-cao.html", {"path_id": True, "dj": "/khang-cao/"}),
    ("vi_credit.html", "vi-credit.html", {"dj": "/vi-credit/"}),
    ("lich_ranh.html", "lich-ranh.html", {"dj": "/lich-ranh/"}),
    ("ngay_ban.html", "ngay-ban.html", {"dj": "/ngay-ban/"}),
    ("don_cua_toi.html", "don-cua-toi.html", {"dj": "/don-cua-toi/"}),
    ("admin_dashboard.html", "admin-dashboard.html", {"dj": "/admin-dashboard/"}),
]

# ------------------------------------------------ DJANGO TEMPLATE RENDER ---
INCLUDE_RE = re.compile(r"\{%\s*include\s+'frontend/([^']+)'\s*(?:with\s+([^%}]+))?\s*%\}")
IF_RE = re.compile(r"\{%\s*if\s+(.+?)\s*%\}")
URL_RE = re.compile(r"\{%\s*url\s+['\"]frontend:([a-z_0-9]+)['\"]\s*%\}")
COMMENT_RE = re.compile(r"\{%\s*comment\s*%\}[\s\S]*?\{%\s*endregion\s*%\}|\{%\s*comment\s*%\}[\s\S]*?\{%\s*endcomment\s*%\}")
STATIC_RE = re.compile(r"\{%\s*static\s+'([^']+)'\s*%\}")
LOAD_RE = re.compile(r"\{%\s*load\s+static\s*%\}")
CSRF_RE = re.compile(r"\{%\s*csrf_token\s*%\}")


def eval_cond(cond, ctx):
    cond = cond.strip()
    # Fail-loud: cú pháp chưa hỗ trợ phải phá build ngay, không được im lặng
    # chọn sai nhánh (bug âm thầm khó phát hiện hơn cả leak).
    if re.search(r"\b(and|not)\b", cond) or "|" in cond or "(" in cond:
        raise RuntimeError("điều kiện if chưa hỗ trợ: " + cond)
    for part in re.split(r"\s+or\s+", cond):
        part = part.strip()
        m = re.match(r"^([a-zA-Z_][a-zA-Z0-9_]*)\s*==\s*['\"]([^'\"]*)['\"]$", part)
        if m:
            if str(ctx.get(m.group(1), "")) == m.group(2):
                return True
            continue
        m = re.match(r"^([a-zA-Z_][a-zA-Z0-9_]*)\s*!=\s*['\"]([^'\"]*)['\"]$", part)
        if m:
            if str(ctx.get(m.group(1), "")) != m.group(2):
                return True
            continue
        if re.match(r"^[a-zA-Z_][a-zA-Z0-9_]*$", part) and ctx.get(part):
            return True
    return False


def render_dj(text, ctx, depth=0, cur_file=None):
    if depth > 8:
        raise RuntimeError("include quá sâu")

    def repl_include(m):
        fname, with_args = m.group(1), m.group(2) or ""
        if fname == cur_file:  # self-include (dead code trong template gốc) -> bỏ
            return ""
        sub_ctx = dict(ctx)
        for kv in re.finditer(
            r"([a-zA-Z_]+)=('[^']*'|[a-zA-Z_][a-zA-Z0-9_]*)(\|default:'[^']*')?",
            with_args,
        ):
            key, val, dflt = kv.group(1), kv.group(2), kv.group(3)
            if val.startswith("'"):
                sub_ctx[key] = val[1:-1]
            else:
                sub_ctx[key] = sub_ctx.get(val, "")
            if not sub_ctx.get(key) and dflt:
                sub_ctx[key] = dflt.split(":", 1)[1].strip("'")
        with open(os.path.join(SRC, fname), encoding="utf-8") as f:
            inc = f.read()
        return render_dj(inc, sub_ctx, depth + 1, fname)

    text = INCLUDE_RE.sub(repl_include, text)

    # --- if/elif/else/endif (hỗ trợ lồng, ngữ nghĩa Django đúng) ---
    # Fix bug P0 (audit 08/10/2026): bản cũ cắt thân nhánh TRUE từ sau "{% if "
    # thay vì sau toàn bộ tag mở "{% if ... %}" -> điều kiện + "%}" bị rò vào HTML
    # (115 điểm trên 28/44 trang). Bản cũ còn đọc lại điều kiện trong cửa sổ 200
    # ký tự (nguồn crash tiềm ẩn) và không hiểu {% elif %}.
    def process_ifs(s, c):
        out, pos = [], 0
        tag_re = re.compile(r"\{%\s*(if\b[^%]*|elif\b[^%]*|else|endif)\s*%\}")
        open_re = re.compile(r"\{%\s*if\s+([^%]+?)\s*%\}")
        while True:
            m_open = open_re.search(s, pos)
            if not m_open:
                out.append(s[pos:])
                break
            start, body_start = m_open.start(), m_open.end()  # thân if nằm SAU tag đủ
            depth_i = 1  # đang bên trong 1 if (tag mở đã nằm ngoài cửa sổ quét)
            end_of_tag = None
            branches = [(m_open.group(1).strip(), body_start, body_start)]
            m = None
            for m in tag_re.finditer(s, body_start):
                g = m.group(1)
                if g.startswith("if"):
                    depth_i += 1
                elif g == "endif":
                    depth_i -= 1
                    if depth_i == 0:
                        end_of_tag = m.end()
                        break
                elif depth_i == 1 and (g == "else" or g.startswith("elif")):
                    # đóng nhánh hiện tại, mở nhánh kế tiếp (else = điều kiện None)
                    branches[-1] = (branches[-1][0], branches[-1][1], m.start())
                    cond = None if g == "else" else g[4:].strip()
                    branches.append((cond, m.end(), m.end()))
            if end_of_tag is None:
                raise RuntimeError("if thiếu endif: " + s[start:start + 100])
            endif_tag_start = end_of_tag - len(m.group(0))
            branches[-1] = (branches[-1][0], branches[-1][1], endif_tag_start)
            # Django: chọn nhánh ĐẦU TIÊN thỏa (else luôn thỏa nếu tới lượt)
            chosen = ""
            for cond, b_from, b_to in branches:
                if cond is None or eval_cond(cond, c):
                    chosen = s[b_from:b_to]
                    break
            out.append(s[pos:start])
            out.append(process_ifs(chosen, c))
            pos = end_of_tag
        return "".join(out)

    text = process_ifs(text, ctx)

    def repl_url(m):
        name = m.group(1)
        if name not in URL_NAMES:
            raise RuntimeError("url name lạ: " + name)
        return URL_NAMES[name]

    text = URL_RE.sub(repl_url, text)
    text = COMMENT_RE.sub("", text)
    text = STATIC_RE.sub(r"../static/\1", text)
    text = LOAD_RE.sub("", text)
    text = CSRF_RE.sub("", text)
    # request.path -> path Django của trang hiện tại (bake lúc build)
    text = text.replace("{{ request.path }}", ctx.get("__dj_path__", "/"))
    # Biến {{ }} còn lại: giá trị từ ctx (gồm biến từ include ... with ...);
    # có |default:"x" thì x chỉ dùng khi biến rỗng — đúng ngữ nghĩa Django.
    # (Bản cũ luôn trả rỗng cho biến trần -> include chứa {{ var }} mất dữ liệu.)
    def _subst_var(m):
        name, dflt = m.group(1), m.group(2)
        val = str(ctx.get(name, ""))
        if not val and dflt:
            return dflt.split(":", 1)[1].strip("'\"")
        return val
    text = re.sub(r"\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)(\|default:[\"'][^\"']*[\"'])?\s*\}\}",
                  _subst_var, text)
    return text


# --------------------------------------------------- URL/API REWRITES ------
def path_to_page(url):
    """Path Django -> file .html. Route tĩnh ưu tiên trước route tham số;
    query/fragment giữ nguyên; id được encode; query nối bằng '&' (P1-4)."""
    if not url:
        return url
    if re.match(r"^(https?:|tel:|mailto:|data:|#|//)", url):
        return url
    if ".html" in url:
        return url
    frag = ""
    hi = url.find("#")
    if hi >= 0:
        frag = url[hi:]
        url = url[:hi]
    q = ""
    if "?" in url:
        url, q = url.split("?", 1)
        q = "?" + q
    if not url.endswith("/"):
        url += "/"
    m = re.match(r"^(/[a-z0-9-]+)/([^/]+)/$", url)
    if m and (m.group(1) + "/<id>/") in PATH_TO_PAGE:
        from urllib.parse import quote
        extra = "&" + q[1:] if q else ""
        return PATH_TO_PAGE[m.group(1) + "/<id>/"] + "?id=" + quote(m.group(2), safe="") + extra + frag
    if url in PATH_TO_PAGE:
        return PATH_TO_PAGE[url] + q + frag
    return None


def protect_api_concat(text):
    """Bảo vệ path literals đứng sau `API_BASE + '...'` khỏi bị rewrite nhầm."""
    store = []

    def repl(m):
        p = m.group(3)
        if p in PATH_TO_PAGE or p.rstrip("/") + "/" in {b.split("<id>/")[0] for b in PARAM_PREFIXES}:
            store.append(p)
            return m.group(1) + m.group(2) + "\x00%d\x00" % (len(store) - 1) + m.group(4)
        return m.group(0)

    text = re.sub(r"(API_BASE\s*\+\s*)(')(/[^']+)(')", repl, text)
    return text, store


def restore_api_concat(text, store):
    for i, p in enumerate(store):
        text = text.replace("\x00%d\x00" % i, p)
    return text


def rewrite_internal_urls(text):
    # 0) path có <id> — CHẠY TRƯỚC để không bị rule '/' đơn phá vỡ concat
    for pref, page in PARAM_PREFIXES.items():
        base = pref.split("<id>/")[0]
        esc = re.escape(base)
        text = re.sub(r"`" + esc + r"\$\{([^}]+)\}/`", "`" + page + "?id=${\\1}`", text)
        text = re.sub(r"'" + esc + r"\$\{([^}]+)\}/'", "'" + page + "?id=${\\1}'", text)
        text = re.sub(r'"' + esc + r"\$\{([^}]+)\}/\"", '"' + page + "?id=${\\1}\"", text)
        text = re.sub(
            r"'" + esc + r"'\s*\+\s*([A-Za-z0-9_.\[\]()])([A-Za-z0-9_.\[\]()]*?)\s*\+\s*'/'",
            "'" + page + "?id=' + \\1\\2", text)
    # 1) path không tham số — theo độ dài giảm dần (KHÔNG gồm '/' đơn)
    paths = sorted([p for p in PATH_TO_PAGE if "<id>" not in p and p != "/"], key=len, reverse=True)
    for p in paths:
        page = PATH_TO_PAGE[p]
        esc = re.escape(p)
        text = re.sub(r"(['\"`])" + esc + r"\?", r"\1" + page + "?", text)
        text = re.sub(r"(['\"`])" + esc + r"\1", r"\1" + page + r"\1", text)
        text = text.replace('href="' + p + '"', 'href="' + page + '"')
        text = text.replace("href='" + p + "'", "href='" + page + "'")
    return text


def rewrite_js_api(text):
    text = re.sub(r'const\s+API_BASE\s*=\s*["\']/api["\']\s*;',
                  "const API_BASE = window.API_BASE;", text)
    text = text.replace("const API_BASE = window.API_BASE || '/api';",
                        "const API_BASE = window.API_BASE;")
    # fetch('/api/..') -> fetch(window.__API_ORIGIN + '/api/..)
    # (__API_ORIGIN = '' ở dev (vite proxy), Render origin ở prod — không /api/api kép)
    text = re.sub(r"fetch\((['\"])((?:\\.|(?!\1).)*?)/api/",
                  r"fetch(window.__API_ORIGIN + \1/api/", text, flags=re.S)
    text = re.sub(r"fetch\(`((?:\\.|[^`])*?)/api/", r"fetch(`${window.__API_ORIGIN}/api/",
                  text, flags=re.S)
    return text


def rewrite_js_navigation(text):
    text = text.replace("window.location.href = nextUrl;",
                        "window.location.href = window.__edcToPage(nextUrl);")
    text = re.sub(r"window\.location\.href\s*=\s*nextUrl\b([^;]*);",
                  r"window.location.href = window.__edcToPage(nextUrl\1);", text)
    text = re.sub(r"window\.location\.href\s*=\s*href\s*;",
                  "window.location.href = window.__edcToPage(href);", text)
    # Google OAuth url động -> shell mở ngoài (iframe không nhúng được Google)
    text = text.replace("window.location.href = data.auth_url;",
                        "try { parent.postMessage({ type: 'edc-external', url: data.auth_url }, '*'); } catch (e) {}")
    return text


def rewrite_path_id_pages(text):
    text = text.replace(
        "window.location.pathname.split('/').filter(Boolean)[1]",
        "new URLSearchParams(window.location.search).get('id')")
    return text


CDN_SCRIPT_RE = re.compile(
    r'[ \t]*<script src="https://cdn\.tailwindcss\.com"></script>\s*'
    r'(?:<script[^>]*>\s*tailwind\.config[\s\S]*?</script>)?', re.I)


def strip_cdn(text, css_name):
    link = '    <link rel="stylesheet" href="../static/css/cdn-%s.css"/>' % css_name
    text, n = CDN_SCRIPT_RE.subn(link + "\n", text)
    if n == 0:
        text, n = re.subn(r'<script src="https://cdn\.tailwindcss\.com"></script>',
                          link, text)
    return text, n


BOOTSTRAP_TAG = '<script src="../static/js/edc-bootstrap.js"></script>'


def inject_head(text):
    idx = text.find("<head>")
    if idx < 0:
        raise RuntimeError("không thấy <head>")
    pos = idx + len("<head>")
    return text[:pos] + "\n" + BOOTSTRAP_TAG + text[pos:]


def rel_static(text):
    text = text.replace('"/static/', '"../static/')
    text = text.replace("'/static/", "'../static/")
    text = text.replace('(`/static/', '(`../static/')
    return text


# ------------------------------------------------------------------ MAIN ---
def main():
    os.makedirs(OUT, exist_ok=True)
    errors, report = [], []
    for tpl, out_name, cfg in PAGES:
        with open(os.path.join(SRC, tpl), encoding="utf-8") as f:
            raw = f.read()

        dj_path = cfg.get("dj", "/")
        ctx = {"__dj_path__": dj_path}
        try:
            html = render_dj(raw, ctx, 0, tpl)
        except Exception as e:
            errors.append("%s: render fail: %s" % (tpl, e))
            continue

        html, api_store = protect_api_concat(html)
        html = rewrite_internal_urls(html)
        html = restore_api_concat(html, api_store)
        html = rewrite_js_api(html)
        html = rewrite_js_navigation(html)
        if cfg.get("path_id"):
            html = rewrite_path_id_pages(html)
        if cfg.get("cdn"):
            html, n = strip_cdn(html, cfg["cdn"])
            if n == 0:
                errors.append("%s: không bỏ được Tailwind CDN" % tpl)
        html = rel_static(html)
        try:
            html = inject_head(html)
        except Exception as e:
            errors.append("%s: inject fail: %s" % (tpl, e))
            continue

        # ---- verify ----
        leftovers = []
        # Bất biến chống mảnh điều kiện cụt (bug P0 audit 08/10/2026): "%}" lẻ
        # loi không thuộc tag {% ... %} nào. Loại trừ %} đứng sát sau chữ số/%
        # (CSS/JS hợp lệ kiểu "100%}" không bị báo nhầm).
        leak_spans = [(m.start(), m.end()) for m in re.finditer(r"\{%[\s\S]*?%\}", html)]
        for m in re.finditer(r"(?<![0-9%])%\}", html):
            if not any(a <= m.start() < b for a, b in leak_spans):
                ctx_snip = html[max(0, m.start() - 45):m.start()].replace("\n", " ")[-45:]
                leftovers.append("LEAK: ..." + ctx_snip + "%}")
        for m in list(re.finditer(r"\{%[\s\S]{0,80}?%\}", html))[:5]:
            leftovers.append("DJANGO: " + m.group(0)[:60])
        for m in list(re.finditer(r"\{\{[^}]{0,60}\}\}", html))[:3]:
            leftovers.append("VAR: " + m.group(0)[:60])
        for m in re.finditer(
            r"(?:location\.href\s*=\s*|location\.assign\(\s*|location\.replace\(\s*)"
            r"(['\"])(/api?/[a-z][^'\"]*|/[a-z][^'\"]*)\1", html):
            leftovers.append("REDIRECT: " + m.group(0)[:80])
        for m in re.finditer(r"href=\"(/[a-z][^\"]*)\"", html):
            leftovers.append("HREF: " + m.group(0)[:80])
        if "cdn.tailwindcss.com" in html:
            leftovers.append("CDN tailwind còn sót")
        if leftovers:
            errors.append("%s -> %s: %s" % (tpl, out_name, " | ".join(leftovers[:6])))

        with open(os.path.join(OUT, out_name), "w", encoding="utf-8") as f:
            f.write(html)
        report.append("%-38s -> %-32s %5dKB%s" % (
            tpl, out_name, len(html) // 1024, " [CDN]" if cfg.get("cdn") else ""))

    print("\n".join(report))
    print("\nTổng: %d trang -> %s" % (len(report), OUT))
    if errors:
        print("\n!!! LỖI / CẢNH BÁO (%d):" % len(errors))
        for e in errors:
            print("  -", e)
        sys.exit(1)
    print("OK: 0 lỗi")


if __name__ == "__main__":
    main()
