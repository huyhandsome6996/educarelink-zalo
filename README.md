# EduCareLink — Zalo Mini App 🚀

**Nền tảng kết nối Chăm sóc & Giáo dục trẻ em** trên Zalo Mini App. Sao chép 1:1 design system từ bản mobile prototype gốc, đấu nối toàn bộ API REST backend thật.

![EduCareLink](https://img.shields.io/badge/Zalo-Mini%20App-F26522) ![API](https://img.shields.io/badge/API-Render_Live-10B981) ![Build](https://img.shields.io/badge/vite%20build-passing-2DB84B)

## 🎨 Design System (chuẩn prototype gốc)

| Token | Giá trị | Token | Giá trị |
|---|---|---|---|
| `--primary` | `#F26522` | `--bg` | `#F7F7F7` |
| `--primary-dark` | `#D4541E` | `--surface` | `#FFFFFF` |
| `--primary-light` | `#FFF4ED` | `--text-primary` | `#1A1A2E` |
| `--primary-soft` | `#FFCFB3` | `--text-secondary` | `#6B7280` |
| Secondary | `#2DB84B` / `#10B981` | Font body | **Plus Jakarta Sans** |
| Warning | `#F59E0B` | Font headings | **Manrope** |
| Error / Info | `#EF4444` / `#3B82F6` | Icons | Material-style SVG |

## 📱 Danh sách màn hình (1:1 với prototype)

- **Splash Screen** — logo khiên + mũ tốt nghiệp, progress bar, chuyển cảnh mượt
- **Login** — tab chuyển vai trò Phụ huynh/Carepartner, input icon, eye-toggle mật khẩu, nút gradient, social login Google/Facebook
- **Register** — thẻ chọn vai trò, upload CCCD 2 mặt + ảnh chân dung + bằng cấp (preview), trường trường ĐH
- **Parent Home** — header gradient cam, chuông thông báo chấm đỏ, tìm kiếm + lọc, 6 danh mục tròn, banner ĐĂNG VIỆC NGAY, Công việc của bạn (badge giá), Carepartner nổi bật (ĐH Sư Phạm, Bách Khoa…)
- **Parent Tasks** — tab lọc trạng thái, thao tác nhanh: Xem ứng viên / Giám sát Live / Chấm điểm
- **Candidates** — badge hạng (Đồng/Bạc/Vàng/Kim Cương), ghi chú ứng tuyển, nút "Duyệt Carepartner này"
- **Task Detail** — hero gradient, bản đồ mô phỏng Geofence, mức lương nổi bật
- **Worker Feed** — bảng tin việc, huy hiệu "AI Match %", lọc danh mục, Ứng tuyển ngay
- **Worker Jobs** — công tắc GPS Live thật (heartbeat 30s → POST /tracking/location/), widget thu nhập real-time
- **Worker Profile** — profile ring đánh giá, thống kê việc làm, chứng chỉ CCCD, Ví thu nhập EduCareLink
- **AI Chatbot** — Gemini real-time, bubble chat, quick reply pills
- **Modals** — Create Task (AI gợi ý mô tả), Review (1–5 sao + tag nhanh), Tracking (radar Geofence 500m + SOS), Notifications

## 🔌 API Backend

Production: `https://educarelink-backend.onrender.com/api/` — Dev: dùng relative `/api` qua Vite proxy (không CORS).

| Nhóm | Endpoint |
|---|---|
| Auth | `POST auth/login/`, `POST auth/register/`, `POST auth/token/refresh/`, `GET profile/` |
| Tasks | `GET/POST tasks/`, `GET tasks/<id>/`, `PATCH tasks/<id>/status/` |
| Parent | `GET parent/my-tasks/`, `GET parent/tasks/<id>/candidates/`, `POST parent/applications/<id>/approve/`, `POST parent/review/` |
| Worker | `POST worker/tasks/<id>/apply/`, `GET worker/my-jobs/`, `GET payments/my-earnings/` |
| AI | `POST chatbot/`, `POST worker/chatbot/` (key `message`) |
| Tracking | `GET tracking/<id>/live/`, `POST tracking/location/`, `POST tracking/sos/`, `GET tracking/<id>/device-status/` |
| Notifications | `GET notifications/`, `GET notifications/unread-count/`, `POST notifications/mark-read/` |

### Tài khoản kiểm thử (mật khẩu: `Demo@2026`)

| Vai trò | Username |
|---|---|
| Phụ huynh | `phuhuynh_test` |
| Carepartner | `sinhvien_test` |
| Admin | `admin` |

## 🛠️ Phát triển

### Cách 1: Zalo Mini App Extension (VS Code)
1. Cài [Zalo Mini App Extension](https://mini.zalo.me/docs/dev-tools)
2. **Config App ID** → **Install Dependencies** → **Start**

### Cách 2: CLI
```bash
npm install
zmp start        # mở http://localhost:3000
npx vite build   # build production vào thư mục www/
```

> 💡 Mẹo QA: màn hình Đăng nhập có nút **1-Click** vào nhanh tài khoản demo; màn Tài khoản có công tắc đổi vai trò và trình đơn cấu hình API (Render/Local/Proxy).

## 📦 Cấu trúc mã nguồn

```
src/
├── app.ts                  # Entry — mount React
├── components/             # AppHeader, BottomNav, SplashScreen,
│                           # CreateTask/Candidate/Review/Tracking/Detail modals...
├── pages/                  # index (router+splash), welcome-auth,
│                           # parent-home, parent-tasks, worker-feed,
│                           # worker-jobs, ai-chat, profile
├── services/
│   ├── api.ts              # JWT refresh tự động, fallback chain, timeouts
│   └── mockData.ts         # Dữ liệu demo khi backend offline
├── state/auth.ts           # jotai auth store + demo login
├── types/index.ts          # Kiểu dữ liệu khớp 100% response thật
└── css/app.scss            # Design tokens + animations (radar, shimmer…)
```
