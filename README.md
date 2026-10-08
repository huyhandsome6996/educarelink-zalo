# EduCareLink Zalo Mini App — chuẩn UI React Native

**Chuẩn duy nhất**: React Native `mobile/src/` của repo READ-ONLY `huyhandsome6996/educarelink-backend-4-12-2026` (commit `f4a28806`). Django web templates KHÔNG còn là chuẩn UI (kiến trúc iframe/port_pages đã loại khỏi build).

## Kiến trúc
React 18 SPA (zmp-vite-plugin, output `src/www/`) — hash router `#/Tab/Route?params` mô phỏng react-navigation (nested stack per tab, modal, popstate back), theme tokens nguyên văn từ `mobile/src/theme/colors.js`, Ionicons SVG thật (159 glyph), API client với JWT refresh queue như `mobile/src/api/client.js`.

## Lệnh
```bash
npm install          # cài deps
npm run validate     # typecheck + build production
npm test             # 132 assertion RN-parity (hash router unit test + source contract)
npm start            # zmp start (dev, proxy /api -> Render)
npm run qa:server    # serve src/www + proxy /api (QA browser 390x844)
```

## Tài liệu
- `docs/mobile-parity-map.md` — bản đồ 60 route RN → Zalo, polling matrix, platform adaptations, giới hạn.
- `docs/PORTING_CONVENTIONS.md` — quy ước port style RN → CSS 1:1.
- `docs/PATCH_CORS_BACKEND.md` — CORS prod BLOCKED (chờ chủ backend whitelist origin Zalo).

## Deploy Zalo
`zmp login` → `zmp deploy` (bundle `src/www/`). Khai báo domain `educarelink-backend.onrender.com` trong **API List / Trusted domains** trên Zalo Developer Console.
