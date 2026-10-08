#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Regression tests cho compiler Django-template của EduCareLink Zalo.
Sinh ra từ audit QA 08/10/2026 (bug P0: render_dj làm rò điều kiện Django
vào HTML — 115 điểm trên 28/44 trang).

Chạy:  python3 -m unittest tests.test_port_pages -v
(Chỉ dùng stdlib — không cần cài thêm gì.)
"""
import os
import re
import sys
import unittest

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(REPO_ROOT, "scripts"))

import port_pages  # noqa: E402

SRC_GOC = os.path.join(
    os.path.dirname(REPO_ROOT),
    "educarelink-backend-4-12-2026", "frontend", "templates", "frontend",
)


def render(text, ctx=None):
    return port_pages.render_dj(text, dict(ctx or {}), 0, None)


class TestProcessIfs(unittest.TestCase):
    """Ngữ nghĩa if/elif/else/endif — case audit ở test đầu tiên."""

    def test_case_audit_qa_if_true_co_else(self):
        """Case gốc QA: nhánh TRUE không được rò 'điều kiện %}' vào output."""
        html = "<div>{% if active_tab == 'home' %}HOME{% else %}OTHER{% endif %}</div>"
        self.assertEqual(render(html, {"active_tab": "home"}), "<div>HOME</div>")

    def test_if_false_chay_else(self):
        html = "<div>{% if active_tab == 'home' %}HOME{% else %}OTHER{% endif %}</div>"
        self.assertEqual(render(html, {"active_tab": "messages"}), "<div>OTHER</div>")

    def test_if_true_khong_else(self):
        self.assertEqual(render("{% if flag %}XY{% endif %}", {"flag": True}), "XY")

    def test_if_false_khong_else(self):
        self.assertEqual(render("{% if flag %}XY{% endif %}", {"flag": False}), "")

    def test_if_false_khong_else_giup_ngu_canh(self):
        html = 'a{% if tab == "x" %}X{% endif %}b'
        self.assertEqual(render(html, {}), "ab")

    def test_if_long_true_true(self):
        html = "{% if a %}A{% if b %}B{% endif %}C{% endif %}D"
        self.assertEqual(render(html, {"a": True, "b": True}), "ABCD")

    def test_if_long_true_false(self):
        html = "{% if a %}A{% if b %}B{% else %}N{% endif %}C{% endif %}D"
        self.assertEqual(render(html, {"a": True, "b": False}), "ANC D".replace(" ", ""))

    def test_if_ngoai_false_bo_quen_long(self):
        html = "{% if a %}A{% if b %}B{% endif %}{% else %}E{% endif %}"
        self.assertEqual(render(html, {"a": False}), "E")

    def test_elif_chon_nhanh_thu_hai(self):
        html = "{% if a %}A{% elif b %}B{% else %}C{% endif %}"
        self.assertEqual(render(html, {"a": False, "b": True}), "B")

    def test_elif_chon_else_khi_khong_nao_thoa(self):
        html = "{% if a %}A{% elif b %}B{% else %}C{% endif %}"
        self.assertEqual(render(html, {}), "C")

    def test_elif_nhanh_dau_thang(self):
        html = "{% if a %}A{% elif b %}B{% endif %}"
        self.assertEqual(render(html, {"a": True, "b": True}), "A")

    def test_else_cua_if_long_khong_nham_cho_if_ngoai(self):
        html = "{% if a %}{% if b %}B{% else %}B-ELSE{% endif %}{% endif %}"
        self.assertEqual(render(html, {"a": True, "b": False}), "B-ELSE")

    def test_dieu_kien_or(self):
        html = ("{% if active_tab == 'profile' or active_tab == 'settings' %}"
                "ON{% else %}OFF{% endif %}")
        self.assertEqual(render(html, {"active_tab": "settings"}), "ON")
        self.assertEqual(render(html, {"active_tab": "home"}), "OFF")

    def test_dieu_kien_khac_biet_gia_tri(self):
        html = "{% if t != 'feed' %}A{% else %}B{% endif %}"
        self.assertEqual(render(html, {"t": "home"}), "A")
        self.assertEqual(render(html, {"t": "feed"}), "B")

    def test_fail_loud_dieu_kien_and_chua_ho_tro(self):
        with self.assertRaises(RuntimeError):
            render("{% if a and b %}X{% endif %}", {})

    def test_fail_loud_dieu_kien_chua_dong_endif(self):
        with self.assertRaises(RuntimeError):
            render("{% if a %}X", {"a": True})


class TestRenderOutputKhongLeak(unittest.TestCase):
    """Bất biến: output không được còn mảnh Django (orphan %} / {% / {{)."""

    def test_khong_con_orphan(self):
        html = render("{% if t == 'feed' %}<i class='x y'>{% endif %}", {"t": "feed"})
        self.assertNotIn("%}", html)
        self.assertNotIn("{%", html)
        self.assertNotIn("{{", html)


@unittest.skipUnless(
    os.path.isdir(SRC_GOC),
    "cần repo gốc educarelink-backend-4-12-2026 nằm cạnh repo zalo (chỉ đọc)",
)
class TestIncludeThatTeu(unittest.TestCase):
    """Include với with literal / biến / default filter (đúng cú pháp template thật).

    Dùng thư mục tạm làm SRC — tuyệt đối không ghi gì vào repo gốc (chỉ đọc).
    """

    def setUp(self):
        import shutil
        import tempfile
        self._src = port_pages.SRC
        self._tmp = tempfile.mkdtemp(prefix="edc_tpl_test_")
        port_pages.SRC = self._tmp

    def tearDown(self):
        port_pages.SRC = self._src
        import shutil
        shutil.rmtree(self._tmp, ignore_errors=True)

    def _ghi_inc(self, noi_dung):
        with open(os.path.join(self._tmp, "_mini_inc_test.html"), "w",
                  encoding="utf-8") as f:
            f.write(noi_dung)

    def test_include_with_literal(self):
        self._ghi_inc("[{{ active_tab }}]")
        html = render(
            "{% include 'frontend/_mini_inc_test.html' with active_tab='feed' %}",
            {})
        self.assertEqual(html, "[feed]")

    def test_include_ke_thua_ctx_va_default(self):
        self._ghi_inc("[{{ tab|default:'feed' }}]")
        html = render(
            "{% include 'frontend/_mini_inc_test.html' with tab=active_tab %}",
            {"active_tab": ""})
        self.assertEqual(html, "[feed]")


class TestPathToPage(unittest.TestCase):
    """P1-4: route tĩnh ưu tiên trước route tham số; query nối bằng '&'."""

    def test_route_tinh_2_segment(self):
        self.assertEqual(port_pages.path_to_page("/parent/tasks/"), "parent-tasks.html")
        self.assertEqual(port_pages.path_to_page("/worker/my-jobs/"), "worker-jobs.html")
        self.assertEqual(port_pages.path_to_page("/parent/review/"), "review.html")

    def test_route_tinh_giu_query(self):
        self.assertEqual(
            port_pages.path_to_page("/parent/tasks/?page=2"),
            "parent-tasks.html?page=2")

    def test_route_tham_so_va_query_dau_and(self):
        self.assertEqual(
            port_pages.path_to_page("/don/abc/?mode=preview"),
            "don.html?id=abc&mode=preview")
        self.assertEqual(
            port_pages.path_to_page("/ung-vien/42/"), "ung-vien.html?id=42")

    def test_route_1_segment(self):
        self.assertEqual(port_pages.path_to_page("/"), "splash.html")
        self.assertEqual(port_pages.path_to_page("/login/?next=/parent/"),
                         "login.html?next=/parent/")


if __name__ == "__main__":
    unittest.main(verbosity=2)
