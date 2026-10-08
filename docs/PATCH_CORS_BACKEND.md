# PATCH CORS TỐI THIỂU CHO BACKEND — EduCareLink (báo cáo cho chủ dự án)

> **Tác giả:** agent fix educarelink-zalo • **Ngày:** 08/10/2026
> **Trạng thái:** ⛔ **BLOCKED — prod Zalo chưa gọi được API cho tới khi patch này được áp**
> Repo backend là tài sản của nhóm khác — agent **không tự ý sửa**. Đơn vị phụ trách
> backend vui lòng áp patch dưới đây rồi verify bằng 4 lệnh curl ở cuối file.

## 1. Bằng chứng (test live 08/10/2026)

Preflight từ origin Mini App trên Zalo **KHÔNG** được cấp quyền:

```http
OPTIONS https://educarelink-backend.onrender.com/api/auth/login/
Origin: https://h5.zdn.vn
Access-Control-Request-Method: POST
Access-Control-Request-Headers: authorization,content-type
```

- Response: `HTTP 200` nhưng **thiếu `Access-Control-Allow-Origin`** → browser chặn mọi
  request thật (status 200 của OPTIONS là "ảo" — rơi xuống DRF view, không phải corsheaders trả).
- **Đối chứng:** cùng OPTIONS với `Origin: http://localhost:8000` (có trong whitelist)
  trả đủ `Access-Control-Allow-Origin` + `Allow-Methods` + `Allow-Headers` + `Max-Age: 86400`
  → corsheaders đang chạy ĐÚNG, chỉ là **danh sách whitelist thiếu origin Zalo**.

## 2. Root cause

`backend/settings.py` (dòng ~195–204) — whitelist không có `https://h5.zdn.vn`
(origin của mọi trang Mini App chạy trong webview Zalo):

```python
CORS_ALLOWED_ORIGINS = [
    'https://educarelink-backend.onrender.com',
    'http://localhost:8000', 'http://127.0.0.1:8000',
    'http://localhost:8081',  'http://127.0.0.1:8081',
    'http://localhost:19006', 'http://127.0.0.1:19006',
]
```

## 3. Patch (thay khối CORS trong `backend/settings.py`)

```python
# --- CORS (django-cors-headers) ---
CORS_ALLOW_ALL_ORIGINS = os.environ.get('CORS_ALLOW_ALL_ORIGINS', 'False') == 'True'

CORS_ALLOWED_ORIGINS = [
    # Web Django self-origin
    'https://educarelink-backend.onrender.com',

    # --- ZALO MINI APP (webview/iframe Zalo) ---
    'https://h5.zdn.vn',        # origin chính của mini app — BẮT BUỘC
    'https://mini.zalo.me',     # runner mini app trên web Zalo
    'https://zalo.me',          # một số webview/embed zalo.me

    # --- Dev local ---
    'http://localhost:8000',   'http://127.0.0.1:8000',    # Django dev
    'http://localhost:8081',   'http://127.0.0.1:8081',    # Expo bundled
    'http://localhost:19006',  'http://127.0.0.1:19006',   # Expo web
    'http://localhost:3000',   'http://127.0.0.1:3000',    # educarelink-zalo dev
]
```

Ghi chú:

- corsheaders đã cài đúng (`INSTALLED_APPS` + middleware trước `CommonMiddleware`) —
  chỉ thiếu danh sách.
- **Không cần** `CORS_ALLOW_CREDENTIALS = True` (app dùng JWT qua header
  `Authorization`, fetch không dùng `credentials: 'include'`).
- Header sẽ trả sau khi patch (đã đo từ chính deployment này với origin được phép):
  `Access-Control-Allow-Origin: https://h5.zdn.vn`,
  `Access-Control-Allow-Methods: DELETE, GET, OPTIONS, PATCH, POST, PUT`,
  `Access-Control-Allow-Headers: accept, authorization, content-type, user-agent,
  x-csrftoken, x-requested-with`, `Access-Control-Max-Age: 86400`, `Vary: Origin`.

## 4. Hotfix tạm KHÔNG cần đụng code (nếu muốn gấp)

Render Dashboard → Environment → thêm `CORS_ALLOW_ALL_ORIGINS = True` rồi redeploy
(`settings.py` đã đọc env này). ⚠️ Mở API cho mọi origin — chấp nhận được ngắn hạn vì
API thuần Bearer JWT (không cookie), nhưng **hãy ưu tiên patch whitelist** và xoá env
var này ngay sau khi deploy bản chuẩn.

## 5. Verify sau khi áp (chạy từng lệnh, phải thấy đủ header CORS)

```bash
# 1) Preflight login
curl -sS -i -X OPTIONS https://educarelink-backend.onrender.com/api/auth/login/ \
  -H "Origin: https://h5.zdn.vn" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: authorization,content-type" --max-time 90
# -> 200 + Access-Control-Allow-Origin: https://h5.zdn.vn

# 2) Preflight notifications
curl -sS -i -X OPTIONS https://educarelink-backend.onrender.com/api/notifications/ \
  -H "Origin: https://h5.zdn.vn" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: authorization" --max-time 90

# 3) Request thật (không chỉ preflight) — phải thấy ACAO trên response 200 JSON
curl -sS -i -X POST https://educarelink-backend.onrender.com/api/auth/login/ \
  -H "Origin: https://h5.zdn.vn" -H "Content-Type: application/json" \
  -d '{"username":"phuhuynh_test","password":"Demo@2026"}' --max-time 90

# 4) Regression: origin cũ vẫn phải còn quyền
curl -sS -i -X OPTIONS https://educarelink-backend.onrender.com/api/auth/login/ \
  -H "Origin: http://localhost:8000" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: authorization,content-type" --max-time 90
```

## 6. Vì sao frontend KHÔNG tự chữa được

- `mode: 'no-cors'` → response opaque, không đọc được JSON/token → auth chết. **Loại.**
- Tắt TLS / self-signed → webview Zalo + HSTS preload của Render chặn. **Loại.**
- Proxy phía ZMP hosting → hosting Zalo là static bundle, không có rewrite server-side.
  **Loại.**
- Dev local **không bị ảnh hưởng**: `dev_server.py` / vite proxy same-origin `/api` →
  mọi luồng dev + test browser vẫn chạy bình thường trong khi chờ backend patch.
