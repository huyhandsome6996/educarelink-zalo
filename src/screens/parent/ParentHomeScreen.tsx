/**
 * ParentHomeScreen — port CHÍNH XÁC mobile/src/screens/Parent/ParentHomeScreen.js (1876 dòng).
 * Thứ tự section giữ nguyên RN:
 *  1. HERO HEADER #F26522 phẳng (radius đáy 28) + search bar AI
 *  2. DOCK NỔI: Ví EduCare (getCreditBalance) + Điểm thưởng
 *  3. 3 trụ cột dịch vụ + AI fast-booking banner + showcase CarePartner
 *  4. RADAR LIVE khi có booking in_progress|committed|awaiting_commitment (getBookings role=parent)
 *  5. Lịch ca chăm sóc gần đây (getMyTasksAsParent — theo spec task 5-b, "Xem tất cả" → MyTasks)
 *  6. Ưu đãi & Cam kết (voucher + guarantee)
 *  7. Trust footer 3 lớp
 * VIETQR gate (resume QR giữa chừng) port nguyên bản RN.
 * Khác biệt platform: không pull-to-refresh (web), SOS showAlert thay Alert 2 nút,
 * glyph close-circle thay close-circle-outline (chưa có trong ionicons.ts).
 */
import React, { useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon";
import {
  Touchable,
  Spinner,
  showAlert,
  StatusBarSpacer,
  Screen,
  NotificationBell,
  useStatusBarHeight,
} from "@/components/ui";
import { SHADOWS } from "@/theme";
import { useNav } from "@/navigation/router";
import { useAuth } from "@/context/AuthContext";
import { getBookings, getCreditBalance } from "@/api/matching";
import { getMyTasksAsParent } from "@/api/tasks";
import { getMyPayments } from "@/api/misc";

/** Hotline hỗ trợ duy nhất — đồng bộ mobile/src/config/appConfig.js (repo gốc CHỈ ĐỌC). */
const SUPPORT_HOTLINE = "0862427404";

/* Style theo trạng thái ĐƠN GHÉP CẶP (Flow 1) — nguyên bản RN dòng 43-50 */
const BOOKING_STATUS_STYLE: Record<string, { color: string; bg: string; icon: string; label: string }> = {
  awaiting_commitment: { color: "#B45309", bg: "#FFFBEB", icon: "hourglass-outline", label: "Chờ cam kết" },
  committed: { color: "#C2410C", bg: "#FFF4ED", icon: "time-outline", label: "Đã khóa lịch" },
  in_progress: { color: "#2563EB", bg: "#EFF6FF", icon: "navigate-outline", label: "Đang thực hiện" },
  completed: { color: "#059669", bg: "#ECFDF5", icon: "checkmark-circle-outline", label: "Hoàn thành" },
  // RN dùng close-circle-outline — glyph chưa có trong ionicons.ts (không được sửa file chung) → dùng close-circle
  cancelled: { color: "#6B7280", bg: "#F3F4F6", icon: "close-circle", label: "Đã huỷ" },
  expired: { color: "#6B7280", bg: "#F3F4F6", icon: "close-circle", label: "Hết hạn" },
};

/* Task legacy (core.Task /parent/my-tasks/) — map sang cùng palette trạng thái của RN */
const TASK_STATUS_STYLE: Record<string, { color: string; bg: string; icon: string; label: string }> = {
  open: { color: "#B45309", bg: "#FFFBEB", icon: "hourglass-outline", label: "Đang tìm CP" },
  in_progress: BOOKING_STATUS_STYLE.in_progress,
  completed: BOOKING_STATUS_STYLE.completed,
  cancelled: BOOKING_STATUS_STYLE.cancelled,
};

/** Thời gian ca (task.scheduled_time) — format như OpenTaskCard của RN MyTasksScreen */
const formatTaskTime = (t: any): string => {
  if (t?.scheduled_time) {
    try {
      return new Date(t.scheduled_time).toLocaleString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      /* fallthrough */
    }
  }
  return "Đã tạo trên hệ thống";
};

const ParentHomeScreen: React.FC = () => {
  const nav = useNav();
  const { user, logout } = useAuth();
  const statusBarH = useStatusBarHeight();

  const [bookings, setBookings] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [walletText, setWalletText] = useState("0đ"); // getCreditBalance() — fallback "0đ" khi lỗi (RN hardcode mock, spec 5-b: dùng API thật)

  /* Hiệu ứng pulse chấm radar — RN Animated.loop 1000ms lên + 1000ms xuống = chu kỳ 2s */
  const pulseStyle: React.CSSProperties = {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#2563EB",
    animation: "edc-pulse 2s ease-in-out infinite",
  };

  /* ── Tải dữ liệu mount: bookings (radar) + tasks (lịch gần đây) — lỗi → rỗng, KHÔNG crash ──
     (RN dùng Promise.allSettled; lib target của zalo chưa có nên tách 2 khối try/catch độc lập) */
  const fetchHomeData = async () => {
    try {
      const d: any = await getBookings({ role: "parent" });
      setBookings((d?.results || d || []).slice(0, 5));
    } catch (e) {
      console.error("Lỗi tải danh sách đơn:", e);
    }
    try {
      const d: any = await getMyTasksAsParent();
      setTasks(Array.isArray(d) ? d : d?.results || []);
    } catch (e) {
      console.error("Lỗi tải lịch ca:", e);
    }
    setIsLoading(false);
  };

  /* ── Ví EduCare: số dư credit thật từ API ── */
  const loadCreditBalance = async () => {
    try {
      const d: any = await getCreditBalance();
      setWalletText(`${(d?.credit_vnd ?? 0).toLocaleString("vi-VN")}đ`);
    } catch {
      /* giữ fallback "0đ" */
    }
  };

  /* ── VIETQR GATE: mở lại app còn task 'pending_payment' do mình tạo → điều hướng thẳng
     PaymentQRScreen (nguyên bản RN — guard ref chỉ tự điều hướng 1 lần mỗi mount) ── */
  const resumeNavigatedRef = useRef(false);
  const checkPendingPaymentSelection = async () => {
    if (resumeNavigatedRef.current) return;
    try {
      const data: any = await getMyPayments();
      const list = Array.isArray(data) ? data : data?.results || [];
      const pending = list.find(
        (p: any) =>
          p.method === "payos" &&
          p.status === "pending" &&
          p.task_status === "pending_payment" &&
          p.payos_checkout_url
      );
      if (pending) {
        resumeNavigatedRef.current = true;
        nav.navigate("PaymentQR", {
          paymentId: pending.id,
          taskId: pending.task,
          taskTitle: pending.task_title || "",
          taskPrice: pending.amount,
          workerName: pending.worker_full_name || pending.worker_name || "",
          checkoutUrl: pending.payos_checkout_url,
          qrCode: null,
          qrExpiresAt: pending.payos_expires_at || null,
        });
      }
    } catch {
      // Chưa login / lỗi mạng — bỏ qua, không chặn màn hình chính
    }
  };

  useEffect(() => {
    fetchHomeData();
    loadCreditBalance();
    checkPendingPaymentSelection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── User row: tap → ParentProfile (RN: navigate ParentTabs/ParentProfile), long-press → logout ── */
  const longPressFiredRef = useRef(false);
  const lpTimerRef = useRef<number | null>(null);
  const handleLogout = () => {
    if (window.confirm("Bạn có chắc chắn muốn đăng xuất?")) {
      logout(); // RN web branch: Platform.OS === 'web'
    }
  };
  const startLongPress = () => {
    longPressFiredRef.current = false;
    lpTimerRef.current = window.setTimeout(() => {
      longPressFiredRef.current = true;
      handleLogout();
    }, 600);
  };
  const endLongPress = () => {
    if (lpTimerRef.current) {
      window.clearTimeout(lpTimerRef.current);
      lpTimerRef.current = null;
    }
  };

  const displayName = user?.first_name
    ? `${user.first_name} ${user.last_name || ""}`.trim()
    : user?.username || "Phụ huynh";

  // Greeting theo giờ (spec 5-b: sáng | chiều | tối)
  const hour = new Date().getHours();
  const greetWord = hour < 12 ? "sáng" : hour < 18 ? "chiều" : "tối";

  // Lấy đơn đang diễn ra hoặc đã khóa lịch để hiển thị radar (nguyên bản RN)
  const activeBooking = bookings.find((b) =>
    ["in_progress", "committed", "awaiting_commitment"].includes(b.status)
  );

  /* ============================================================
     STYLESHEET — port 1:1 từ StyleSheet.create của RN
     ============================================================ */
  const s: Record<string, React.CSSProperties> = {
    container: { flex: 1, backgroundColor: "#F8FAFC" },

    // 1. HERO TOP BRAND HEADER — #F26522 phẳng (KHÔNG gradient)
    headerContainer: {
      backgroundColor: "#F26522",
      borderBottomLeftRadius: 28,
      borderBottomRightRadius: 28,
      paddingTop: Math.max(6, Math.max(statusBarH, 12) + 6 - statusBarH), // RN: max(insets.top,12)+6; StatusBarSpacer đã đệm insets.top
      paddingLeft: 16,
      paddingRight: 16,
      paddingBottom: 28,
      position: "relative",
      boxShadow: SHADOWS.medium,
    },
    headerTopRow: {
      display: "flex",
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 14,
    },
    headerBrandLogo: {
      width: 42,
      height: 42,
      borderRadius: 12,
      backgroundColor: "#ffffff",
      objectFit: "contain",
    },
    userInfoRow: {
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
      marginRight: 10,
      cursor: "pointer",
      userSelect: "none",
      WebkitTapHighlightColor: "transparent",
    },
    avatarWrapper: { position: "relative", marginRight: 10 },
    avatarCircle: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: "#ffffff",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      border: "2px solid #FED7AA",
      boxShadow: SHADOWS.small,
      boxSizing: "border-box",
    },
    onlineBadge: {
      position: "absolute",
      bottom: 0,
      right: 0,
      width: 11,
      height: 11,
      borderRadius: 6,
      backgroundColor: "#10B981",
      borderWidth: 2,
      borderColor: "#ffffff",
      borderStyle: "solid",
      boxSizing: "border-box",
    },
    greetingTextContainer: { flex: 1, minWidth: 0 },
    headerGreeting: {
      fontSize: 15,
      fontWeight: 800,
      color: "#ffffff",
      letterSpacing: -0.2,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
    },
    locationSubtitleRow: {
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
      marginTop: 2,
      gap: 4,
    },
    locationSubtitleText: {
      fontSize: 11,
      fontWeight: 500,
      color: "#FED7AA",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
    },

    // Smart Search & Voice AI Prompt Bar
    searchBarContainer: {
      backgroundColor: "#ffffff",
      borderRadius: 16,
      padding: "8px 12px",
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      boxShadow: SHADOWS.medium,
      border: "1px solid #FED7AA",
      boxSizing: "border-box",
    },
    searchLeftContent: {
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
      marginRight: 8,
      gap: 8,
    },
    aiSparkleIconBox: {
      width: 26,
      height: 26,
      borderRadius: 8,
      backgroundColor: "#F26522",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      flexShrink: 0,
    },
    searchPlaceholder: {
      fontSize: 12,
      color: "#64748B",
      fontWeight: 500,
      flex: 1,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
    },
    searchActionsRight: {
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      flexShrink: 0,
    },
    micCircleBtn: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: "#FFF4ED",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      border: "1px solid #FED7AA",
      boxSizing: "border-box",
      cursor: "pointer",
      flexShrink: 0,
    },
    searchButtonCircle: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: "#EA580C",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      flexShrink: 0,
    },

    // 2. ELEVATED WALLET & POINTS DOCK
    elevatedDockWrapper: {
      paddingLeft: 16,
      paddingRight: 16,
      marginTop: -14,
      position: "relative",
      zIndex: 10,
    },
    elevatedDockCard: {
      backgroundColor: "#ffffff",
      borderRadius: 16,
      padding: "12px 14px",
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      border: "1px solid #E2E8F0",
      boxShadow: SHADOWS.medium,
      boxSizing: "border-box",
    },
    dockItem: {
      flex: 1,
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      minWidth: 0,
    },
    dockIconOrange: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: "#FFF4ED",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      border: "1px solid #FED7AA",
      boxSizing: "border-box",
      flexShrink: 0,
    },
    dockIconAmber: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: "#FEF3C7",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      border: "1px solid #FDE68A",
      boxSizing: "border-box",
      flexShrink: 0,
    },
    dockTextWrap: { flex: 1, minWidth: 0 },
    dockLabel: {
      fontSize: 9,
      fontWeight: 800,
      color: "#94A3B8",
      letterSpacing: 0.5,
    },
    dockValueRow: {
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: 2,
    },
    dockValueText: {
      fontSize: 13,
      fontWeight: 800,
      color: "#0F172A",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
    },
    dockPillOrange: {
      backgroundColor: "#FFF4ED",
      padding: "2px 6px",
      borderRadius: 6,
      flexShrink: 0,
    },
    dockPillOrangeText: { fontSize: 10, fontWeight: 800, color: "#F26522", whiteSpace: "nowrap" },
    dockPillAmber: {
      backgroundColor: "#FEF3C7",
      padding: "2px 6px",
      borderRadius: 6,
      flexShrink: 0,
    },
    dockPillAmberText: { fontSize: 10, fontWeight: 800, color: "#B45309", whiteSpace: "nowrap" },
    dockDivider: {
      width: 1,
      height: 28,
      backgroundColor: "#E2E8F0",
      margin: "0 8px",
      flexShrink: 0,
    },

    // SECTIONS COMMON
    sectionContainer: { marginTop: 18, paddingLeft: 16, paddingRight: 16 },
    sectionHeaderRow: {
      display: "flex",
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 10,
    },
    sectionTitleWithDot: {
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      minWidth: 0,
    },
    orangeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#F26522", flexShrink: 0 },
    sectionMainTitle: {
      fontSize: 14,
      fontWeight: 800,
      color: "#1E293B",
      textTransform: "uppercase",
      letterSpacing: 0.3,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
    },
    verifiedTag: {
      backgroundColor: "#FFF4ED",
      padding: "3px 8px",
      borderRadius: 6,
      flexShrink: 0,
    },
    verifiedTagText: { fontSize: 10, fontWeight: 800, color: "#F26522", whiteSpace: "nowrap" },
    seeAllText: { fontSize: 11, fontWeight: 700, color: "#F26522" },
    sectionSubhint: { fontSize: 10, fontWeight: 600, color: "#94A3B8" },

    // 3. PILLAR 1 (Gia sư 1:1)
    pillarPrimaryCard: {
      backgroundColor: "#ffffff",
      borderRadius: 18,
      padding: 14,
      border: "1.5px solid #FED7AA",
      position: "relative",
      overflow: "hidden",
      marginBottom: 10,
      boxShadow: SHADOWS.small,
      boxSizing: "border-box",
      cursor: "pointer",
    },
    pillarPrimaryAccentStripe: {
      position: "absolute",
      left: 0,
      top: 0,
      bottom: 0,
      width: 5,
      backgroundColor: "#F26522",
    },
    pillarPrimaryBody: {
      display: "flex",
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingLeft: 4,
      gap: 8,
    },
    pillarPrimaryLeft: {
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
      gap: 10,
      minWidth: 0,
    },
    pillarPrimaryIconBox: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: "#F26522",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      boxShadow: SHADOWS.small,
      flexShrink: 0,
    },
    pillarPrimaryInfo: { flex: 1, minWidth: 0 },
    pillarPrimaryTitleRow: {
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      flexWrap: "wrap",
    },
    pillarPrimaryTitle: { fontSize: 13, fontWeight: 800, color: "#0F172A" },
    hotBadge: {
      backgroundColor: "#FFF4ED",
      padding: "2px 6px",
      borderRadius: 6,
      border: "1px solid #FED7AA",
      boxSizing: "border-box",
    },
    hotBadgeText: { fontSize: 9, fontWeight: 800, color: "#C2410C" },
    pillarPrimaryDesc: {
      fontSize: 11,
      color: "#64748B",
      marginTop: 2,
      lineHeight: "15px",
    },
    univBadge: {
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: "#ECFDF5",
      padding: "2px 6px",
      borderRadius: 4,
      marginTop: 6,
      alignSelf: "flex-start",
    },
    univBadgeText: { fontSize: 9, fontWeight: 700, color: "#065F46" },
    pillarPrimaryPriceCol: {
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-end",
      marginLeft: 8,
      flexShrink: 0,
    },
    priceLead: { fontSize: 9, color: "#94A3B8", fontWeight: 600 },
    priceNumOrange: { fontSize: 14, fontWeight: 900, color: "#F26522" },
    priceUnit: { fontSize: 10, fontWeight: 600, color: "#64748B" },
    btnBookOrange: {
      backgroundColor: "#F26522",
      padding: "4px 8px",
      borderRadius: 8,
      marginTop: 6,
    },
    btnBookOrangeText: { fontSize: 10, fontWeight: 800, color: "#ffffff", whiteSpace: "nowrap" },

    // 2-COL SECONDARY PILLARS
    twoColPillarsRow: {
      display: "flex",
      flexDirection: "row",
      gap: 10,
      marginBottom: 10,
    },
    pillarSecondaryCardEmerald: {
      flex: 1,
      minWidth: 0,
      backgroundColor: "#ffffff",
      borderRadius: 16,
      padding: 12,
      border: "1px solid #A7F3D0",
      position: "relative",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      boxShadow: SHADOWS.small,
      boxSizing: "border-box",
      cursor: "pointer",
    },
    pillarSecondaryStripeEmerald: {
      position: "absolute",
      left: 0,
      top: 0,
      bottom: 0,
      width: 4,
      backgroundColor: "#059669",
    },
    pillarSecondaryCardBlue: {
      flex: 1,
      minWidth: 0,
      backgroundColor: "#ffffff",
      borderRadius: 16,
      padding: 12,
      border: "1px solid #BFDBFE",
      position: "relative",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      boxShadow: SHADOWS.small,
      boxSizing: "border-box",
      cursor: "pointer",
    },
    pillarSecondaryStripeBlue: {
      position: "absolute",
      left: 0,
      top: 0,
      bottom: 0,
      width: 4,
      backgroundColor: "#2563EB",
    },
    pillarSecondaryTop: {
      display: "flex",
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingLeft: 2,
    },
    pillarSecondaryIconBoxEmerald: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: "#ECFDF5",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
    },
    pillarSecondaryIconBoxBlue: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: "#EFF6FF",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
    },
    tagEmerald: { backgroundColor: "#ECFDF5", padding: "2px 6px", borderRadius: 6 },
    tagEmeraldText: { fontSize: 9, fontWeight: 800, color: "#047857" },
    tagBlue: { backgroundColor: "#EFF6FF", padding: "2px 6px", borderRadius: 6 },
    tagBlueText: { fontSize: 9, fontWeight: 800, color: "#1D4ED8" },
    pillarSecondaryContent: { marginTop: 8, paddingLeft: 2 },
    pillarSecondaryTitle: { fontSize: 12, fontWeight: 800, color: "#0F172A" },
    pillarSecondaryDesc: { fontSize: 10, color: "#64748B", marginTop: 2, lineHeight: "13px" },
    featureEmeraldText: { fontSize: 9, fontWeight: 700, color: "#047857", marginTop: 4 },
    featureBlueText: { fontSize: 9, fontWeight: 700, color: "#1D4ED8", marginTop: 4 },
    pillarSecondaryBottom: {
      display: "flex",
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 10,
      paddingTop: 8,
      borderTop: "1px solid #F1F5F9",
      paddingLeft: 2,
      gap: 4,
    },
    priceNumEmerald: { fontSize: 12, fontWeight: 900, color: "#059669" },
    priceNumBlue: { fontSize: 12, fontWeight: 900, color: "#2563EB" },
    btnBookEmerald: { backgroundColor: "#ECFDF5", padding: "3px 7px", borderRadius: 6, flexShrink: 0 },
    btnBookEmeraldText: { fontSize: 10, fontWeight: 800, color: "#059669", whiteSpace: "nowrap" },
    btnBookBlue: { backgroundColor: "#EFF6FF", padding: "3px 7px", borderRadius: 6, flexShrink: 0 },
    btnBookBlueText: { fontSize: 10, fontWeight: 800, color: "#2563EB", whiteSpace: "nowrap" },

    // PILLAR 4: AI FAST BOOKING BANNER
    aiFastBookingBanner: {
      backgroundColor: "#F26522",
      borderRadius: 16,
      padding: "12px 14px",
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      boxShadow: SHADOWS.small,
      cursor: "pointer",
    },
    aiBannerLeft: { flex: 1, marginRight: 10, minWidth: 0 },
    aiBannerTitleRow: {
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    aiBannerEmoji: { fontSize: 14 },
    aiBannerTitle: { fontSize: 13, fontWeight: 800, color: "#ffffff" },
    aiBannerSubtitle: {
      fontSize: 10,
      color: "rgba(255, 255, 255, 0.9)",
      marginTop: 2,
      lineHeight: "14px",
    },
    aiBannerButton: {
      backgroundColor: "#ffffff",
      padding: "6px 10px",
      borderRadius: 10,
      boxShadow: SHADOWS.small,
      flexShrink: 0,
    },
    aiBannerButtonText: { fontSize: 11, fontWeight: 800, color: "#F26522", whiteSpace: "nowrap" },

    // STITCH SHOWCASE BANNER
    stitchShowcaseBanner: {
      backgroundColor: "#FFFFFF",
      border: "1.5px solid #FED7AA",
      borderRadius: 16,
      padding: "12px 14px",
      marginTop: 10,
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      boxShadow: SHADOWS.small,
      cursor: "pointer",
      boxSizing: "border-box",
    },
    stitchShowcaseLeft: { flex: 1, marginRight: 10, minWidth: 0 },
    stitchShowcasePillRow: {
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginBottom: 4,
      flexWrap: "wrap",
    },
    stitchShowcasePill: {
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "#ECFDF5",
      padding: "2px 7px",
      borderRadius: 6,
      border: "1px solid #A7F3D0",
      boxSizing: "border-box",
    },
    stitchShowcasePillText: { fontSize: 9.5, fontWeight: 800, color: "#047857", letterSpacing: 0.2 },
    stitchShowcaseBadge: {
      backgroundColor: "#FFF7ED",
      padding: "2px 6px",
      borderRadius: 6,
      border: "1px solid #FED7AA",
      boxSizing: "border-box",
    },
    stitchShowcaseBadgeText: { fontSize: 9.5, fontWeight: 800, color: "#EA580C" },
    stitchShowcaseTitle: { fontSize: 13.5, fontWeight: 800, color: "#1A1A2E" },
    stitchShowcaseSubtitle: {
      fontSize: 10,
      color: "#64748B",
      marginTop: 2,
      lineHeight: "14px",
    },
    stitchShowcaseBtn: {
      backgroundColor: "#F26522",
      padding: "8px 10px",
      borderRadius: 10,
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
      boxShadow: SHADOWS.small,
      flexShrink: 0,
    },
    stitchShowcaseBtnText: { fontSize: 11, fontWeight: 800, color: "#ffffff", whiteSpace: "nowrap" },

    // 4. RADAR ACTIVE LIVE TRACKING
    radarCardContainer: {
      backgroundColor: "#ffffff",
      borderRadius: 16,
      border: "1.5px solid #93C5FD",
      padding: 14,
      boxShadow: SHADOWS.small,
      boxSizing: "border-box",
    },
    radarHeaderRow: {
      display: "flex",
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingBottom: 8,
      borderBottom: "1px solid #F1F5F9",
    },
    radarStatusGroup: {
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      minWidth: 0,
    },
    radarStatusTitle: {
      fontSize: 10,
      fontWeight: 900,
      color: "#1D4ED8",
      letterSpacing: 0.3,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
    },
    radarEtaBadge: { backgroundColor: "#EFF6FF", padding: "2px 8px", borderRadius: 10, flexShrink: 0 },
    radarEtaText: { fontSize: 10, fontWeight: 800, color: "#1E40AF", whiteSpace: "nowrap" },
    radarBodyRow: {
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
      padding: "10px 0",
      gap: 10,
    },
    radarAvatarCircle: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: "#EFF6FF",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      border: "1.5px solid #BFDBFE",
      boxSizing: "border-box",
      flexShrink: 0,
    },
    radarInfoCol: { flex: 1, minWidth: 0 },
    radarJobTitle: {
      fontSize: 13,
      fontWeight: 800,
      color: "#0F172A",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
    },
    radarSlotTime: {
      fontSize: 11,
      color: "#64748B",
      marginTop: 1,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
    },
    radarRouteBadge: {
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: "#EFF6FF",
      padding: "2px 6px",
      borderRadius: 4,
      marginTop: 4,
      alignSelf: "flex-start",
    },
    radarRouteText: { fontSize: 9, fontWeight: 700, color: "#1D4ED8" },
    radarActionsGroup: { display: "flex", flexDirection: "column", gap: 6, paddingTop: 4 },
    radarPrimaryActionBtn: {
      backgroundColor: "#2563EB",
      borderRadius: 10,
      padding: "8px 0",
      display: "flex",
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
    },
    radarPrimaryActionText: { fontSize: 11, fontWeight: 800, color: "#ffffff" },
    radarSecondaryRow: {
      display: "flex",
      flexDirection: "row",
      gap: 8,
    },
    radarSmallCallBtn: {
      flex: 1,
      backgroundColor: "#F1F5F9",
      borderRadius: 8,
      padding: "6px 0",
      display: "flex",
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
    },
    radarSmallCallText: { fontSize: 10, fontWeight: 700, color: "#374151" },
    radarSmallSosBtn: {
      flex: 1,
      backgroundColor: "#FEF2F2",
      borderRadius: 8,
      padding: "6px 0",
      display: "flex",
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      border: "1px solid #FECACA",
      boxSizing: "border-box",
    },
    radarSmallSosText: { fontSize: 10, fontWeight: 800, color: "#DC2626" },

    // 5. RECENT ACTIVITY
    recentListContainer: { display: "flex", flexDirection: "column", gap: 8 },
    recentCardItem: {
      backgroundColor: "#ffffff",
      borderRadius: 14,
      padding: 12,
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
      border: "1px solid #E2E8F0",
      boxShadow: SHADOWS.small,
      boxSizing: "border-box",
      cursor: "pointer",
    },
    recentIconBox: {
      width: 36,
      height: 36,
      borderRadius: 10,
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      marginRight: 10,
      flexShrink: 0,
    },
    recentInfoCol: { flex: 1, marginRight: 6, minWidth: 0 },
    recentTitleRow: {
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 6,
    },
    recentTitleText: {
      fontSize: 12,
      fontWeight: 800,
      color: "#0F172A",
      flex: 1,
      minWidth: 0,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
    },
    recentBadge: { padding: "2px 6px", borderRadius: 6, flexShrink: 0 },
    recentBadgeText: { fontSize: 9, fontWeight: 800, whiteSpace: "nowrap" },
    recentTimeText: {
      fontSize: 10,
      color: "#64748B",
      marginTop: 2,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
    },
    recentDetailBtnWrap: {
      backgroundColor: "#FFF4ED",
      padding: "4px 8px",
      borderRadius: 6,
      flexShrink: 0,
    },
    recentDetailBtnText: { fontSize: 10, fontWeight: 800, color: "#F26522", whiteSpace: "nowrap" },
    emptyBookingsCard: {
      backgroundColor: "#FFF9F5",
      borderRadius: 14,
      border: "1.5px dashed #FED7AA",
      padding: 16,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      cursor: "pointer",
    },
    emptyPlusCircle: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: "#FFF4ED",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 8,
    },
    emptyBookingsTitle: { fontSize: 13, fontWeight: 800, color: "#C2410C" },
    emptyBookingsSubtitle: {
      fontSize: 11,
      color: "#9A3412",
      textAlign: "center",
      marginTop: 2,
    },

    // 6. PROMOTIONAL CAROUSEL
    promoScrollContainer: { display: "flex", flexDirection: "row", gap: 10 },
    promoVoucherCard: {
      width: 250,
      flexShrink: 0,
      backgroundColor: "#F26522",
      borderRadius: 16,
      padding: 12,
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      boxShadow: SHADOWS.small,
      cursor: "pointer",
      boxSizing: "border-box",
    },
    voucherCodePill: {
      backgroundColor: "rgba(255, 255, 255, 0.25)",
      padding: "2px 6px",
      borderRadius: 10,
      alignSelf: "flex-start",
      marginBottom: 6,
    },
    voucherCodeText: { fontSize: 9, fontWeight: 900, color: "#ffffff" },
    voucherTitle: { fontSize: 12, fontWeight: 800, color: "#ffffff", lineHeight: "16px" },
    voucherDesc: { fontSize: 10, color: "rgba(255, 255, 255, 0.85)", marginTop: 2 },
    voucherBottomRow: {
      display: "flex",
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 10,
    },
    voucherExpiryText: { fontSize: 9, color: "rgba(255, 255, 255, 0.9)", fontWeight: 600 },
    voucherSaveBtn: {
      backgroundColor: "#ffffff",
      padding: "3px 8px",
      borderRadius: 6,
      cursor: "pointer",
    },
    voucherSaveText: { fontSize: 10, fontWeight: 800, color: "#F26522" },
    promoGuaranteeCard: {
      width: 250,
      flexShrink: 0,
      backgroundColor: "#047857",
      borderRadius: 16,
      padding: 12,
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      boxShadow: SHADOWS.small,
      cursor: "pointer",
      boxSizing: "border-box",
    },
    guaranteeTagPill: {
      backgroundColor: "rgba(255, 255, 255, 0.25)",
      padding: "2px 6px",
      borderRadius: 10,
      alignSelf: "flex-start",
      marginBottom: 6,
    },
    guaranteeTagText: { fontSize: 9, fontWeight: 900, color: "#ffffff" },
    guaranteeTitle: { fontSize: 12, fontWeight: 800, color: "#ffffff", lineHeight: "16px" },
    guaranteeDesc: { fontSize: 10, color: "rgba(255, 255, 255, 0.85)", marginTop: 2 },
    guaranteeBottomRow: {
      display: "flex",
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 10,
    },
    guaranteeSubText: { fontSize: 9, color: "rgba(255, 255, 255, 0.9)", fontWeight: 600 },
    guaranteeActionBtn: { backgroundColor: "#ffffff", padding: "3px 8px", borderRadius: 6 },
    guaranteeActionText: { fontSize: 10, fontWeight: 800, color: "#047857" },

    // 7. TRUST & SAFETY FOOTER
    trustFooterCard: {
      backgroundColor: "#ffffff",
      borderRadius: 16,
      padding: 12,
      border: "1px solid #E2E8F0",
      display: "flex",
      flexDirection: "column",
      gap: 6,
      boxShadow: SHADOWS.small,
      boxSizing: "border-box",
    },
    trustFooterHeader: {
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginBottom: 2,
    },
    trustFooterTitle: {
      fontSize: 11,
      fontWeight: 900,
      color: "#0F172A",
      textTransform: "uppercase",
    },
    trustItemRow: {
      display: "flex",
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 6,
    },
    trustItemText: { fontSize: 11, color: "#475569", lineHeight: "15px", flex: 1 },
    trustItemBold: { fontWeight: 700, color: "#0F172A" },
  };

  return (
    <Screen bg="#F8FAFC">
      {/* CSS cục bộ: ẩn scrollbar carousel ngang (RN showsHorizontalScrollIndicator={false}) */}
      <style>{".edc-hscroll{scrollbar-width:none;-ms-overflow-style:none}.edc-hscroll::-webkit-scrollbar{display:none}"}</style>

      <div style={{ paddingBottom: 32 }}>
        {/* ============================================================ */}
        {/* 1. HERO TOP BRAND HEADER (#F26522 PHẲNG)                      */}
        {/* ============================================================ */}
        <div style={s.headerContainer}>
          <StatusBarSpacer />
          {/* Top Row: Logo thương hiệu + User Profile Greeting & Notification */}
          <div style={s.headerTopRow}>
            <img src="/static/images/logo.png" alt="EduCareLink" style={s.headerBrandLogo} />
            <div
              style={s.userInfoRow}
              onClick={() => {
                if (longPressFiredRef.current) {
                  longPressFiredRef.current = false;
                  return;
                }
                nav.navigate("ParentProfile"); // RN: navigate('ParentTabs', { screen: 'ParentProfile' })
              }}
              onPointerDown={startLongPress}
              onPointerUp={endLongPress}
              onPointerLeave={endLongPress}
              onPointerCancel={endLongPress}
            >
              <div style={s.avatarWrapper}>
                <div style={s.avatarCircle}>
                  <Icon name="person" size={20} color="#F26522" />
                </div>
                <div style={s.onlineBadge} />
              </div>

              <div style={s.greetingTextContainer}>
                <div style={s.headerGreeting}>
                  Chào buổi {greetWord}, {displayName} 👋
                </div>
                <div style={s.locationSubtitleRow}>
                  <Icon name="location" size={12} color="#FED7AA" />
                  <div style={s.locationSubtitleText}>
                    {user?.address || "Khu vực của bạn"} · EduCare An Toàn
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "row", alignItems: "center" }}>
              <NotificationBell variant="header" />
            </div>
          </div>

          {/* Integrated Smart Search & Voice AI Prompt Bar */}
          <Touchable
            style={s.searchBarContainer}
            activeOpacity={0.9}
            onPress={() => nav.navigate("JobTypeSelect")}
          >
            <div style={s.searchLeftContent}>
              <div style={s.aiSparkleIconBox}>
                <Icon name="sparkles" size={15} color="#ffffff" />
              </div>
              <div style={s.searchPlaceholder}>Bạn cần gia sư, bảo mẫu hay đón bé?</div>
            </div>

            <div style={s.searchActionsRight}>
              {/* stopPropagation: mic là nút lồng trong bar (giống TouchableOpacity lồng RN) */}
              <div
                style={s.micCircleBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  nav.navigate("Chatbot");
                }}
              >
                <Icon name="mic" size={16} color="#F26522" />
              </div>
              <div style={s.searchButtonCircle}>
                <Icon name="search" size={14} color="#ffffff" />
              </div>
            </div>
          </Touchable>
        </div>

        {/* ============================================================ */}
        {/* 2. ELEVATED WALLET & CAREREWARDS DOCK                         */}
        {/* ============================================================ */}
        <div style={s.elevatedDockWrapper}>
          <div style={s.elevatedDockCard}>
            {/* Wallet Info */}
            <Touchable
              style={s.dockItem}
              activeOpacity={0.7}
              onPress={() => nav.navigate("WalletCredits")}
            >
              <div style={s.dockIconOrange}>
                <Icon name="wallet-outline" size={18} color="#F26522" />
              </div>
              <div style={s.dockTextWrap}>
                <div style={s.dockLabel}>VÍ EDUCARE</div>
                <div style={s.dockValueRow}>
                  <div style={s.dockValueText}>{walletText}</div>
                  <div style={s.dockPillOrange}>
                    <span style={s.dockPillOrangeText}>+ Nạp</span>
                  </div>
                </div>
              </div>
            </Touchable>

            <div style={s.dockDivider} />

            {/* CarePoints — "340 pts" giữ mock như RN */}
            <Touchable
              style={s.dockItem}
              activeOpacity={0.7}
              onPress={() => nav.navigate("RewardPointsScreen")}
            >
              <div style={s.dockIconAmber}>
                <Icon name="star" size={18} color="#D97706" />
              </div>
              <div style={s.dockTextWrap}>
                <div style={s.dockLabel}>ĐIỂM THƯỞNG</div>
                <div style={s.dockValueRow}>
                  <div style={s.dockValueText}>340 pts</div>
                  <div style={s.dockPillAmber}>
                    <span style={s.dockPillAmberText}>Đổi quà ›</span>
                  </div>
                </div>
              </div>
            </Touchable>
          </div>
        </div>

        {/* ============================================================ */}
        {/* 3. CORE SERVICE PILLARS (Dịch vụ Chăm sóc & Đồng hành)        */}
        {/* ============================================================ */}
        <div style={s.sectionContainer}>
          <div style={s.sectionHeaderRow}>
            <div style={s.sectionTitleWithDot}>
              <div style={s.orangeDot} />
              <div style={s.sectionMainTitle}>Dịch vụ Chăm sóc & Đồng hành</div>
            </div>
            <div style={s.verifiedTag}>
              <span style={s.verifiedTagText}>Chuẩn 3 Lớp Xác Thực</span>
            </div>
          </div>

          {/* PILLAR 1: Gia sư & Kèm học 1:1 (Dominant Signature Orange) */}
          <Touchable
            style={s.pillarPrimaryCard}
            activeOpacity={0.9}
            onPress={() => nav.navigate("TutoringForm")}
          >
            <div style={s.pillarPrimaryAccentStripe} />
            <div style={s.pillarPrimaryBody}>
              <div style={s.pillarPrimaryLeft}>
                <div style={s.pillarPrimaryIconBox}>
                  <Icon name="school" size={24} color="#ffffff" />
                </div>
                <div style={s.pillarPrimaryInfo}>
                  <div style={s.pillarPrimaryTitleRow}>
                    <span style={s.pillarPrimaryTitle}>Gia sư & Kèm học 1:1</span>
                    <div style={s.hotBadge}>
                      <span style={s.hotBadgeText}>🔥 Đặt nhiều nhất</span>
                    </div>
                  </div>
                  <div style={s.pillarPrimaryDesc}>
                    Toán, Tiếng Việt, Tiếng Anh, Đàn piano & Luyện chữ
                  </div>
                  <div style={s.univBadge}>
                    <Icon name="checkmark-circle" size={12} color="#059669" />
                    <span style={s.univBadgeText}>100% sinh viên các trường thuộc Đại học Huế</span>
                  </div>
                </div>
              </div>

              <div style={s.pillarPrimaryPriceCol}>
                <span style={s.priceLead}>Chỉ từ</span>
                <span style={s.priceNumOrange}>
                  70k<span style={s.priceUnit}>/h</span>
                </span>
                <div style={s.btnBookOrange}>
                  <span style={s.btnBookOrangeText}>Đặt ngay →</span>
                </div>
              </div>
            </div>
          </Touchable>

          {/* PILLARS 2 & 3: 2-Column Compact Row */}
          <div style={s.twoColPillarsRow}>
            {/* PILLAR 2: Đồng hành cùng trẻ tại nhà (Emerald Accent) */}
            <Touchable
              style={s.pillarSecondaryCardEmerald}
              activeOpacity={0.9}
              onPress={() => nav.navigate("ChildcareForm")}
            >
              <div style={s.pillarSecondaryStripeEmerald} />
              <div style={s.pillarSecondaryTop}>
                <div style={s.pillarSecondaryIconBoxEmerald}>
                  <Icon name="heart" size={20} color="#059669" />
                </div>
                <div style={s.tagEmerald}>
                  <span style={s.tagEmeraldText}>❤️ Tận tâm</span>
                </div>
              </div>

              <div style={s.pillarSecondaryContent}>
                <div style={s.pillarSecondaryTitle}>Đồng hành cùng trẻ tại nhà</div>
                <div style={s.pillarSecondaryDesc}>Ăn uống, chơi & rèn thói quen tự lập</div>
                <div style={s.featureEmeraldText}>✓ Sơ cấp cứu y tế</div>
              </div>

              <div style={s.pillarSecondaryBottom}>
                <span style={s.priceNumEmerald}>
                  60k<span style={s.priceUnit}>/h</span>
                </span>
                <div style={s.btnBookEmerald}>
                  <span style={s.btnBookEmeraldText}>Đặt ca →</span>
                </div>
              </div>
            </Touchable>

            {/* PILLAR 3: Đón trẻ tan học (Mobility Blue Accent) */}
            <Touchable
              style={s.pillarSecondaryCardBlue}
              activeOpacity={0.9}
              onPress={() => nav.navigate("PickupForm")}
            >
              <div style={s.pillarSecondaryStripeBlue} />
              <div style={s.pillarSecondaryTop}>
                <div style={s.pillarSecondaryIconBoxBlue}>
                  <Icon name="navigate" size={20} color="#2563EB" />
                </div>
                <div style={s.tagBlue}>
                  <span style={s.tagBlueText}>📍 Live GPS</span>
                </div>
              </div>

              <div style={s.pillarSecondaryContent}>
                <div style={s.pillarSecondaryTitle}>Đón trẻ tan học</div>
                <div style={s.pillarSecondaryDesc}>Từ cổng trường về tận cửa nhà</div>
                <div style={s.featureBlueText}>✓ Check-in ảnh phụ huynh</div>
              </div>

              <div style={s.pillarSecondaryBottom}>
                <span style={s.priceNumBlue}>
                  50k<span style={s.priceUnit}>/chuyến</span>
                </span>
                <div style={s.btnBookBlue}>
                  <span style={s.btnBookBlueText}>Đặt xe →</span>
                </div>
              </div>
            </Touchable>
          </div>

          {/* PILLAR 4: Đăng việc siêu tốc với AI Banner */}
          <Touchable
            style={s.aiFastBookingBanner}
            activeOpacity={0.9}
            onPress={() => nav.navigate("Chatbot")}
          >
            <div style={s.aiBannerLeft}>
              <div style={s.aiBannerTitleRow}>
                <span style={s.aiBannerEmoji}>⚡</span>
                <span style={s.aiBannerTitle}>Đăng việc siêu tốc trong 5 giây</span>
              </div>
              <div style={s.aiBannerSubtitle}>
                Nói hoặc gõ tự nhiên, AI tự động ghép CarePartner phù hợp nhất
              </div>
            </div>
            <div style={s.aiBannerButton}>
              <span style={s.aiBannerButtonText}>Thử ngay →</span>
            </div>
          </Touchable>

          {/* PILLAR 5 / SHOWCASE: Danh sách ứng viên CarePartner tuyển chọn */}
          <Touchable
            style={s.stitchShowcaseBanner}
            activeOpacity={0.9}
            onPress={() => nav.navigate("CandidatesList")}
          >
            <div style={s.stitchShowcaseLeft}>
              <div style={s.stitchShowcasePillRow}>
                <div style={s.stitchShowcasePill}>
                  <Icon name="sparkles" size={12} color="#059669" style={{ marginRight: 4 }} />
                  <span style={s.stitchShowcasePillText}>AI GHÉP CẶP CHUẨN XÁC</span>
                </div>
                <div style={s.stitchShowcaseBadge}>
                  <span style={s.stitchShowcaseBadgeText}>TOP 8</span>
                </div>
              </div>
              <div style={s.stitchShowcaseTitle}>Ứng viên CarePartner Tuyển Chọn</div>
              <div style={s.stitchShowcaseSubtitle}>
                Thuật toán ELO đã quét & xếp hạng · 100% sinh viên các trường thuộc Đại học Huế
              </div>
            </div>
            <div style={s.stitchShowcaseBtn}>
              <span style={s.stitchShowcaseBtnText}>Xem ngay</span>
              <Icon name="arrow-forward" size={13} color="#ffffff" style={{ marginLeft: 3 }} />
            </div>
          </Touchable>
        </div>

        {/* ============================================================ */}
        {/* 4. ACTIVE LIVE TRACKING RADAR WIDGET (Nếu có ca đang chạy)    */}
        {/* ============================================================ */}
        {activeBooking && (
          <div style={s.sectionContainer}>
            <div style={s.radarCardContainer}>
              <div style={s.radarHeaderRow}>
                <div style={s.radarStatusGroup}>
                  <div style={pulseStyle} />
                  <div style={s.radarStatusTitle}>
                    {activeBooking.status === "in_progress"
                      ? "CA CHĂM SÓC ĐANG DIỄN RA"
                      : "CA ĐÃ KHÓA LỊCH CHỜ THỰC HIỆN"}
                  </div>
                </div>
                <div style={s.radarEtaBadge}>
                  <span style={s.radarEtaText}>{activeBooking.status_label_vi || "Đang giám sát"}</span>
                </div>
              </div>

              <div style={s.radarBodyRow}>
                <div style={s.radarAvatarCircle}>
                  <Icon name="shield-checkmark" size={22} color="#2563EB" />
                </div>
                <div style={s.radarInfoCol}>
                  <div style={s.radarJobTitle}>{activeBooking.job_title || "Ca chăm sóc & đồng hành"}</div>
                  <div style={s.radarSlotTime}>
                    {activeBooking.first_slot
                      ? `${activeBooking.first_slot.date} · ${activeBooking.first_slot.time_from} - ${activeBooking.first_slot.time_to}`
                      : "Đang theo dõi lịch trình"}
                  </div>
                  <div style={s.radarRouteBadge}>
                    <Icon name="location" size={11} color="#1D4ED8" />
                    <span style={s.radarRouteText}>Đã kết nối với CarePartner an toàn</span>
                  </div>
                </div>
              </div>

              <div style={s.radarActionsGroup}>
                <Touchable
                  style={s.radarPrimaryActionBtn}
                  activeOpacity={0.85}
                  onPress={() => nav.navigate("BookingDetail", { bookingId: activeBooking.id })}
                >
                  <Icon name="map-outline" size={15} color="#ffffff" style={{ marginRight: 6 }} />
                  <span style={s.radarPrimaryActionText}>Xem Live GPS & Nhật ký ca</span>
                </Touchable>

                <div style={s.radarSecondaryRow}>
                  <Touchable
                    style={s.radarSmallCallBtn}
                    activeOpacity={0.8}
                    onPress={() => nav.navigate("BookingDetail", { bookingId: activeBooking.id })}
                  >
                    <Icon name="call-outline" size={14} color="#374151" style={{ marginRight: 4 }} />
                    <span style={s.radarSmallCallText}>Chi tiết đơn</span>
                  </Touchable>

                  <Touchable
                    style={s.radarSmallSosBtn}
                    activeOpacity={0.8}
                    onPress={() =>
                      showAlert(
                        "Tổng đài Khẩn cấp SOS",
                        `Bạn cần hỗ trợ an toàn ngay lập tức? Hotline EduCareLink 24/7: ${SUPPORT_HOTLINE}`
                      )
                    }
                  >
                    <Icon name="warning-outline" size={14} color="#DC2626" style={{ marginRight: 4 }} />
                    <span style={s.radarSmallSosText}>SOS Khẩn cấp</span>
                  </Touchable>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* 5. RECENT ACTIVITY & CARE HISTORY (Lịch ca gần đây)           */}
        {/* ============================================================ */}
        <div style={s.sectionContainer}>
          <div style={s.sectionHeaderRow}>
            <div style={s.sectionMainTitle}>Lịch ca chăm sóc gần đây</div>
            {tasks.length > 0 && (
              <Touchable onPress={() => nav.navigate("MyTasks")} hitSlop={4}>
                <span style={s.seeAllText}>Xem tất cả ({tasks.length}) ›</span>
              </Touchable>
            )}
          </div>

          {isLoading ? (
            <div style={{ marginTop: 20, display: "flex", justifyContent: "center" }}>
              <Spinner size={20} color="#F26522" />
            </div>
          ) : tasks.length > 0 ? (
            <div style={s.recentListContainer}>
              {tasks.slice(0, 3).map((t) => {
                const st = TASK_STATUS_STYLE[t.status] || TASK_STATUS_STYLE.in_progress;
                return (
                  <Touchable
                    key={t.id}
                    style={s.recentCardItem}
                    activeOpacity={0.85}
                    onPress={() => nav.navigate("MyTasks")}
                  >
                    <div style={{ ...s.recentIconBox, backgroundColor: st.bg }}>
                      <Icon name={st.icon} size={20} color={st.color} />
                    </div>

                    <div style={s.recentInfoCol}>
                      <div style={s.recentTitleRow}>
                        <div style={s.recentTitleText}>{t.title || "Đơn ghép cặp"}</div>
                        <div style={{ ...s.recentBadge, backgroundColor: st.bg }}>
                          <span style={{ ...s.recentBadgeText, color: st.color }}>
                            {t.status_label_vi || st.label}
                          </span>
                        </div>
                      </div>
                      <div style={s.recentTimeText}>{formatTaskTime(t)}</div>
                    </div>

                    <div style={s.recentDetailBtnWrap}>
                      <span style={s.recentDetailBtnText}>Chi tiết</span>
                    </div>
                  </Touchable>
                );
              })}
            </div>
          ) : (
            <Touchable
              style={s.emptyBookingsCard}
              activeOpacity={0.85}
              onPress={() => nav.navigate("JobTypeSelect")}
            >
              <div style={s.emptyPlusCircle}>
                <Icon name="add" size={24} color="#F26522" />
              </div>
              <div style={s.emptyBookingsTitle}>Bạn chưa có đơn ghép cặp nào</div>
              <div style={s.emptyBookingsSubtitle}>
                Chạm vào đây để đăng việc và nhận gợi ý CarePartner trong 5 phút
              </div>
            </Touchable>
          )}
        </div>

        {/* ============================================================ */}
        {/* 6. PROMOTIONAL CAROUSEL & CAREREWARDS DEALS                   */}
        {/* ============================================================ */}
        <div style={s.sectionContainer}>
          <div style={s.sectionHeaderRow}>
            <div style={s.sectionMainTitle}>Ưu đãi & Cam kết EduCare</div>
            <span style={s.sectionSubhint}>Trượt xem thêm</span>
          </div>

          <div className="edc-hscroll" style={s.promoScrollContainer}>
            {/* Promo 1: Voucher */}
            <Touchable
              style={s.promoVoucherCard}
              activeOpacity={0.9}
              onPress={() => nav.navigate("RewardPointsScreen")}
            >
              <div>
                <div style={s.voucherCodePill}>
                  <span style={s.voucherCodeText}>MÃ: EDUCARE2026</span>
                </div>
                <div style={s.voucherTitle}>Giảm ngay 50.000đ cho ca Gia sư đầu tiên</div>
                <div style={s.voucherDesc}>Áp dụng cho mọi môn học và cấp lớp</div>
              </div>

              <div style={s.voucherBottomRow}>
                <span style={s.voucherExpiryText}>HSD: 30/09</span>
                {/* RN là View tĩnh; spec 5-b: "Lưu mã" → showAlert đã lưu (stopPropagation để không bubb lên card) */}
                <div
                  style={s.voucherSaveBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    showAlert("Đã lưu mã", "Mã EDUCARE2026 đã được lưu vào danh sách ưu đãi của bạn.");
                  }}
                >
                  <span style={s.voucherSaveText}>Lưu mã</span>
                </div>
              </div>
            </Touchable>

            {/* Promo 2: Guarantee */}
            <Touchable
              style={s.promoGuaranteeCard}
              activeOpacity={0.9}
              onPress={() => nav.navigate("HelpCenter")}
            >
              <div>
                <div style={s.guaranteeTagPill}>
                  <span style={s.guaranteeTagText}>BẢO VỆ 3 LỚP</span>
                </div>
                <div style={s.guaranteeTitle}>Cam kết hoàn tiền 100% nếu không hài lòng</div>
                <div style={s.guaranteeDesc}>Chính sách minh bạch & an tâm tuyệt đối</div>
              </div>

              <div style={s.guaranteeBottomRow}>
                <span style={s.guaranteeSubText}>EduCare Guarantee</span>
                <div style={s.guaranteeActionBtn}>
                  <span style={s.guaranteeActionText}>Tìm hiểu</span>
                </div>
              </div>
            </Touchable>
          </div>
        </div>

        {/* ============================================================ */}
        {/* 7. 3-LAYER TRUST & SAFETY ASSURANCE FOOTER                    */}
        {/* ============================================================ */}
        <div style={s.sectionContainer}>
          <div style={s.trustFooterCard}>
            <div style={s.trustFooterHeader}>
              <Icon name="shield-checkmark" size={16} color="#F26522" />
              <span style={s.trustFooterTitle}>Tiêu chuẩn An toàn EduCareLink</span>
            </div>

            <div style={s.trustItemRow}>
              <Icon name="checkmark-circle" size={15} color="#059669" style={{ marginTop: 2 }} />
              <div style={s.trustItemText}>
                <b style={s.trustItemBold}>100% CarePartner</b> đối soát CCCD gắn chip & thẻ SV ĐH Top.
              </div>
            </div>

            <div style={s.trustItemRow}>
              <Icon name="checkmark-circle" size={15} color="#2563EB" style={{ marginTop: 2 }} />
              <div style={s.trustItemText}>
                <b style={s.trustItemBold}>Ký quỹ an tâm:</b> Tiền được giữ qua MoMo Escrow, giải ngân
                khi hoàn thành.
              </div>
            </div>

            <div style={s.trustItemRow}>
              <Icon name="checkmark-circle" size={15} color="#D97706" style={{ marginTop: 2 }} />
              <div style={s.trustItemText}>
                <b style={s.trustItemBold}>Tổng đài 24/7</b> & Bảo hiểm tai nạn chuyến đi lên đến 50
                triệu đồng.
              </div>
            </div>
          </div>
        </div>

        {/* RN: <View style={{ height: 40 }} /> cuối ScrollView */}
        <div style={{ height: 40 }} />
      </div>
    </Screen>
  );
};

export default ParentHomeScreen;
