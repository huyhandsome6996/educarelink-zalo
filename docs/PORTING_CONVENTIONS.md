# Quy ước port RN → Zalo (bắt buộc cho mọi agent)

Chuẩn duy nhất: React Native `mobile/src/` trong repo READ-ONLY
`/home/z/my-project/work/educarelink-backend-4-12-2026/` (HEAD f4a28806 — KHÔNG ghi file nào ở đó).

## Mục tiêu
Port từng screen RN sang TSX với **độ trung thực thị giác tuyệt đối**: thứ tự khối, kích thước,
khoảng cách, font, màu, radius, border, shadow, icon, trạng thái (selected/disabled/error/loading),
modal, hành vi cuộn. KHÔNG tái cấu trúc theo ý thích, KHÔNG đơn giản hoá.

## File nền đã có (dùng, không sửa trừ khi được giao)
- `src/theme.ts`: `COLORS, TYPO, SIZES, SHADOWS, TAB_BAR*, RAISED_FAB*, typo(key, override), FONT_HEAD, FONT_BODY`
- `src/components/Icon.tsx`: `<Icon name="phone-portrait-outline" size={20} color={COLORS.outlineVariant} />` — Ionicons SVG thật (159 glyph). Alias: radar→pulse, bell-outline→notifications-outline, flash-alert→warning. Icon thiếu → thêm path vào `src/components/icons/ionicons.ts` bằng script `scripts/fetch_ionicons.py`.
- `src/components/ui.tsx`: `Touchable, Spinner, showAlert(title, msg), StatusBarSpacer, Screen, AppBar,
  NotificationBell, LetterAvatar, EmptyState, PrimaryButton, useStatusBarHeight, useNotifications()`
- `src/components/TabBar.tsx`: cấu hình tabs đã đúng chuẩn RN — không đụng.
- `src/navigation/router.tsx`: `useNav()` → `{ navigate, replace, push, goBack, switchTab, openModal, closeModal, state }`. Route names GIỐNG AppNavigator.js.
- `src/api/*`: `client` (default `api.get/post/patch/put/delete`, `ApiError`, `AI_TIMEOUT`), `auth`, `tasks`, `tracking`, `matching`, `misc`. Mọi endpoint đã port từ mobile/src/api — TRUY VẤN FILE ĐÓ trước khi tự chế endpoint. Lỗi đọc: `e.response?.data?.error`, status `e.response?.status`.
- `src/context/AuthContext.tsx`: `useAuth()` → `{ user, isLoading, login, register, logout, refreshUser, completeOnboardingInContext }`.
- `src/navigation/registry.tsx`: bảng route (đã đăng ký đủ) — chỉ sửa khi được giao.

## Luật chuyển đổi style RN → CSS (1:1)
| RN | Web |
|---|---|
| `flexDirection:'row'` | `display:'flex', flexDirection:'row'` |
| `justifyContent/alignItems` | giữ nguyên |
| `gap: 12` | `gap: 12` |
| `borderRadius: 20` | `borderRadius: 20` |
| `...SHADOWS.medium` | `boxShadow: SHADOWS.medium` |
| `...TYPO.h1` | `...typo('h1')` hoặc `{...TYPO.h1, lineHeight:'34px'}` (dùng spread `TYPO.x` + đặt `lineHeight: 'NNpx'`) |
| `paddingHorizontal: 16` | `padding: '0 16px'` (hoặc paddingLeft/Right) |
| `flex: 1` | `flex: 1` |
| `fontSize: 15, fontWeight: '500'` | `fontSize: 15, fontWeight: 500` |
| Ionicons name | `<Icon name=...>` giống hệt tên |
| `Alert.alert(t, m)` | `showAlert(t, m)` |
| `ActivityIndicator` | `<Spinner size color />` |
| `ScrollView` | container `Screen` (đã có overflow-y) |
| `Animated.timing fade 400ms` | CSS `transition: 'opacity 0.4s'` + setState |
| ảnh `require('../../../assets/logo.png')` | `<img src="/static/images/logo.png" />` |
| màu hardcode trong screen (vd `#EA580C`) | giữ NGUYÊN giá trị đó — KHÔNG thay bằng token khác |

## Luật dữ liệu & trạng thái
- Fetch khi mount (useEffect), loading state → spinner + text giống RN ("Đang quét các đơn mới..."), error state → icon + nút "Thử lại ngay", empty state → dùng `EmptyState` với icon/text NGUYÊN từ RN.
- Polling: giữ đúng interval RN (live 5s, device-status 10s, unread 30s [đã có ở ui.tsx], bookings awaiting 15s, chat 4s, payment status 4s) + `clearInterval` khi unmount.
- Params qua props: `const MyTasksScreen: React.FC<{ taskId?: string }> = ({ taskId }) => ...` (registry spread params).
- KHÔNG dùng mock trong production UI (chỉ RewardPoints/Screening giữ mock như RN — file `src/mocks/` tự tạo nếu cần, copy data từ RN).
- Đơn vị tiền VNĐ format giống RN helper nếu có (tự viết `formatVnd` tại chỗ dùng: `new Intl.NumberFormat('vi-VN').format(n) + 'đ'`).

## File mỗi agent sở hữu
- Chỉ GHI ĐÈ đúng các file được giao (đường dẫn tuyệt đối trong prompt). Không sửa file khác.
- Stub hiện tại trong file là placeholder — thay toàn bộ nội dung.
- Xong: chạy `npx tsc --noEmit` (phải 0 lỗi) và báo danh sách file đã viết + điểm khác biệt biết được (platform limitation) để ghi vào mobile-parity-map.md.

## Cấm
- Cấm import zmp-ui (App dùng pure React).
- Cấm dùng Tailwind class cho UI mới (inline style như RN).
- Cấm đổi theme.ts/TabBar/router/api client trừ khi prompt giao trách nhiệm đó.
- Cấm emit code TypeScript any không rõ nguồn; lỗi type phải sửa sạch.
- Cấm đụng `/home/z/my-project/work/educarelink-backend-4-12-2026/` (CHỈ ĐỌC).
