# Bản đồ parity RN → Zalo Mini App

- **Chuẩn UI duy nhất**: React Native `mobile/src/` — repo READ-ONLY `huyhandsome6996/educarelink-backend-4-12-2026`, baseline commit `f4a288068bb1202d649eecf5132a9482f9090b2c` (đã verify trước khi làm).
- **Repo sửa**: `huyhandsome6996/educarelink-zalo`, nhánh `fix/zalo-react-native-parity` (tách từ `fix/zalo-web-parity-api` @ `2572a0a`).
- **Kiến trúc cũ đã loại khỏi build chính**: `scripts/port_pages.py` (Django compiler), 44 trang HTML tĩnh, shell iframe (`src/components/layout.tsx` cũ), web-parity tests. Django `frontend/templates/frontend/` KHÔNG còn là chuẩn UI.

## Kiến trúc mới

| Thành phần | File | Tương đương RN |
|---|---|---|
| Design tokens | `src/theme.ts` | `mobile/src/theme/colors.js` (COLORS/TYPO/SIZES/SHADOWS nguyên văn) |
| Ionicons | `src/components/Icon.tsx` + `icons/ionicons.ts` | `@expo/vector-icons` (SVG thật ionicons@7.4.0, 159 glyph) |
| API client | `src/api/client.ts` | `mobile/src/api/client.js` (refresh queue `failedQueue`, rotate refresh, clear session; khác biệt có chủ đích: login/register không qua refresh) |
| API modules | `src/api/{auth,tasks,tracking,matching,misc}.ts` | 11 module api RN (endpoint 1:1) |
| Auth | `src/context/AuthContext.tsx` | `mobile/src/context/AuthContext.js` (keys storage `access_token/refresh_token/user_role/is_staff/user_id/tracking_task_id`) |
| Router | `src/navigation/router.tsx` | react-navigation: hash `#/Tab/Route?params`, nested stack per tab, modal, popstate back |
| Nhánh điều hướng | `src/navigation/RootNavigator.tsx` | `AppNavigator.js` d.342–461 (loading → guest → first_login → worker pending → admin → parent → worker) |
| Tab bar | `src/components/TabBar.tsx` | styles.tabBar + TabIcon + raisedFab (AppNavigator d.498–562) |
| Screen registry | `src/navigation/registry.tsx` | 60 route, tên GIỐNG AppNavigator |

## Bản đồ route (RN → Zalo)

Trạng thái: ✅ port đầy đủ · 🔶 port với thích ứng nền tảng (ghi rõ ở cột ghi chú).

### Auth / Guest
| Route RN | File RN | Zalo | Ghi chú |
|---|---|---|---|
| Splash | Auth/SplashScreen.js | ✅ `screens/auth/SplashScreen.tsx` | 2.5s → replace GuestHome |
| GuestHome | Auth/GuestHomeScreen.js | ✅ `auth/GuestHomeScreen.tsx` | carousel autoplay 4s, role modal bottom-sheet; Alert đa nút → showAlert |
| Login | Auth/LoginScreen.js | ✅ `auth/LoginScreen.tsx` | FIX AUDIT #1: nền #fff8f6, logo 92×92 trên title cam 28/34, card r20/p24/viền outlineVariant, field "Số điện thoại / Tên tài khoản" + phone-portrait-outline |
| Register | Auth/RegisterScreen.js | ✅ `auth/RegisterScreen.tsx` | file upload = `<input type=file>` (Blob/FormData, không {uri,type,name}) |
| Onboarding | Onboarding/{Parent,Worker}OnboardingScreen.js | ✅ `shared/OnboardingScreen.tsx` | 1 file 2 nhánh theo role |

### Parent tabs (đúng thứ tự RN: Trang chủ / Công việc / AI Trợ lý / Theo dõi / Tài khoản — FAB giữa)
| Route RN | Zalo | Ghi chú |
|---|---|---|
| ParentHome | ✅ ParentHomeScreen.tsx | ví từ getCreditBalance() thật; radar bookings; VIETQR gate mount |
| MyTasks | ✅ MyTasksScreen.tsx | 4 tab segmented; STITCH token giữ nguyên; countdown 1s |
| Chatbot | ✅ ChatbotScreen.tsx | sendChatMessage 60s; job card AI → CandidatesList |
| TrackingOverview | ✅ TrackingOverviewScreen.tsx | list in_progress → LiveTracking |
| ParentProfile | ✅ ParentProfileScreen.tsx | menu + logout; modal Sửa dùng updateProfile+refreshUser (deviation ghi trong file) |

### Worker tabs (Trang chủ / Lịch rảnh / AI Trợ lý / Công việc / Tài khoản — FAB giữa)
| Route RN | Zalo | Ghi chú |
|---|---|---|
| WorkerFeed | ✅ WorkerFeedScreen.tsx | poll 15s; countdown seconds_left |
| MatchingAvailability | ✅ AvailabilityScreen.tsx | radar bento, addAvailability overlap/merge |
| WorkerChatbot | ✅ WorkerChatbotScreen.tsx | QuickQuestions chips; card ngày bận → Blackout |
| MyJobs | ✅ MyJobsScreen.tsx | STATUS_STYLE 15 trạng thái; GPS web inline (10s location + 30s heartbeat) |
| WorkerProfile | ✅ WorkerProfileScreen.tsx | menu mapping nguyên bản RN; PIN modal, GPS consent inline |

### Parent stack + shared
| Route RN | Zalo | Ghi chú |
|---|---|---|
| JobTypeSelect | ✅ | 3 card accent strip; AI express → Chatbot |
| TutoringForm | ✅ | createJob→publishJob(60s)→CandidatesList; price suggestion debounce 400ms |
| ChildcareForm / PickupForm | ✅ | đủ section; geocode backend + Nominatim fallback thay MapPicker Leaflet |
| CandidatesList | ✅ | getMatchingCandidates top 8 ELO; selectCarePartner + Idempotency-Key |
| CandidateProfileV2 | ✅ | getWorkerProfile; tier badge; AI summary |
| Candidates / CandidateProfile | ✅ | luồng legacy |
| BookingDetail | ✅ | 3433 dòng RN → 2923 dòng TSX; 2 view parent/worker; toàn lifecycle |
| PaymentQR | ✅ | poll status 4s; countdown QR; setupPayOS tạo lại |
| PaymentSetup / PaymentDetail | ✅ | modal 3 method; timeline |
| WalletCredits | ✅ | quirks theme RN tái tạo 1:1 (ghi trong file) |
| RewardPoints / RewardPointsScreen | ✅ | mock RN copy nguyên (`src/mocks/rewardPointsMock.ts`) |
| SmartMatches | ✅ | getSmartMatches; medal top 3 |
| CreateTask (modal) | ✅ | legacy 3 bước; MapPicker iframe Leaflet inline |
| Review | ✅ | 1–5 sao + quick tags + createReview |
| LiveTracking | 🔶 | poll 5s/10s/30s đủ; map = static simulation (RN cũng render placeholder tĩnh — không dùng Google Maps key); SOS/offline/verification đủ |
| CareDiaryDetail / CareDiaryHistory | ✅ | assessment cards port inline; /media/ public img trực tiếp |
| Notifications | ✅ | mark read + refresh badge 30s chung |
| Chat | ✅ | poll 4s since; cửa sổ 24h; composer ẩn khi đóng |
| ImagePreview (modal) | ✅ | scroll-snap; ảnh Bearer qua blob URL |
| HelpCenter | ✅ | FAQ + sendHelpCenterMessage |
| CancellationPolicy (modal) | ✅ | mock policy copy nguyên RN |

### Worker stack
| Route RN | Zalo | Ghi chú |
|---|---|---|
| WorkerScreeningStatus | ✅ | mock RN copy nguyên + nhánh approved |
| MyBookings | ✅ | tab lọc trạng thái |
| Blackout | ✅ | lịch mini tháng tự dựng; 409 trùng booking đúng text |
| WorkerAvailability | ✅ | CRUD legacy /worker/availability/ |
| Appeal | ✅ | ≥20 ký tự, ≤3/30 ngày |
| CareDiaryForm | ✅ | mood/activities/assessment + upload images[] |
| TaskDetail | ✅ | apply đã chết (passive_matching_only) → CTA MyBookings như RN |
| Complaint (modal) | ✅ | createComplaint FormData evidence |
| MyComplaints / ProfileChangeRequests | ✅ | list đúng RN |
| MyEarnings / SettlementDetail | ✅ | số Decimal dạng string format vi-VN |

### Admin (nhánh is_staff)
| Route RN | Zalo |
|---|---|
| AdminDashboard | ✅ hub menu + stats |
| AdminModeration | ✅ queue + override + re-moderate |
| AdminChatbot (modal) | ✅ FormData message+image + image_analysis |
| AdminPayments | ✅ tabs overview/payments/settlements/logs |
| AdminTrackingOverview | ✅ overview + run-offline-check |
| AdminReview | ✅ |
| AdminSendNotification (modal) | ✅ chọn user hoặc send_to_all |
| AdminAllTasks | ✅ moderate approve/reject |

## API contract (đã đối chiếu mobile/src/api + backend urls.py)

- BASE prod: `https://educarelink-backend.onrender.com/api` (dev: `/api` qua vite proxy + dev_server.py — tương đương EXPO_PUBLIC_USE_DEV_BACKEND).
- Login response: đọc `tokens.access/tokens.refresh`, `role`, `is_staff`, `is_approved`, `first_login`.
- Refresh: POST `/auth/token/refresh/` `{refresh}` → `{access, refresh?}`; rotate+blacklist → lưu refresh mới; hàng đợi 401; refresh fail → xoá 4 keys (logout).
- `approveCandidate` → `{next_step:'create_payos_payment'}` → setupPayOS → poll `getPaymentStatus` 4s.
- `applyTask` chết (403 `passive_matching_only`) → luồng matching: createJob → publishJob (60s) → getMatchingCandidates → selectCarePartner (header Idempotency-Key).
- AI timeout ≥60s: chatbot×3, recommendations, publish, admin chatbot, moderation AI.
- Ảnh verification GET kèm Bearer (blob URL); /media/ care-diary là public.
- Upload: mọi multipart dùng File/FormData thật (browser tự boundary).

## Polling matrix (giữ nguyên RN)

| Poll | Interval | Chỗ dùng |
|---|---|---|
| notifications unread-count | 30s | NotificationBell (ui.tsx) |
| tracking live | 5s | LiveTracking |
| device-status | 10s | LiveTracking |
| verification history | 30s | LiveTracking |
| bookings awaiting_commitment | 15s | WorkerFeed |
| chat messages since | 4s | Chat |
| payment status | 4s | PaymentQR |
| GPS matching heartbeat | 5 phút | AuthContext worker (gps-heartbeat) |
| trong ca: location / heartbeat | 10s / 30s | MyJobs (LocationService web inline) |

## Thích ứng nền tảng (platform adaptations — có ghi trong code)

1. **Push/notification native, background GPS TaskManager, expo-notifications, iOS critical alert**: không tồn tại trên Zalo webview → thay bằng polling matrix + HTMLAudio siren + navigator.vibrate (best-effort). Không mock "thành công" — UI thể hiện đúng giới hạn.
2. **react-native-maps / Leaflet WebView**: static map simulation tự vẽ (grid + marker + geofence ring + polyline history) — LiveTracking/CreateTask.
3. **Alert.alert đa nút**: `window.confirm` (2 nút) / `showAlert` (1 nút).
4. **DateTimePicker native**: `<input type="date">` (form Flow 1) / lịch mini tháng tự dựng (Blackout) / prompt giờ (WorkerAvailability — giữ nhánh web của RN).
5. **RefreshControl / useFocusEffect**: refetch khi focus lại route + nút thử lại.
6. **Linking.openURL**: `tel:` → location.href; http(s) ngoài → window.open (điểm cắm openWebview của zmp-sdk khi release thật — comment sẵn trong PaymentQR/GuestHome).
7. **OAuth Google/Facebook**: cần flow Zalo SDK riêng — hiện giữ UI + thông báo "Chưa cấu hình" như RN khi server chưa bật (getOAuthConfig).
8. **Icon**: Ionicons SVG thật; glyph thiếu trong bộ 159 → alias cục bộ gần đúng (search-outline→search, close-circle-outline→close-circle…) — danh sách tại header từng file.
9. **Params object qua router**: hash chỉ serialize scalar params (jobId, taskId...); object (job, candidates) truyền state — reload mất object (deep-link về fetch lại như RN).

## Giới hạn đã biết

- **CORS prod**: origin `*.zdn.vn` KHÔNG nằm trong `CORS_ALLOWED_ORIGINS` của backend Render — vẫn BLOCKED chờ chủ backend (đã có `docs/PATCH_CORS_BACKEND.md`). Frontend không tự chữa được CORS; dev/QA chạy qua proxy.
- Chưa chụp RN thật bằng emulator để đo pixel-diff → toàn bộ port theo mã nguồn RN, trạng thái "chưa xác minh pixel" (không tự tạo ảnh chuẩn giả).
- Smoke trên Zalo Developer Tools/thiết bị thật: CHƯA chạy (môi trường này không có Zalo Studio) — cần người dùng chạy `npm start`.
