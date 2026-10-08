# EduCareLink — Zalo Mini App 🚀

**Bản copy Y XÌ giao diện web gốc** (repo `educarelink-backend-4-12-2026`) đóng gói thành Zalo Mini App, đấu nối thẳng API Render thật. Không vẽ lại UI, không "diễn giải" thiết kế — từng trang là file HTML gốc chạy nguyên vẹn trong iframe của shell.

![EduCareLink](https://img.shields.io/badge/Zalo-Mini%20App-F26522) ![API](https://img.shields.io/badge/API-Render_Live-10B981) ![Build](https://img.shields.io/badge/vite%20build-passing-2DB84B)

## 🏗️ Kiến trúc (v2 — copy y xì)

```
src/
├── index.html            # Entry ZMP (fonts + #app)
├── app.ts                # Mount shell
├── components/layout.tsx # Shell mỏng: status-bar + iframe + bridge
├── css/shell.css         # Style của SHELL (rất mỏng)
└── public/               # === BẢN COPY Y XÌ TỪ REPO GỐC ===
    ├── pages/*.html      # 44 trang = template Django gốc đã biên dịch
    └── static/           # css/js/images/sounds copy nguyên vẹn
        └── css/cdn-*.css # 12 file precompiled từ inline Tailwind config gốc
```

- **Shell** (`layout.tsx`): chỉ lo phần hệ thống Mini App — chừa status bar, iframe full-screen chạy các trang, đồng bộ hash, mở link ngoài qua `openWebview`, relay lỗi.
- **Trang** (`public/pages/*.html`): mỗi trang = template gốc (`frontend/templates/frontend/*.html`) đã thay thế bắt buộc:
  1. Django tags: `{% url %}` → file html tương ứng; `{% static %}` → `../static/...`; `{% include %}`/`{% if %}` được render sẵn
  2. Path nội bộ `/parent/tasks/` → `parent-tasks.html` (kể cả trong JS, template literal, onclick)
  3. API base: dev = proxy tương đối (`/api`), prod = `https://educarelink-backend.onrender.com` (tự nhận qua `edc-bootstrap.js`)
  4. Tailwind CDN (12 trang) → CSS precompiled bằng đúng inline config gốc (`scripts/build_cdn_css.py`)
- **Auth & dữ liệu**: giữ nguyên cơ chế gốc — `localStorage` (`token`, `refresh_token`, `role`), `apiFetch` tự refresh JWT, mọi fetch gọi thẳng API Render. Đăng nhập bằng tài khoản demo (`phuhuynh_test` / `Demo@2026`) hoạt động end-to-end.

## 🔄 Regenerate (khi repo gốc thay đổi)

```bash
# Repo gốc clone cạnh repo này tại ../educarelink-backend-4-12-2026 (CHỈ ĐỌC)
python3 scripts/port_pages.py       # 44 template -> src/public/pages
python3 scripts/build_cdn_css.py    # 12 trang CDN -> css precompiled
python3 scripts/check_css_coverage.py  # kiểm tra phủ CSS
npx vite build                      # -> src/www
python3 scripts/dev_server.py 3000  # dev: serve www + proxy /api -> Render
```

## 📱 44 trang được copy

Splash (landing), Login, Register, Onboarding (Parent/Worker), Parent Home, Tasks, Task Detail, Candidate Profile, Browse Candidates, Task Create 1/2, Đăng việc (Select/Gia sư/Trong trẻ/Đón trẻ), Ứng viên, Đơn, Kháng cáo, Review, Tracking (Leaflet + Geofence), Notifications, Chat, Chatbot (Parent/Worker), Worker Feed/Jobs/Profile/Availability/Earnings/Complaints/Care Diary, Parent Profile/Payments/Care Diary, Ví credit, Lịch rảnh, Ngày bận, Đơn của tôi, Help Center, Admin Dashboard, Site Gate.

## 🔌 API Backend

Production: `https://educarelink-backend.onrender.com/api/` — Dev: dùng relative `/api` qua `scripts/dev_server.py` hoặc vite proxy (không CORS).

| Nhóm | Endpoint |
|---|---|
| Auth | `POST auth/login/`, `POST auth/register/`, `POST auth/token/refresh/`, `GET profile/` |
| Tasks | `GET/POST tasks/`, `GET tasks/<id>/`, `PATCH tasks/<id>/status/` |
| Matching | `GET/POST matching/jobs/`, `matching/bookings/`, `matching/geocode/*` |
| Parent | `parent/my-tasks/`, `parent/applications/<id>/approve/`, `parent/review/` |
| Carepartner | `worker/tasks/<id>/apply/`, `worker/my-jobs/`, `payments/my-earnings/` |
| Chatbot | `POST chatbot/`, `POST worker/chatbot/` |
| Tracking | `GET tracking/<id>/live/`, `POST tracking/location/`, `POST tracking/sos/` |
| Notifications | `GET notifications/`, `GET notifications/unread-count/`, `POST notifications/mark-read/` |

## 🚀 Deploy lên Zalo

```bash
npm install
npx vite build      # xuất src/www
zmp login           # tài khoản Zalo Developer
zmp deploy          # đẩy bundle (src/www) lên Zalo
```

> Lưu ý: nhớ khai báo domain `educarelink-backend.onrender.com` trong phần **API List / Trusted domains** của app trên Zalo Developer Console để các request API hoạt động trên bản production.
