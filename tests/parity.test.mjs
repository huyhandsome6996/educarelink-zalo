/**
 * Tests chuẩn React Native parity (thay thế web-parity tests cũ).
 * Chạy: node tests/parity.test.mjs
 * - Unit test thật cho parseHash/buildHash (esbuild transform — không assert kiểu string câm).
 * - Source-assertion cho: theme tokens RN, tab config, API contract, login parity fix audit #1,
 *   polling matrix, platform adaptation, registry route coverage.
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { execSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

let pass = 0, fail = 0;
const failures = [];
function ok(cond, name) {
  if (cond) { pass++; }
  else { fail++; failures.push(name); }
}

/* ---------- 1. hash.ts unit tests (chạy thật sau khi strip type) ---------- */
const hashJs = execSync(
  `npx esbuild src/navigation/hash.ts --format=cjs`,
  { cwd: ROOT, encoding: "utf8", maxBuffer: 4 * 1024 * 1024 }
);
const hashModule = { exports: {} };
new Function("module", "exports", hashJs)(hashModule, hashModule.exports);
const { parseHash, buildHash } = hashModule.exports;

ok(buildHash("ParentHome", "ParentHome") === "#/ParentHome/ParentHome", "hash: buildHash 2 segment");
ok(buildHash("ParentHome", "CandidatesList", { jobId: 3 }) === "#/ParentHome/CandidatesList?jobId=3", "hash: buildHash param");
ok(buildHash("T", "R", { a: "x&y", b: null, c: undefined }) === "#/T/R?a=" + encodeURIComponent("x&y"), "hash: encode + skip null/undefined");
ok(JSON.stringify(parseHash("#/ParentHome/CandidatesList?jobId=3")) === JSON.stringify({ tab: "ParentHome", route: "CandidatesList", params: { jobId: "3" } }), "hash: parseHash tab/route/params");
ok(parseHash("").route === undefined && Object.keys(parseHash("").params).length === 0, "hash: parse rỗng");
ok(parseHash("#/Login").route === "Login", "hash: parse 1 segment");
ok(parseHash("#/T/R?a=1&b=2").params.b === "2", "hash: nhiều params");
ok(parseHash("#/T/R?x=%20a%20b").params.x === " a b", "hash: decodeURIComponent");

/* ---------- 2. Theme tokens khớp RN colors.js ---------- */
const theme = read("src/theme.ts");
for (const [k, v] of [
  ["primary: '#F26522'", 1], ["primaryDark: '#D4541E'", 1], ["primaryLight: '#FFF4ED'", 1],
  ["surfaceWarm: '#fff8f6'", 1], ["background: '#F7F7F7'", 1], ["outlineVariant: '#e1bfb3'", 1],
  ["outline: '#8d7166'", 1], ["onSurfaceVariant: '#594138'", 1], ["secondary: '#2DB84B'", 1],
]) ok(theme.includes(k), `theme token ${k}`);
ok(theme.includes("fontSize: 28") && theme.includes("lineHeight: '34px'"), "theme TYPO.h1 28/34 (px, không unitless);");
ok(theme.includes("TAB_BAR_HEIGHT = 84"), "theme tab bar 84 (Android chuẩn RN)");

/* ---------- 3. Tab bar cấu hình đúng AppNavigator ---------- */
const tabbar = read("src/components/TabBar.tsx");
const parentOrder = ["ParentHome", "MyTasks", "Chatbot", "TrackingOverview", "ParentProfile"];
const workerOrder = ["WorkerFeed", "MatchingAvailability", "WorkerChatbot", "MyJobs", "WorkerProfile"];
const parentBlock = tabbar.slice(tabbar.indexOf("PARENT_TABS"), tabbar.indexOf("WORKER_TABS"));
const workerBlock = tabbar.slice(tabbar.indexOf("WORKER_TABS"), tabbar.indexOf("export const TabBar"));
const assertOrder = (block, order, label) => { const idxs = order.map((n) => block.indexOf(`name: "${n}"`)); ok(idxs.every((i) => i > -1) && idxs.every((v, i) => i === 0 || v > idxs[i - 1]), label); };
assertOrder(parentBlock, parentOrder, "parent tabs đúng thứ tự RN (AI giữa)"); assertOrder(workerBlock, workerOrder, "worker tabs đúng thứ tự RN (AI giữa)");
ok(parentBlock.includes('label: "Trang chủ"') && parentBlock.includes('label: "Công việc"') && parentBlock.includes('label: "AI Trợ lý"') && parentBlock.includes('label: "Theo dõi"') && parentBlock.includes('label: "Tài khoản"'), "parent labels RN nguyên văn");
ok(workerBlock.includes('label: "Lịch rảnh"') && workerBlock.includes('icon: "briefcase"'), "worker labels + briefcase icon");
ok(tabbar.includes('"hardware-chip"') && tabbar.includes("RAISED_FAB"), "FAB AI hardware-chip nổi giữa");

/* ---------- 4. API client contract RN ---------- */
const client = read("src/api/client.ts");
ok(client.includes("https://educarelink-backend.onrender.com/api"), "BASE_URL prod Render");
ok(client.includes("failedQueue") && client.includes("isRefreshing") && client.includes("processQueue"), "refresh queue failedQueue (nguyên bản RN)");
ok(client.includes("/auth/token/refresh/") && client.includes("tokens.refresh"), "refresh rotate + blacklist");
ok(client.includes("Authorization") && client.includes("Bearer"), "bearer attach");
ok(client.includes("deleteItem") && client.includes("user_role"), "clear session 4 keys");
ok(client.includes("login|register|google|facebook"), "auth endpoint loại trừ khỏi refresh (khác biệt có chủ đích)");
ok(client.includes("45_000") && client.includes("60_000"), "timeout 45s + AI 60s");

const misc = read("src/api/misc.ts");
ok(misc.includes("getPaymentStatus") && misc.includes("my-earnings"), "payments endpoints");
ok(misc.includes("unread-count") && misc.includes("mark-read"), "notifications endpoints");
const matching = read("src/api/matching.ts");
ok(matching.includes("Idempotency-Key"), "selectCarePartner Idempotency-Key header");
ok(matching.includes("select-carepartner") && matching.includes("publish/"), "matching flow endpoints");
const tracking = read("src/api/tracking.ts");
ok(tracking.includes("/tracking/{taskId}/live/") || tracking.includes("`/tracking/${taskId}/live/`"), "tracking live endpoint");
ok(tracking.includes("gps-heartbeat") && tracking.includes("sos"), "gps heartbeat + sos");

/* ---------- 5. LoginScreen — fix audit #1 (RN LoginScreen.js) ---------- */
const login = read("src/screens/auth/LoginScreen.tsx");
ok(login.includes("Chào mừng trở lại"), "login title RN nguyên văn");
ok(login.includes("Đăng nhập để tiếp tục kết nối"), "login subtitle RN");
ok(login.includes("Số điện thoại / Tên tài khoản"), "login label field RN");
ok(login.includes("Nhập số điện thoại của bạn"), "login placeholder RN");
ok(login.includes("phone-portrait-outline") && login.includes("lock-closed-outline"), "login Ionicons đúng");
ok(login.includes("COLORS.surfaceWarm"), "login nền #fff8f6 (surfaceWarm)");
ok(/width: 92,\s*height: 92/.test(login), "login logo 92×92");
ok(login.includes("TYPO.h1") && login.includes("COLORS.primary"), "login title cam TYPO.h1");
ok(/borderRadius: 20/.test(login) && /padding: 24/.test(login), "login card radius 20 / padding 24");
ok(login.includes("outlineVariant"), "login card viền outlineVariant");
ok(login.includes("pending_approval"), "login 403 pending_approval alert");
ok(login.includes("eye-outline") || login.includes("eye-off-outline"), "login eye toggle");
ok(!login.includes("Đăng ký</") || login.includes("Đăng ký ngay"), "login KHÔNG còn tab Đăng nhập/Đăng ký Django");

/* ---------- 6. RootNavigator nhánh điều hướng RN ---------- */
const rootnav = read("src/navigation/RootNavigator.tsx");
ok(rootnav.includes("first_login"), "nhánh first_login → Onboarding");
ok(rootnav.includes("!user.is_approved") || rootnav.includes("is_approved"), "nhánh worker pending → ScreeningStatus");
ok(rootnav.includes("is_staff"), "nhánh admin");
ok(rootnav.includes("NavLoadingView"), "loading view heart 56");

/* ---------- 7. Polling matrix ---------- */
const ui = read("src/components/ui.tsx");
ok(ui.includes("30_000") || ui.includes("30000"), "NotificationBell poll 30s");
const chat = read("src/screens/shared/ChatScreen.tsx");
ok(/4_000|4000|4 \* 1000/.test(chat), "Chat poll 4s");
const pqr = read("src/screens/parent/PaymentQRScreen.tsx");
ok(/4_000|4000|4 \* 1000/.test(pqr), "PaymentQR poll status 4s");
const feed = read("src/screens/worker/WorkerFeedScreen.tsx");
ok(/15_000|15000|15 \* 1000/.test(feed), "WorkerFeed poll 15s");
const live = read("src/screens/parent/LiveTrackingScreen.tsx");
ok(/5_000|5000|5 \* 1000/.test(live) && /10_000|10000|10 \* 1000/.test(live), "LiveTracking poll 5s/10s");

/* ---------- 8. Platform adaptations có ghi chú ---------- */
ok(live.includes("PLATFORM ADAPTATION"), "LiveTracking map adaptation comment");
ok(read("src/screens/worker/MyJobsScreen.tsx").includes("tracking/location/") || read("src/screens/worker/MyJobsScreen.tsx").includes("/tracking/heartbeat/"), "MyJobs LocationService web inline");

/* ---------- 9. Registry coverage: đủ 60 route AppNavigator ---------- */
const registry = read("src/navigation/registry.tsx");
const RN_ROUTES = ["Splash","GuestHome","Login","Register","Onboarding","ParentHome","MyTasks","Chatbot","TrackingOverview","ParentProfile","JobTypeSelect","TutoringForm","ChildcareForm","PickupForm","CandidatesList","CandidateProfileV2","Candidates","CandidateProfile","BookingDetail","PaymentQR","PaymentSetup","PaymentDetail","WalletCredits","RewardPoints","RewardPointsScreen","SmartMatches","CreateTask","Review","LiveTracking","CareDiaryDetail","CareDiaryHistory","Notifications","Chat","ImagePreview","HelpCenter","CancellationPolicy","WorkerFeed","MatchingAvailability","WorkerChatbot","MyJobs","WorkerProfile","WorkerAvailability","Blackout","WorkerScreeningStatus","MyBookings","Appeal","CareDiaryForm","TaskDetail","Complaint","MyComplaints","ProfileChangeRequests","MyEarnings","SettlementDetail","AdminDashboard","AdminModeration","AdminChatbot","AdminPayments","AdminTrackingOverview","AdminReview","AdminSendNotification","AdminAllTasks"];
for (const r of RN_ROUTES) ok(registry.includes(`"${r}"`) || registry.includes(` ${r}`) || registry.includes(` ${r},`), `registry route ${r}`);
ok(registry.includes("MODAL_ROUTES") && registry.includes("Complaint") && registry.includes("ImagePreview"), "modal routes đăng ký");

/* ---------- 10. Không còn kiến trúc cũ ---------- */
ok(!existsSync(join(ROOT, "src/components/layout.tsx")), "iframe layout cũ đã xoá");
ok(!existsSync(join(ROOT, "scripts/port_pages.py")), "Django compiler đã xoá");
ok(!existsSync(join(ROOT, "src/public/pages")), "44 trang HTML tĩnh đã xoá");
ok(existsSync(join(ROOT, "src/public/static/images/logo.png")), "assets logo giữ lại");
ok(existsSync(join(ROOT, "src/public/static/sounds/police_siren.mp3")), "sounds giữ lại (LiveTracking dùng)");

/* ---------- 11. Màn hình: không stub sót ---------- */
const screenDirs = ["src/screens/auth", "src/screens/parent", "src/screens/worker", "src/screens/shared", "src/screens/admin"];
let stubLeft = 0;
for (const d of screenDirs) {
  for (const f of readdirSync(join(ROOT, d))) {
    const c = read(`${d}/${f}`);
    if (c.includes("STUB chuyển tiếp") || c.includes('đang được port từ bản React Native')) {
      stubLeft++;
      failures.push(`STUB SÓT: ${d}/${f}`);
    }
  }
}
ok(stubLeft === 0, "0 stub sót trong screens");

/* ---------- 12. index.html fonts chuẩn RN ---------- */
const indexHtml = read("src/index.html");
ok(indexHtml.includes("Manrope:wght@700;800"), "index fonts Manrope 700/800");
ok(indexHtml.includes("Plus+Jakarta+Sans:wght@500;600;700;800"), "index fonts PJS 500/600/700/800");
ok(!indexHtml.includes("Material+Symbols"), "bỏ Material Symbols (chuẩn Ionicons)");

console.log(`\n=== RN-PARITY TESTS: ${pass} pass, ${fail} fail ===`);
if (fail) {
  console.error("FAILURES:\n - " + failures.join("\n - "));
  process.exit(1);
}
