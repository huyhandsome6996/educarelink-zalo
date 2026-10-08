/**
 * PaymentQRScreen — port CHÍNH XÁC mobile/src/screens/Payment/PaymentQRScreen.js (436 dòng).
 * VIETQR GATE: màn chờ phụ huynh quét QR VietQR (PayOS) sau khi chọn CarePartner.
 *   - QR (base64 data URI / URL) hoặc fallback icon khi QR hiển thị trên trang PayOS
 *   - Đồng hồ đếm ngược tới qr_expires_at (1s)
 *   - Polling getPaymentStatus(paymentId) mỗi 4s (POLL_INTERVAL_MS = 4000 như RN) →
 *     status 'held' → THÀNH CÔNG; task_status 'open' / status 'cancelled' → hết hạn
 *   - Nút "Huỷ lựa chọn" → cancelSelection → rollback (task về 'open')
 *   - QR hết hạn → "Tạo lại mã QR" (setupPayOS(taskId))
 * Điểm vào: CandidatesScreen approve → create_payos_payment; ParentHome resume
 * task 'pending_payment'. Params: paymentId, taskId, taskTitle, taskPrice,
 * workerName, checkoutUrl, qrCode, qrExpiresAt (giống route.params RN).
 *
 * Khác biệt platform (ghi mobile-parity-map.md):
 * - Linking.openURL(checkoutUrl) → window.open(checkoutUrl, '_blank'). Trên Zalo
 *   production cần mở qua zmp-sdk openWebview (miniprogram không cho popup) —
 *   chừa sẵn comment tại openCheckout() để swap khi build Zalo app.
 * - Platform.OS==='web' ? alert(msg) : Alert.alert → giữ alert(msg) như RN-web;
 *   Alert 2 nút (Tiếp tục thanh toán / Huỷ lựa chọn) → window.confirm.
 * - navigation.popToTop() → nav.reset({ name: nav.state.tab }) (về root tab).
 * - navigate({name:'Candidates',merge}) + goBack (RN) → nav.navigate('Candidates',
 *   { refreshTs }) — router truncate về Candidates có sẵn với params mới.
 * - Image source={{uri}} → nếu qrCode là data URI/URL → <img src>; chuỗi thường
 *   (RN Image cũng không render được) → fallback icon như nhánh !qrCode của RN.
 * - Header RN paddingTop 48 (nút close + title) / 12 (màn chờ) → StatusBarSpacer
 *   + paddingTop 12 tương đương trên web.
 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import Icon from "@/components/Icon";
import { Touchable, Spinner, StatusBarSpacer, Screen } from "@/components/ui";
import { COLORS, TYPO, SIZES, SHADOWS } from "@/theme";
import { useNav } from "@/navigation/router";
import { setupPayOS, getPaymentStatus, cancelSelection } from "@/api/misc";

// Icon thiếu glyph trong ionicons.ts (159 glyph) → glyph gần nhất cùng nghĩa
const ic = (name: string) =>
  (
    {
      "close-circle-outline": "close-circle",
    } as Record<string, string>
  )[name] ?? name;

const POLL_INTERVAL_MS = 4000; // polling 4s (spec: 3-5s) — đúng RN
const FALLBACK_SECONDS = 15 * 60; // backend không trả hạn → mặc định 15 phút

function parseExpiry(iso?: string | null): number | null {
  if (!iso) return null;
  const t = Date.parse(iso.endsWith("Z") || iso.includes("+") ? iso : iso + "Z");
  return Number.isNaN(t) ? null : t;
}

/** QR chỉ render được khi là data URI hoặc URL ảnh (PayOS trả base64/data URI) */
const isRenderableQr = (qr?: string | null) =>
  !!qr && (qr.startsWith("data:") || qr.startsWith("http://") || qr.startsWith("https://"));

type Phase = "waiting" | "success" | "expired";

interface PaymentQRScreenProps {
  paymentId?: string | number;
  taskId?: string | number;
  taskTitle?: string;
  taskPrice?: string | number;
  workerName?: string;
  checkoutUrl?: string | null;
  qrCode?: string | null;
  qrExpiresAt?: string | null;
}

const PaymentQRScreen: React.FC<PaymentQRScreenProps> = ({
  paymentId,
  taskId,
  taskTitle,
  taskPrice,
  workerName,
  checkoutUrl: initialCheckoutUrl,
  qrCode: initialQrCode,
  qrExpiresAt: initialExpiresAt,
}) => {
  const nav = useNav();

  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(initialCheckoutUrl || null);
  const [qrCode, setQrCode] = useState<string | null>(initialQrCode || null);
  const [expiresAt, setExpiresAt] = useState<number>(
    parseExpiry(initialExpiresAt) || Date.now() + FALLBACK_SECONDS * 1000
  );
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>("waiting"); // waiting | success | expired
  const [busy, setBusy] = useState(false);
  const [pollCount, setPollCount] = useState(0);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const settledRef = useRef(false); // chặn poll/timer sau khi đạt kết quả

  // ── Countdown ─────────────────────────────────────────────────
  const isWaiting = phase === "waiting";
  useEffect(() => {
    if (settledRef.current) return undefined;
    const tick = () => {
      const left = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left <= 0) setPhase((p) => (p === "waiting" ? "expired" : p));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt, isWaiting]);

  const mm = secondsLeft != null ? String(Math.floor(secondsLeft / 60)).padStart(2, "0") : "--";
  const ss = secondsLeft != null ? String(secondsLeft % 60).padStart(2, "0") : "--";

  // ── Polling trạng thái (held → success) ───────────────────────
  const pollOnce = useCallback(async () => {
    if (settledRef.current || !paymentId) return;
    try {
      const data = (await getPaymentStatus(paymentId)) as any;
      setPollCount((c) => c + 1);
      if (data?.status === "held") {
        settledRef.current = true;
        if (pollRef.current) clearInterval(pollRef.current);
        setPhase("success");
      } else if (data?.task_status === "open" || data?.status === "cancelled") {
        // Backend đã rollback (cron expiry / huỷ nơi khác)
        settledRef.current = true;
        if (pollRef.current) clearInterval(pollRef.current);
        setPhase("expired");
      }
    } catch (e) {
      // Mất mạng 1-2 nhịp polling — bỏ qua, nhịp sau thử lại
    }
  }, [paymentId]);

  useEffect(() => {
    if (!paymentId) return undefined;
    pollRef.current = setInterval(pollOnce, POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [paymentId, pollOnce]);

  // RN popToTop — về màn đầu tiên của stack (root tab)
  const popToTop = () => nav.reset({ name: nav.state.tab });

  // Về màn danh sách ứng viên kèm refresh (chọn người khác) — net effect của
  // navigate({name:'Candidates',merge}) + goBack trong RN
  const gotoCandidates = () => {
    const stack = nav.state.stacks[nav.state.tab] || [];
    if (stack.some((e) => e.name === "Candidates")) nav.navigate("Candidates", { refreshTs: Date.now() });
    else if (stack.length > 1) nav.replace("Candidates", { refreshTs: Date.now() });
    else popToTop();
  };

  // ── Huỷ lựa chọn ──────────────────────────────────────────────
  const handleCancel = () => {
    const doCancel = async () => {
      setBusy(true);
      try {
        await cancelSelection(paymentId as string | number);
        settledRef.current = true;
        if (pollRef.current) clearInterval(pollRef.current);
        // Về màn danh sách ứng viên (kèm refresh) — chọn người khác
        gotoCandidates();
      } catch (e: any) {
        const msg = e?.response?.data?.error || "Không huỷ được lựa chọn. Vui lòng thử lại.";
        // RN web: alert(msg)
        window.alert(msg);
      } finally {
        setBusy(false);
      }
    };
    const msg = "Huỷ lựa chọn này? CarePartner sẽ KHÔNG còn được đặt, bạn có thể chọn người khác.";
    // RN: Platform web → window.confirm (2 nút: Tiếp tục thanh toán / Huỷ lựa chọn)
    if (window.confirm(msg)) doCancel();
  };

  // ── Tạo lại QR khi hết hạn ────────────────────────────────────
  const handleRecreate = async () => {
    setBusy(true);
    try {
      const d = (await setupPayOS(taskId as string | number)) as any;
      setCheckoutUrl(d?.checkout_url ?? null);
      setQrCode(d?.qr_code || null);
      setExpiresAt(parseExpiry(d?.qr_expires_at) || Date.now() + FALLBACK_SECONDS * 1000);
      settledRef.current = false;
      setPhase("waiting");
    } catch (e: any) {
      // Có thể backend cron đã rollback (task về 'open') → lỗi "chưa ở trạng
      // thái chờ thanh toán" → quay lại danh sách ứng viên để chọn lại.
      const msg = e?.response?.data?.error || "Không tạo lại được QR.";
      // RN: Alert.alert('Lỗi', msg, [{text:'OK', onPress: gotoCandidates}]) → confirm 2 nút
      if (window.confirm(msg)) gotoCandidates();
    } finally {
      setBusy(false);
    }
  };

  const openCheckout = () => {
    if (!checkoutUrl) return;
    // RN web: window.open(checkoutUrl, '_blank').
    // Zalo production: thay bằng zmp-sdk openWebview (webview modal của Mini App)
    // — giữ điểm đổi duy nhất tại đây.
    window.open(checkoutUrl, "_blank");
  };

  const price = taskPrice != null ? parseInt(String(taskPrice), 10) : null;
  const priceText = price != null && !Number.isNaN(price) ? price.toLocaleString("vi-VN") : null;

  // ══════════════ TRẠNG THÁI THÀNH CÔNG ══════════════
  if (phase === "success") {
    return (
      <Screen bg={COLORS.background} scroll={false}>
        <div style={{ ...S.centerContent }}>
          <div style={{ ...S.successCircle, background: COLORS.success }}>
            <Icon name="checkmark" size={56} color="#fff" />
          </div>
          <span style={{ ...S.successTitle, color: COLORS.textPrimary }}>Đặt lịch thành công!</span>
          <span style={{ ...S.successBody, color: COLORS.textSecondary, textAlign: "center" }}>
            {workerName ? `Đã xác nhận ${workerName} nhận ` : "Đã xác nhận "}
            {'"' + (taskTitle || "") + '"'} sau khi thanh toán thành công.
          </span>
          <span style={{ ...S.successNote, color: COLORS.textSecondary, textAlign: "center" }}>
            Tiền đang được GIỮ an toàn — chỉ chuyển cho CarePartner khi công việc hoàn thành.
          </span>
          <Touchable style={{ ...S.primaryBtn, background: COLORS.primary }} onPress={popToTop} activeOpacity={0.85}>
            <Icon name="home" size={18} color="#fff" />
            <span style={{ ...S.primaryBtnText, color: "#fff", fontSize: 15 }}>Về trang chính</span>
          </Touchable>
        </div>
      </Screen>
    );
  }

  // ══════════════ HẾT HẠN ══════════════
  if (phase === "expired") {
    return (
      <Screen bg={COLORS.background} scroll={false}>
        <StatusBarSpacer />
        <div style={S.header}>
          <Touchable onPress={nav.goBack} style={{ ...S.backBtn, background: COLORS.background }}>
            <Icon name="close" size={22} color={COLORS.textSecondary} />
          </Touchable>
          <span style={{ ...S.headerTitle, color: COLORS.textPrimary }}>QR đã hết hạn</span>
          <div style={{ width: 40 }} />
        </div>
        <div style={S.centerContent}>
          <div style={{ ...S.qrBox, justifyContent: "center", alignItems: "center", background: "#fff" }}>
            <Icon name="time-outline" size={56} color={COLORS.warning} />
          </div>
          <span style={{ ...S.expiredTitle, color: COLORS.textPrimary }}>Mã QR đã hết hiệu lực</span>
          <span style={{ ...S.expiredBody, color: COLORS.textSecondary, textAlign: "center" }}>
            Lựa chọn chưa được thanh toán. Bạn có thể tạo lại mã QR để giữ chỗ
            {workerName ? ` ${workerName}` : ""}, hoặc huỷ để chọn CarePartner khác.
          </span>
          <Touchable
            style={{ ...S.primaryBtn, background: COLORS.primary }}
            onPress={handleRecreate}
            disabled={busy}
            activeOpacity={0.85}
          >
            {busy ? (
              <Spinner size={20} color="#fff" />
            ) : (
              <>
                <Icon name="refresh" size={18} color="#fff" />
                <span style={{ ...S.primaryBtnText, color: "#fff", fontSize: 15 }}>Tạo lại mã QR</span>
              </>
            )}
          </Touchable>
          <Touchable
            style={{ ...S.secondaryBtn, background: COLORS.surface, borderColor: COLORS.border }}
            onPress={handleCancel}
            disabled={busy}
            activeOpacity={0.85}
          >
            <Icon name={ic("close-circle-outline")} size={18} color={COLORS.textSecondary} />
            <span style={{ ...S.secondaryBtnText, color: COLORS.textSecondary, fontSize: 14 }}>Huỷ lựa chọn</span>
          </Touchable>
        </div>
      </Screen>
    );
  }

  // ══════════════ ĐANG CHỜ QUÉT ══════════════
  return (
    <Screen bg={COLORS.background} scroll={false}>
      <StatusBarSpacer />
      {/* Header */}
      <div style={S.header}>
        <Touchable onPress={handleCancel} disabled={busy} style={{ ...S.backBtn, background: COLORS.background }}>
          <Icon name="close" size={22} color={COLORS.textSecondary} />
        </Touchable>
        <span style={{ ...S.headerTitle, color: COLORS.textPrimary }}>Quét mã để xác nhận</span>
        <div style={{ width: 40 }} />
      </div>

      {/* Body scroll */}
      <div className="edc-scroll" style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: 16, boxSizing: "border-box" }}>
        <div style={{ paddingBottom: 40 }}>
          {/* Task summary */}
          <div style={{ ...S.taskCard, background: COLORS.surface, borderLeft: `4px solid ${COLORS.primary}` }}>
            <Icon name="briefcase-outline" size={20} color={COLORS.primary} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ ...S.taskTitle, color: COLORS.textPrimary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "block" }}>
                {taskTitle || `Công việc #${taskId}`}
              </span>
              {workerName ? <span style={{ ...S.taskWorker, color: COLORS.textSecondary }}>CarePartner: {workerName}</span> : null}
            </div>
            {priceText ? <span style={{ ...S.taskPrice, color: COLORS.primary }}>{priceText}đ</span> : null}
          </div>

          {/* QR box + countdown */}
          <div style={{ ...S.qrCard, background: COLORS.surface }}>
            <div style={{ ...S.qrBox, background: "#fff", borderColor: COLORS.border }}>
              {isRenderableQr(qrCode) ? (
                // eslint-disable-next-line jsx-a11y/alt-text
                <img src={qrCode as string} alt="Mã QR VietQR" style={S.qrImg} />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: 12 }}>
                  <Icon name="qr-code-outline" size={72} color={COLORS.primary} />
                  <span style={{ ...S.qrFallbackText, color: COLORS.textSecondary, textAlign: "center", marginTop: 8 }}>
                    QR hiển thị trên trang thanh toán PayOS
                  </span>
                </div>
              )}
            </div>

            {/* Đồng hồ đếm ngược */}
            <div style={S.countdownRow}>
              <Icon name="timer-outline" size={18} color={COLORS.error} />
              <span style={{ ...S.countdownText, color: COLORS.error }}>{mm}:{ss}</span>
              <span style={{ ...S.countdownLabel, color: COLORS.textSecondary }}>còn lại để giữ chỗ</span>
            </div>

            <span style={{ ...S.hintText, color: COLORS.textSecondary, textAlign: "center" }}>
              Mở app ngân hàng → quét QR VietQR → chuyển khoản
              {priceText ? ` ${priceText}đ` : ""}. Đặt lịch chỉ được XÁC NHẬN sau khi thanh toán thành công.
            </span>

            {checkoutUrl ? (
              <Touchable style={S.linkBtn} onPress={openCheckout} activeOpacity={0.85}>
                <Icon name="open-outline" size={16} color={COLORS.info} />
                <span style={{ ...S.linkBtnText, color: COLORS.info }}>Mở trang thanh toán PayOS</span>
              </Touchable>
            ) : null}

            {/* Polling indicator */}
            <div style={S.pollRow}>
              <Spinner size={16} color={COLORS.primary} />
              <span style={{ ...S.pollText, color: COLORS.textSecondary, flex: 1 }}>
                Đang chờ thanh toán… (kiểm tra tự động mỗi 4s · {pollCount} lần)
              </span>
            </div>
          </div>

          {/* Info box */}
          <div style={{ ...S.infoBox, background: COLORS.primaryLight, borderColor: COLORS.primarySoft }}>
            <Icon name="shield-checkmark" size={18} color={COLORS.primary} />
            <span style={{ ...S.infoText, color: COLORS.primaryDark }}>
              Tiền được GIỮ qua PayOS. Không thanh toán → CarePartner KHÔNG được đặt, bạn có thể bấm "Huỷ" để
              chọn người khác hoặc để mã QR hết hạn.
            </span>
          </div>
        </div>
      </div>

      {/* Footer — Huỷ */}
      <div style={{ ...S.footer, background: COLORS.surface, borderTop: `1px solid ${COLORS.border}` }}>
        <Touchable
          style={{ ...S.cancelBtn, background: COLORS.surface, borderColor: COLORS.error }}
          onPress={handleCancel}
          disabled={busy}
          activeOpacity={0.85}
        >
          {busy ? (
            <Spinner size={18} color={COLORS.textSecondary} />
          ) : (
            <>
              <Icon name={ic("close-circle-outline")} size={18} color={COLORS.error} />
              <span style={{ ...S.cancelBtnText, color: COLORS.error, fontSize: 14 }}>Huỷ lựa chọn — chọn người khác</span>
            </>
          )}
        </Touchable>
      </div>
    </Screen>
  );
};

const S: Record<string, React.CSSProperties> = {
  centerContent: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  // === HEADER ===
  header: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 16px 14px",
    background: COLORS.surface,
    borderBottom: `1px solid ${COLORS.border}`,
    boxShadow: SHADOWS.small,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: SIZES.radiusSm,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  headerTitle: { ...TYPO.h4, fontWeight: 800 },
  // === TASK CARD ===
  taskCard: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: SIZES.radiusMd,
    padding: 16,
    marginBottom: 14,
    boxShadow: SHADOWS.cardHover,
  },
  taskTitle: { ...TYPO.h5, fontWeight: 700, flex: 1 },
  taskWorker: { ...TYPO.caption, marginTop: 2, display: "block" },
  taskPrice: { ...TYPO.h4, fontWeight: 900, flexShrink: 0 },
  // === QR CARD ===
  qrCard: {
    borderRadius: SIZES.radiusMd,
    padding: 16,
    marginBottom: 14,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 12,
    boxShadow: SHADOWS.cardHover,
  },
  qrBox: {
    width: 220,
    height: 220,
    borderRadius: SIZES.radiusMd,
    border: "2px solid",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: 10,
    boxSizing: "border-box",
    overflow: "hidden",
  },
  qrImg: { width: "100%", height: "100%", objectFit: "contain" },
  qrFallbackText: { ...TYPO.caption },
  countdownRow: { display: "flex", flexDirection: "row", alignItems: "center", gap: 6 },
  countdownText: { fontSize: 26, fontWeight: 900, fontVariantNumeric: "tabular-nums", lineHeight: "30px" },
  countdownLabel: { ...TYPO.bodySmall },
  hintText: { ...TYPO.bodySmall, lineHeight: "19px" },
  linkBtn: { display: "flex", flexDirection: "row", alignItems: "center", gap: 6, padding: "8px 14px" },
  linkBtnText: { ...TYPO.bodySmall, fontWeight: 700 },
  pollRow: { display: "flex", flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2, width: "100%" },
  pollText: { ...TYPO.caption },
  infoBox: {
    display: "flex",
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    borderRadius: SIZES.radiusMd,
    padding: 14,
    marginBottom: 16,
    border: "1px solid",
  },
  infoText: { flex: 1, ...TYPO.bodySmall, lineHeight: "20px" },
  // === BUTTONS ===
  primaryBtn: {
    borderRadius: SIZES.radiusMd,
    height: 52,
    display: "flex",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    padding: "0 24px",
    marginTop: 18,
    boxShadow: SHADOWS.large,
  },
  primaryBtnText: { ...TYPO.button },
  secondaryBtn: {
    borderRadius: SIZES.radiusMd,
    height: 48,
    display: "flex",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    padding: "0 24px",
    marginTop: 10,
    border: "1px solid",
  },
  secondaryBtnText: { ...TYPO.button },
  cancelBtn: {
    borderRadius: SIZES.radiusMd,
    height: 52,
    border: "1.5px solid",
    display: "flex",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  cancelBtnText: { ...TYPO.button },
  footer: {
    padding: "20px 20px calc(20px + env(safe-area-inset-bottom))",
  },
  // === SUCCESS / EXPIRED ===
  successCircle: {
    width: 104,
    height: 104,
    borderRadius: 52,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    boxShadow: SHADOWS.large,
  },
  successTitle: { ...TYPO.h3, fontWeight: 900, marginBottom: 10, textAlign: "center" },
  successBody: { ...TYPO.body, lineHeight: "22px" },
  successNote: { ...TYPO.caption, fontWeight: 400, marginTop: 10, lineHeight: "17px" },
  expiredTitle: { ...TYPO.h4, fontWeight: 800, marginTop: 16 },
  expiredBody: { ...TYPO.bodySmall, marginTop: 8, lineHeight: "19px" },
};

export default PaymentQRScreen;
