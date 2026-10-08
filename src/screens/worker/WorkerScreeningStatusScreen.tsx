/**
 * WorkerScreeningStatusScreen — port CHÍNH XÁC mobile/src/screens/Worker/WorkerScreeningStatusScreen.js (654 dòng).
 * Nhánh "chờ duyệt" của CarePartner: getProfile() + getMyCredentials() → ánh xạ
 * CredentialSubmission.status thành 5 bước thẩm định; API lỗi → fallback mock
 * MOCK_SCREENING_STATUS / APPROVED_SCREENING_STATUS (copy NGUYÊN từ
 * mobile/src/mocks/workerScreeningMock.js — nhúng cục bộ vì agent chỉ được ghi
 * đúng file màn hình này, không tạo được src/mocks/).
 *
 * Khác biệt platform (ghi mobile-parity-map.md):
 *  - StatusBar dark-content + paddingTop insets.top+32 → StatusBarSpacer + paddingTop 32.
 *  - Animated.timing fade (ANIM.timingNormal 250ms) → CSS transition opacity 0.25s + setState.
 *  - Alert.alert 1 nút → showAlert() / window.alert (showComingSoon port cục bộ).
 *  - openSupportHotline(Linking) → window.location.href = 'tel:...' (web không
 *    trả kết quả ok/fail như RN Linking — luôn thử, lỗi mới Alert hotline).
 *  - Icon thiếu glyph → alias cục bộ: hourglass→hourglass-outline,
 *    videocam→play, headset→headset-outline.
 */
import React, { useState, useEffect } from "react";
import Icon from "@/components/Icon";
import { Spinner, showAlert, StatusBarSpacer, Touchable } from "@/components/ui";
import { COLORS, SHADOWS, TYPO, ANIM, typo } from "@/theme";
import { useNav } from "@/navigation/router";
import { useAuth } from "@/context/AuthContext";
import { getMyCredentials } from "@/api/tasks";
import { getProfile } from "@/api/auth";

/* ── Alias icon: glyph RN không có trong ionicons.ts zalo → glyph gần nhất ── */
const ICON_ALIAS: Record<string, string> = {
  hourglass: "hourglass-outline",
  videocam: "play",
  headset: "headset-outline",
};
const ic = (name: string) => ICON_ALIAS[name] ?? name;

/* ── mobile/src/config/appConfig.js — hotline + showComingSoon (utils/comingSoon.js) ── */
const SUPPORT_HOTLINE = "0862427404";
const openSupportHotlineWeb = async (): Promise<boolean> => {
  try {
    window.location.href = `tel:${SUPPORT_HOTLINE}`;
    return true;
  } catch {
    return false;
  }
};
const showComingSoon = (featureName?: string) =>
  showAlert(
    "Thông báo",
    featureName
      ? `Tính năng "${featureName}" đang được phát triển. Vui lòng quay lại sau!`
      : "Tính năng đang được phát triển. Vui lòng quay lại sau!"
  );

/* ══════════ MOCK DATA — copy NGUYÊN mobile/src/mocks/workerScreeningMock.js ══════════ */
const MOCK_SCREENING_STATUS = {
  stage: "Phỏng vấn trực tuyến",
  estimatedHours: "24-48h làm việc",
  description: "EduCareLink đang rà soát thông tin của bạn. Kết quả sẽ có sau 24-48h làm việc.",
  steps: [
    { id: 1, label: "Xác minh danh tính (ID)", status: "done" },
    { id: 2, label: "Xác thực khuôn mặt", status: "done" },
    { id: 3, label: "Khám sức khỏe cơ bản", status: "done" },
    { id: 4, label: "Phỏng vấn chuyên môn", status: "pending" },
    { id: 5, label: "Duyệt hồ sơ cuối", status: "pending" },
  ],
  submittedDate: "15/05/2024",
  expectedDate: "17/05/2024",
};

// Variant cho worker đã duyệt — dùng khi user.is_verified === true
const APPROVED_SCREENING_STATUS = {
  stage: "Đã duyệt",
  estimatedHours: "Hoàn tất",
  description: "Hồ sơ của bạn đã được EduCareLink phê duyệt. Bạn có thể bắt đầu nhận việc ngay bây giờ.",
  steps: [
    { id: 1, label: "Xác minh danh tính (ID)", status: "done" },
    { id: 2, label: "Xác thực khuôn mặt", status: "done" },
    { id: 3, label: "Khám sức khỏe cơ bản", status: "done" },
    { id: 4, label: "Phỏng vấn chuyên môn", status: "done" },
    { id: 5, label: "Duyệt hồ sơ cuối", status: "done" },
  ],
  submittedDate: "15/05/2024",
  expectedDate: "17/05/2024",
};

/* ══════════ buildScreeningFromAPI — nguyên văn logic RN ══════════ */
interface ScreeningStep {
  id: number;
  label: string;
  status: "done" | "pending" | "rejected";
}
interface ScreeningStatus {
  stage: string;
  description: string;
  steps: ScreeningStep[];
  submittedDate: string;
  expectedDate: string;
  adminReview?: string;
}

function buildScreeningFromAPI(user: any, credentials: any[]): ScreeningStatus {
  // Trường hợp đã được admin duyệt tài khoản
  if (user?.is_approved) {
    return {
      stage: "Đã duyệt",
      description:
        "Tài khoản Carepartner của bạn đã được Admin phê duyệt. Bạn có thể bắt đầu nhận việc ngay.",
      steps: [
        { id: 1, label: "Xác minh danh tính (ID)", status: "done" },
        { id: 2, label: "Xác thực khuôn mặt", status: "done" },
        { id: 3, label: "Khám sức khỏe cơ bản", status: "done" },
        { id: 4, label: "Phỏng vấn chuyên môn", status: "done" },
        { id: 5, label: "Duyệt hồ sơ cuối", status: "done" },
      ],
      submittedDate:
        credentials?.length > 0
          ? new Date(credentials[0].created_at).toLocaleDateString("vi-VN")
          : "—",
      expectedDate: "—",
    };
  }

  // Có credential submissions
  if (credentials && credentials.length > 0) {
    // Lấy submission mới nhất
    const latest = credentials[0]; // Backend trả theo created_at desc
    const status = latest.status; // pending | approved | rejected
    const submittedDate = new Date(latest.created_at).toLocaleDateString("vi-VN");

    // Nếu có admin_review (lý do từ chối)
    const adminReview = latest.admin_review || "";

    if (status === "approved") {
      return {
        stage: "Đã duyệt bằng cấp",
        description: "Bằng cấp của bạn đã được duyệt. Đang chờ Admin phê duyệt tài khoản cuối cùng.",
        steps: [
          { id: 1, label: "Xác minh danh tính (ID)", status: user?.is_verified ? "done" : "pending" },
          { id: 2, label: "Xác thực khuôn mặt", status: user?.is_verified ? "done" : "pending" },
          { id: 3, label: "Nộp bằng cấp/chứng chỉ", status: "done" },
          { id: 4, label: "Duyệt bằng cấp", status: "done" },
          { id: 5, label: "Duyệt tài khoản cuối", status: "pending" },
        ],
        submittedDate,
        expectedDate: "—",
        adminReview: "",
      };
    }

    if (status === "rejected") {
      return {
        stage: "Bị từ chối",
        description: adminReview
          ? `Lý do: ${adminReview}`
          : "Bằng cấp của bạn không được chấp nhận. Vui lòng nộp lại bằng cấp khác.",
        steps: [
          { id: 1, label: "Xác minh danh tính (ID)", status: user?.is_verified ? "done" : "pending" },
          { id: 2, label: "Xác thực khuôn mặt", status: user?.is_verified ? "done" : "pending" },
          { id: 3, label: "Nộp bằng cấp/chứng chỉ", status: "done" },
          { id: 4, label: "Duyệt bằng cấp", status: "rejected" },
          { id: 5, label: "Duyệt tài khoản cuối", status: "pending" },
        ],
        submittedDate,
        expectedDate: "—",
        adminReview,
      };
    }

    // pending
    return {
      stage: "Đang thẩm định bằng cấp",
      description: "Bằng cấp của bạn đang được Admin xem xét. Kết quả sẽ có sau 24-48h làm việc.",
      steps: [
        { id: 1, label: "Xác minh danh tính (ID)", status: user?.is_verified ? "done" : "pending" },
        { id: 2, label: "Xác thực khuôn mặt", status: user?.is_verified ? "done" : "pending" },
        { id: 3, label: "Nộp bằng cấp/chứng chỉ", status: "done" },
        { id: 4, label: "Duyệt bằng cấp", status: "pending" },
        { id: 5, label: "Duyệt tài khoản cuối", status: "pending" },
      ],
      submittedDate,
      expectedDate: "24-48h làm việc",
      adminReview: "",
    };
  }

  // Chưa có credential submission nào
  if (user?.is_verified) {
    return {
      stage: "Chờ nộp bằng cấp",
      description: "Đã xác minh danh tính. Bạn cần nộp bằng cấp/chứng chỉ để hoàn tất thẩm định.",
      steps: [
        { id: 1, label: "Xác minh danh tính (ID)", status: "done" },
        { id: 2, label: "Xác thực khuôn mặt", status: "done" },
        { id: 3, label: "Nộp bằng cấp/chứng chỉ", status: "pending" },
        { id: 4, label: "Duyệt bằng cấp", status: "pending" },
        { id: 5, label: "Duyệt tài khoản cuối", status: "pending" },
      ],
      submittedDate: "—",
      expectedDate: "—",
    };
  }

  // Chưa xác minh, chưa nộp bằng cấp
  return {
    stage: "Chờ xác minh",
    description:
      "Hồ sơ của bạn đang chờ xác minh danh tính. Vui lòng đảm bảo đã tải lên ảnh CCCD và ảnh chân dung.",
    steps: [
      { id: 1, label: "Xác minh danh tính (ID)", status: "pending" },
      { id: 2, label: "Xác thực khuôn mặt", status: "pending" },
      { id: 3, label: "Nộp bằng cấp/chứng chỉ", status: "pending" },
      { id: 4, label: "Duyệt bằng cấp", status: "pending" },
      { id: 5, label: "Duyệt tài khoản cuối", status: "pending" },
    ],
    submittedDate: "—",
    expectedDate: "—",
  };
}

const STEP_STATUS_STYLE: Record<
  string,
  { iconBg: string; iconColor: string; icon: string; label: string; labelColor: string; opacity: number }
> = {
  done: {
    iconBg: COLORS.secondaryLight,
    iconColor: COLORS.secondaryDark,
    icon: "checkmark",
    label: "Hoàn tất",
    labelColor: COLORS.secondaryDark,
    opacity: 1,
  },
  pending: {
    iconBg: COLORS.surfaceContainerHigh,
    iconColor: COLORS.onSurfaceVariant,
    icon: "time",
    label: "Đang chờ",
    labelColor: COLORS.onSurfaceVariant,
    opacity: 0.6,
  },
  rejected: {
    iconBg: COLORS.errorContainer,
    iconColor: COLORS.errorDeep,
    icon: "close",
    label: "Từ chối",
    labelColor: COLORS.errorDeep,
    opacity: 1,
  },
};

/* ── Styles (StyleSheet.create RN → CSS 1:1) ── */
const S: Record<string, React.CSSProperties> = {
  container: {
    flex: 1,
    minHeight: "100dvh",
    background: COLORS.surfaceWarm,
    display: "flex",
    flexDirection: "column",
  },
  backBtn: { marginTop: 12, padding: "8px 20px" },
  // === APP BAR ===
  appBar: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 12px 12px",
    background: COLORS.surface,
    borderBottom: `1px solid ${COLORS.outlineVariant}`,
  },
  appBarBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  appBarTitle: { ...typo("h3"), color: COLORS.onSurface },
  // === SCROLL ===
  scrollView: { flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" },
  scrollContent: { display: "flex", flexDirection: "column", padding: "24px 20px 40px", gap: 20 },
  // === HERO CARD ===
  heroCard: {
    background: COLORS.surface,
    borderRadius: 14,
    padding: 24,
    alignItems: "center",
    border: `1px solid ${COLORS.outlineVariant}`,
    boxShadow: SHADOWS.medium,
    gap: 16,
    display: "flex",
    flexDirection: "column",
  },
  illustrationCircle: {
    width: 192,
    height: 192,
    borderRadius: 96,
    background: COLORS.primaryLight,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    border: `1px solid ${COLORS.primarySoft}`,
  },
  illustrationCircleRejected: {
    background: COLORS.errorContainer,
    borderColor: "#fca5a5",
  },
  heroTitle: { ...typo("h3"), color: COLORS.primary, textAlign: "center" },
  heroSubtitle: {
    ...typo("body", { lineHeight: "22px" }),
    color: COLORS.onSurfaceVariant,
    textAlign: "center",
    maxWidth: 280,
  },
  stageBadge: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    background: COLORS.primaryLight,
    borderRadius: 999,
    padding: "6px 14px",
    border: `1px solid ${COLORS.primarySoft}`,
    boxShadow: SHADOWS.small,
  },
  stageBadgeRejected: {
    background: COLORS.errorContainer,
    borderColor: "#fca5a5",
  },
  stageBadgeText: {
    ...TYPO.caption,
    lineHeight: "16px",
    color: COLORS.primary,
    fontWeight: 700,
    letterSpacing: 1,
  },
  // === ADMIN REVIEW BANNER ===
  reviewBanner: {
    display: "flex",
    flexDirection: "row",
    gap: 10,
    background: COLORS.errorContainer,
    borderRadius: 12,
    padding: 14,
    border: "1px solid #fca5a5",
  },
  reviewBannerText: {
    flex: 1,
    ...typo("body", { fontSize: 13, lineHeight: "20px" }),
    color: COLORS.errorDeep,
  },
  // === ESTIMATED CARD ===
  estimatedCard: {
    background: COLORS.surface,
    borderRadius: 14,
    padding: 16,
    border: `1px solid ${COLORS.outlineVariant}`,
    boxShadow: SHADOWS.small,
  },
  estimatedItem: { display: "flex", flexDirection: "row", alignItems: "center", gap: 12 },
  estimatedLabel: { ...typo("caption"), color: COLORS.onSurfaceVariant },
  estimatedValue: { ...typo("h4"), color: COLORS.onSurface, marginTop: 2 },
  estimatedDivider: { height: 1, background: COLORS.outlineVariant, margin: "12px 0" },
  // === PROGRESS CARD ===
  progressCard: {
    background: COLORS.surface,
    borderRadius: 14,
    padding: 16,
    border: `1px solid ${COLORS.outlineVariant}`,
    boxShadow: SHADOWS.small,
  },
  progressHeader: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  progressTitle: { ...typo("h4"), color: COLORS.onSurface },
  progressCount: { ...typo("caption"), color: COLORS.primary, fontWeight: 700 },
  progressBarBg: {
    width: "100%",
    height: 8,
    background: COLORS.surfaceContainerHigh,
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 16,
  },
  progressBarFill: { height: "100%", background: COLORS.secondary, borderRadius: 4 },
  // === STEPS ===
  stepsList: { display: "flex", flexDirection: "column" },
  stepItem: { display: "flex", flexDirection: "row", gap: 12, padding: "8px 0" },
  stepLeft: { display: "flex", flexDirection: "column", alignItems: "center", width: 28 },
  stepIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  stepConnector: {
    width: 2,
    flex: 1,
    background: COLORS.outlineVariant,
    marginTop: 4,
    minHeight: 16,
  },
  stepContent: { flex: 1, paddingBottom: 8 },
  stepLabel: { ...typo("body", { fontSize: 14 }), color: COLORS.onSurface, fontWeight: 500 },
  stepStatus: { ...typo("caption"), marginTop: 2, fontWeight: 700 },
  // === ACTIONS ===
  actions: { display: "flex", flexDirection: "column", gap: 12 },
  interviewBtn: {
    background: COLORS.secondary,
    borderRadius: 14,
    height: 52,
    display: "flex",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    boxShadow: SHADOWS.large,
  },
  interviewBtnText: { ...typo("h4"), color: COLORS.textOnPrimary },
  supportBtn: {
    borderRadius: 14,
    height: 52,
    display: "flex",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    border: `1px solid ${COLORS.primary}`,
    background: "transparent",
  },
  supportBtnText: { ...typo("h4"), color: COLORS.primary },
  // === INFO NOTE ===
  infoNote: {
    display: "flex",
    flexDirection: "row",
    gap: 10,
    background: COLORS.primaryLight,
    borderRadius: 12,
    padding: 14,
    border: `1px solid ${COLORS.primarySoft}`,
  },
  infoNoteText: {
    flex: 1,
    ...typo("body", { fontSize: 13, lineHeight: "20px" }),
    color: COLORS.onSurface,
  },
};

const WorkerScreeningStatusScreen: React.FC = () => {
  const nav = useNav();
  const { user } = useAuth();

  // QA-FIX-UI 3.2: fade-in animation khi mount (opacity 0→1) — CSS transition
  const [faded, setFaded] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setFaded(true), 30);
    return () => clearTimeout(t);
  }, []);

  const [status, setStatus] = useState<ScreeningStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdminReview, setIsAdminReview] = useState(false);

  // Gọi API thật: getProfile() + getMyCredentials()
  useEffect(() => {
    const fetchData = async () => {
      try {
        // zalo client trả body trực tiếp (RN: profileRes.data / credRes.data)
        const [profile, credentials] = await Promise.all([
          getProfile(),
          getMyCredentials().catch(() => []),
        ]);
        const built = buildScreeningFromAPI(profile, (credentials as any) || []);
        setStatus(built);
        if (built.adminReview) {
          setIsAdminReview(true);
        }
      } catch (e: any) {
        console.warn("[WorkerScreeningStatus] API lỗi, dùng mock fallback:", e?.message || e);
        // Fallback: dùng mock data cũ dựa trên user.is_verified
        setStatus((user?.is_verified ? APPROVED_SCREENING_STATUS : MOCK_SCREENING_STATUS) as ScreeningStatus);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isLoading) {
    return (
      <div
        style={{
          ...S.container,
          justifyContent: "center",
          alignItems: "center",
          display: "flex",
        }}
      >
        <Spinner size={36} color={COLORS.primary} />
        <div style={{ ...typo("body"), color: COLORS.onSurfaceVariant, marginTop: 12 }}>
          Đang tải trạng thái thẩm định...
        </div>
      </div>
    );
  }

  if (!status) {
    return (
      <div
        style={{
          ...S.container,
          justifyContent: "center",
          alignItems: "center",
          display: "flex",
        }}
      >
        <div style={{ ...typo("body"), color: COLORS.onSurfaceVariant }}>Không thể tải trạng thái.</div>
        <Touchable onPress={nav.goBack} style={S.backBtn}>
          <div style={{ ...typo("h4"), color: COLORS.primary }}>Quay lại</div>
        </Touchable>
      </div>
    );
  }

  const completedCount = status.steps.filter((s) => s.status === "done").length;
  const totalCount = status.steps.length;
  const progressPercent = (completedCount / totalCount) * 100;
  const isRejected = status.stage === "Bị từ chối";

  return (
    <div
      style={{
        ...S.container,
        opacity: faded ? 1 : 0,
        transition: `opacity ${ANIM.timingNormal}ms`,
      }}
    >
      <StatusBarSpacer />

      {/* Top App Bar */}
      <div style={S.appBar}>
        <Touchable
          onPress={nav.goBack}
          style={S.appBarBtn}
          aria-role="button"
          aria-label="Quay lại"
        >
          <Icon name="arrow-back" size={22} color={COLORS.onSurface} />
        </Touchable>
        <div style={S.appBarTitle}>Trạng thái thẩm định</div>
        <div style={{ width: 44 }} />
      </div>

      <div style={S.scrollView}>
        <div style={S.scrollContent}>
          {/* Hero card — illustration + title + stage badge */}
          <div style={S.heroCard}>
            {/* Illustration circle */}
            <div
              style={{
                ...S.illustrationCircle,
                ...(isRejected ? S.illustrationCircleRejected : {}),
              }}
            >
              <Icon
                name={ic(isRejected ? "close-circle" : "hourglass")}
                size={64}
                color={isRejected ? COLORS.error : COLORS.primary}
              />
            </div>

            <div style={{ ...S.heroTitle, ...(isRejected ? { color: COLORS.error } : {}) }}>
              {isRejected
                ? "Hồ sơ bị từ chối"
                : status.stage === "Đã duyệt"
                ? "Hồ sơ đã được phê duyệt"
                : "Hồ sơ đang được thẩm định"}
            </div>
            <div style={S.heroSubtitle}>{status.description}</div>

            {/* Stage badge */}
            <div style={{ ...S.stageBadge, ...(isRejected ? S.stageBadgeRejected : {}) }}>
              <Icon
                name={ic(isRejected ? "alert-circle" : "hourglass")}
                size={16}
                color={isRejected ? COLORS.error : COLORS.primary}
              />
              <div style={{ ...S.stageBadgeText, ...(isRejected ? { color: COLORS.error } : {}) }}>
                GIAI ĐOẠN: {status.stage.toUpperCase()}
              </div>
            </div>
          </div>

          {/* Admin review banner — chỉ hiện khi bị từ chối */}
          {isAdminReview && (
            <div style={S.reviewBanner}>
              <Icon name="information-circle" size={18} color={COLORS.error} />
              <div style={S.reviewBannerText}>{status.description}</div>
            </div>
          )}

          {/* Estimated time card */}
          <div style={S.estimatedCard}>
            <div style={S.estimatedItem}>
              <Icon name="calendar-outline" size={18} color={COLORS.primary} />
              <div>
                <div style={S.estimatedLabel}>Ngày nộp hồ sơ</div>
                <div style={S.estimatedValue}>{status.submittedDate}</div>
              </div>
            </div>
            <div style={S.estimatedDivider} />
            <div style={S.estimatedItem}>
              <Icon name="time-outline" size={18} color={COLORS.primary} />
              <div>
                <div style={S.estimatedLabel}>Dự kiến có kết quả</div>
                <div style={S.estimatedValue}>{status.expectedDate}</div>
              </div>
            </div>
          </div>

          {/* Progress card */}
          <div style={S.progressCard}>
            <div style={S.progressHeader}>
              <div style={S.progressTitle}>Tiến độ hồ sơ</div>
              <div style={S.progressCount}>
                {completedCount}/{totalCount}
              </div>
            </div>

            {/* Progress bar */}
            <div style={S.progressBarBg}>
              <div style={{ ...S.progressBarFill, width: `${progressPercent}%` }} />
            </div>

            {/* Steps list */}
            <div style={S.stepsList}>
              {status.steps.map((step, idx) => {
                const st = STEP_STATUS_STYLE[step.status];
                return (
                  <div key={step.id} style={{ ...S.stepItem, opacity: st.opacity }}>
                    <div style={S.stepLeft}>
                      <div style={{ ...S.stepIconCircle, background: st.iconBg }}>
                        <Icon name={st.icon} size={14} color={st.iconColor} />
                      </div>
                      {idx < status.steps.length - 1 && <div style={S.stepConnector} />}
                    </div>
                    <div style={S.stepContent}>
                      <div style={S.stepLabel}>{step.label}</div>
                      <div style={{ ...S.stepStatus, color: st.labelColor }}>{st.label}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action buttons */}
          <div style={S.actions}>
            <Touchable
              style={S.interviewBtn}
              onPress={() => showComingSoon("Chi tiết phỏng vấn trực tuyến")}
              activeOpacity={0.85}
            >
              <Icon name={ic("videocam")} size={20} color="#fff" />
              <div style={S.interviewBtnText}>Xem chi tiết phỏng vấn</div>
            </Touchable>
            <Touchable
              style={S.supportBtn}
              onPress={() => {
                openSupportHotlineWeb().then((ok) => {
                  if (!ok) showAlert("EduCareLink", `Hotline hỗ trợ: ${SUPPORT_HOTLINE}`);
                });
              }}
              activeOpacity={0.7}
            >
              <Icon name={ic("headset")} size={20} color={COLORS.primary} />
              <div style={S.supportBtnText}>Liên hệ hỗ trợ</div>
            </Touchable>
          </div>

          {/* Info note */}
          <div style={S.infoNote}>
            <Icon name="information-circle" size={16} color={COLORS.primary} />
            <div style={S.infoNoteText}>
              Trong thời gian chờ, bạn có thể cập nhật thông tin hồ sơ nếu cần. Hệ thống sẽ thông báo
              ngay khi có kết quả thẩm định.
            </div>
          </div>

          <div style={{ height: 40 }} />
        </div>
      </div>
    </div>
  );
};

export default WorkerScreeningStatusScreen;
