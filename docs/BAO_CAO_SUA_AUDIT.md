# BÁO CÁO SỬA LỖI AUDIT QA 08/10/2026 — educarelink-zalo

> **Branch:** `fix/zalo-web-parity-api` (chưa merge main — chờ QA duyệt)
> **Audit đầu vào:** `Kiem_thu_EducareLink_Zalo_va_prompt_sua.md` (Zalo `b80e563`, gốc `f4a28806`)
> **Commit bắt đầu fix:** `77d6ec5` (trên nền đúng commit audit, không đè thay đổi ai)
> **Repo gốc:** chỉ đọc tuyệt đối — 0 byte thay đổi (kiểm chứng bằng `git status` mỗi bước)

## Tổng kết

| # | Lỗi audit | Mức | Trạng thái | Commit |
|---|---|---|---|---|
| 1 | Compiler rò điều kiện Django vào HTML (28/44 trang) | P0 | ✅ **ĐÃ SỬA — 44/44 trang sạch** | `77d6ec5` |
| 2 | 5 file JS dùng chung gọi `/api/...` tương đối | P0 | ✅ **ĐÃ SỬA (fetch wrapper toàn cục + 3 chỗ điều hướng)** | `9fd792c` |
| 3 | CORS thiếu origin Zalo | P0 | ⛔ **BLOCKED — backend sửa** (patch sẵn: `docs/PATCH_CORS_BACKEND.md`) | `a3f9aab` |
| 4 | `__edcToPage` route/query sai | P1 | ✅ **ĐÃ SỬA (cả runtime + compiler)** | `9fd792c` + `77d6ec5` |
| 5 | Đường dẫn máy tác giả trong scripts/config | P1 | ✅ **ĐÃ SỬA — repo 0 đường dẫn cứng** | `e5cde1e` |

## Chi tiết từng fix

### 1. P0-1 — Compiler rò điều kiện (commit `77d6ec5`)

- **Nguyên nhân:** `process_ifs` cắt thân nhánh TRUE từ sau `{% if ` thay vì sau tag mở
  đầy đủ `{% if ... %}`; đọc lại điều kiện trong cửa sổ 200 ký tự (nguồn crash); không hiểu `{% elif %}`.
- **Fix:** quét lại bằng full open tag `({%\s*if\s+([^%]+?)\s*%\})`, thân nhánh bắt đầu sau
  tag đủ; hỗ trợ elif/else với depth đúng; fail-loud với cú pháp chưa hỗ trợ (`and`, `not`,
  filter, ngoặc) thay vì im lặng chọn sai nhánh; bỏ cửa sổ 200 ký tự.
- **Bất biến mới trong verify build:** `%}` lẻ loi không thuộc tag nào (loại trừ `%}` sát
  chữ số — CSS hợp lệ kiểu `100%}`) → build FAIL ngay nếu có rò rỉ.
- **Lỗi phát hiện thêm khi làm:** biến `{{ var }}` trần luôn bị thay bằng rỗng (kể cả trong
  include có `with`) — đã sửa theo ngữ nghĩa Django (`|default` chỉ dùng khi biến rỗng).
- **Kết quả:** 44/44 trang đã emit + serve qua HTTP **0 mảnh Django** (script quét
  `scripts/scan_leak_pages.py`); các chỗ QA chỉ ra (parent-home L218–223, worker-feed
  L250–255 + L427–429 bottom nav) giờ render class `active`/`filled`/`font-bold` thật.

### 2. P0-2 — API origin cho JS dùng chung (commit `9fd792c`)

- **Chọn phương án:** bọc `fetch` toàn cục trong `edc-bootstrap.js` (chạy trước mọi script —
  được compiler chèn ngay sau `<head>`). Wrapper chỉ đổi string bắt đầu đúng bằng `/api/`;
  Request/URL tuyệt đối passthrough. Lý do: 5 file JS là bản copy nguyên xi từ repo gốc —
  sửa tay từng file sẽ lệch parity và bị ghi đè khi port lại; 1 điểm fix phủ cả 9 call-site.
- **Phát hiện thêm ngoài audit:** 3 dòng `window.location.href = '/worker/my-jobs/'` trong
  `job_assigned_alert.js` (L128/192/266) cũng chết ở prod → đã chuyển qua `__edcToPage`.
- **Contract giữ nguyên:** không đụng endpoint/method/payload/JWT/refresh; dev vẫn `/api`
  tương đối (proxy) — hành vi cũ không đổi.

### 3. P1-4 — Routing (commit `9fd792c` + `77d6ec5`)

- `__edcToPage` (runtime): **route tĩnh ưu tiên trước tham số**; tham số chỉ nhận whitelist
  `/ung-vien/`, `/don/`, `/khang-cao/` (đúng `frontend/urls.py`) — hết tình trạng nuốt
  mọi path 2 đoạn thành id; query nối bằng `&`; giữ fragment; `encodeURIComponent(id)`.
  Fix đúng 4 case audit + toàn bộ case agent phát hiện thêm (~20 route 2 đoạn sai).
- `path_to_page` (compiler): cùng logic (dù là hàm chết — sửa để giữ parity).

### 4. P1-5 — Đường dẫn + exit code + tooling (commit `e5cde1e`)

- 3 script python: mọi đường dẫn từ `Path(__file__)` + override `$EDUCARELINK_SRC`/`--src`
  → chạy được mọi checkout Windows/Linux.
- `build_cdn_css.py`: tailwind fail / thiếu output / probe fail → **exit nonzero** (bản cũ
  exit 0 dù CSS hỏng); `npx` resolve qua `shutil.which`; config sinh ra dùng content path
  tương đối (cwd=REPO_ROOT) → 12 file config **commit-safe**, không bake đường dẫn máy.
- `port_pages.py`: thêm argparse (`--src --out --only --help`), lỗi thiếu repo gốc báo rõ.
- `check_css_coverage.py`: fix bug tách pseudo-selector (`::before`/`:hover` làm báo thiếu
  ảo) + giữ dấu chấm escape (`p-2\.5`); bổ sung đủ 44 trang vào CHECKS.
- `package.json`: `build/typecheck/validate/port:pages/css:build/css:check/regen/test` +
  devDependency `typescript` (lockfile đồng bộ bằng `npm install`).
- `src/global.d.ts`: khai báo `Window.APP_CONFIG/__API_ORIGIN/API_BASE/__edcToPage` →
  `tsc --noEmit` pass (trước đó 2 lỗi `TS2339`).
- `zmp-cli.json`: xoá metadata `cwd` máy khác.

### 5. P0-3 — CORS (⛔ BLOCKED — ngoài quyền sửa frontend)

Đã test live đầy đủ (bảng trong `docs/PATCH_CORS_BACKEND.md`): origin `https://h5.zdn.vn`
bị từ chối ACAO; origin whitelist (`localhost:8000`) nhận đầy đủ → corsheaders chạy đúng,
chỉ thiếu entry. **Frontend không tự chữa được** (no-cors/proxy/TLS đều bất khả thi —
phân tích trong file). Đã soạn patch tối thiểu + 4 lệnh curl verify cho chủ backend.
Dev + QA local không bị ảnh hưởng (proxy same-origin).

## Phân loại CSS coverage (488 cảnh báo heuristic, exit 2)

Audit yêu cầu KHÔNG sửa CSS chỉ để coverage pass. Đã đối chứng parity từng nhóm:

- `pr-3`, `max-w-3xl`, `sm:grid-cols-4`, `lg:py-10`, `font-black`, `accent-primary`,
  `mr-3`, `sm:flex-none`…: **không có trong CSS của BẢN GỐC** (4 file CSS là bản copy
  blob-SHA giống hệt) → lỗi vốn có gốc, giữ nguyên y xì ✅
- `meal-name`, `act-desc`, `empty-subtitle`…: class hook JS / render động — không phải
  CSS tĩnh ✅
- Kết luận: 0 cảnh báo = chênh lệch do port. Không thêm style nào.

## Kiểm thử đã chạy (trước khi commit)

| Kiểm tra | Kết quả |
|---|---|
| `python3 -m unittest discover -s tests` (23 case: true/false/nested/elif/include/default/or/!=/fail-loud/path_to_page) | ✅ OK |
| `node tests/test_routing.mjs` (28 case: routing tĩnh/tham số/query/fragment + fetch wrapper dev/prod) | ✅ OK |
| `npm run typecheck` (tsc --noEmit) | ✅ 0 lỗi |
| `npm run build` (vite, 297 module) | ✅ 0 lỗi |
| `npm ci` + lockfile sync sau khi thêm typescript | ✅ |
| `build_cdn_css.py` 12 CSS — output **byte-identical** với bản cũ (đủ chứng minh determinism) | ✅ |
| Quét 44 trang SERVED qua HTTP: mảnh Django cụt | ✅ 44/44 sạch (`scripts/scan_leak_pages.py`) |
| **E2E browser thật** (viewport 390×844, dev server + proxy → Render): splash → login **thật** `phuhuynh_test/Demo@2026` → token lưu → redirect parent-home | ✅ (ảnh qa-evidence/fix-01…03) |
| E2E parent-home: `.psb-nav-item.active` render thật + 0 leak + dữ liệu thật | ✅ (fix-03) |
| E2E click "Xem tất cả" → parent-tasks: 0 leak + dữ liệu | ✅ (fix-04) |
| E2E worker-feed: 0 leak + active classes | ✅ (fix-05) |
| E2E `don.html?id=test-123&mode=preview`: cả 2 param giữ nguyên | ✅ (fix-06) |
| E2E chatbot + notifications (API thật, poll 30s): 0 leak | ✅ (fix-07, 08) |
| Console error trong các luồng trên | ✅ 0 (chỉ warning flatpickr locale có sẵn ở bản gốc) |

## Chưa kiểm / cần chủ dự án

- **Zalo Android/iOS thật** (safe-area, webview storage, Back/deep-link) — cần deploy bundle;
  khuyến nghị chỉ deploy sau khi CORS đã được backend sửa, vì không backend patch thì prod
  không gọi được API.
- Screenshot diff pixel-perfect so Django baseline: cần render baseline từ chính backend
  Django (không khả dụng từ máy này). Đã thay bằng bất biến cấu trúc (0 mảnh Django +
  CSS byte-identical + DOM class active thật).
- CORS BLOCKED — chờ chủ backend áp `docs/PATCH_CORS_BACKEND.md` rồi chạy 4 lệnh curl.
