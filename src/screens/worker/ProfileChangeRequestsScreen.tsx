/**
 * ProfileChangeRequestsScreen — port CHÍNH XÁC mobile/src/screens/Worker/ProfileChangeRequestsScreen.js (264 dòng).
 * Lịch sử yêu cầu đổi hồ sơ của Carepartner — getMyProfileChangeRequests()
 * (WIRING FIX 2026-08-21), status badge pending/approved/rejected + proposed_changes.
 *
 * Khác biệt platform (ghi mobile-parity-map.md):
 *  - StatusBar dark-content + paddingTop insets.top+32 → StatusBarSpacer + paddingTop 32.
 *  - Animated.timing fade (ANIM.timingNormal) → CSS transition opacity + setState.
 *  - RefreshControl (kéo làm mới) không có trên web — bỏ; fetch khi mount.
 *  - Icon: mọi glyph RN dùng đều có sẵn (time/checkmark-circle/close-circle/
 *    document-text-outline/information-circle/arrow-back).
 */
import React, { useState, useEffect } from "react";
import Icon from "@/components/Icon";
import { Spinner, StatusBarSpacer, Touchable } from "@/components/ui";
import { COLORS, SHADOWS, ANIM, typo } from "@/theme";
import { useNav } from "@/navigation/router";
import { getMyProfileChangeRequests } from "@/api/tasks";

const STATUS_MAP: Record<
  string,
  { label: string; color: string; bg: string; icon: string }
> = {
  pending: {
    label: "Đang chờ duyệt",
    color: COLORS.warning,
    bg: COLORS.warningBg,
    icon: "time",
  },
  approved: {
    label: "Đã duyệt",
    color: COLORS.success,
    bg: COLORS.successBg,
    icon: "checkmark-circle",
  },
  rejected: {
    label: "Bị từ chối",
    color: COLORS.error,
    bg: COLORS.errorBg,
    icon: "close-circle",
  },
};

const FIELD_LABELS: Record<string, string> = {
  first_name: "Họ",
  last_name: "Tên",
  phone_number: "Số điện thoại",
  email: "Email",
  address: "Địa chỉ",
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
  scrollView: { flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" },
  scrollContent: { display: "flex", flexDirection: "column", padding: "20px 20px 40px", gap: 14 },
  // === EMPTY STATE ===
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    paddingTop: 60,
    gap: 12,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    background: COLORS.primaryLight,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    boxShadow: SHADOWS.small,
  },
  emptyTitle: { ...typo("h4"), color: COLORS.onSurface },
  emptyText: {
    ...typo("bodySmall", { lineHeight: "20px" }),
    color: COLORS.onSurfaceVariant,
    textAlign: "center",
    padding: "0 20px",
  },
  // === CARD ===
  card: {
    background: COLORS.surface,
    borderRadius: 14,
    padding: 16,
    border: `1px solid ${COLORS.outlineVariant}`,
    boxShadow: SHADOWS.small,
    gap: 12,
    display: "flex",
    flexDirection: "column",
  },
  cardHeader: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statusBadge: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    padding: "4px 10px",
  },
  statusText: { ...typo("caption"), fontWeight: 700 },
  dateText: { ...typo("caption"), color: COLORS.onSurfaceVariant, fontWeight: 700, letterSpacing: 0.5 },
  // === CHANGES ===
  changeRow: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "6px 0",
    borderBottom: `1px solid ${COLORS.outlineVariant}`,
  },
  changeField: { ...typo("body"), color: COLORS.onSurfaceVariant, fontWeight: 500 },
  changeValue: { ...typo("body"), color: COLORS.onSurface, fontWeight: 700 },
  // === REVIEW BOX ===
  reviewBox: {
    display: "flex",
    flexDirection: "row",
    gap: 8,
    background: COLORS.errorContainer,
    borderRadius: 10,
    padding: 10,
    marginTop: 4,
  },
  reviewText: {
    flex: 1,
    ...typo("bodySmall", { lineHeight: "18px" }),
    color: COLORS.errorDeep,
  },
};

const ProfileChangeRequestsScreen: React.FC = () => {
  const nav = useNav();

  // QA-FIX-UI 3.2: fade-in animation khi mount (opacity 0→1) — CSS transition
  const [faded, setFaded] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setFaded(true), 30);
    return () => clearTimeout(t);
  }, []);

  const [requests, setRequests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    try {
      const res: any = await getMyProfileChangeRequests();
      setRequests(res || []);
    } catch (e: any) {
      console.error("[ProfileChangeRequests] Lỗi:", e?.message || e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const renderChanges = (changes: any) => {
    if (!changes || typeof changes !== "object") return null;
    return Object.entries(changes)
      .map(([key, value]) => {
        if (
          key === "admin_review" ||
          key === "id" ||
          key === "worker" ||
          key === "created_at" ||
          key === "updated_at" ||
          key === "status"
        )
          return null;
        const label = FIELD_LABELS[key] || key;
        return (
          <div key={key} style={S.changeRow}>
            <div style={S.changeField}>{label}</div>
            <div style={S.changeValue}>{String(value)}</div>
          </div>
        );
      })
      .filter(Boolean);
  };

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
          Đang tải...
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        ...S.container,
        opacity: faded ? 1 : 0,
        transition: `opacity ${ANIM.timingNormal}ms`,
      }}
    >
      <StatusBarSpacer />

      {/* App Bar */}
      <div style={S.appBar}>
        <Touchable
          onPress={nav.goBack}
          style={S.appBarBtn}
          aria-role="button"
          aria-label="Quay lại"
        >
          <Icon name="arrow-back" size={22} color={COLORS.onSurface} />
        </Touchable>
        <div style={S.appBarTitle}>Lịch sử yêu cầu đổi hồ sơ</div>
        <div style={{ width: 44 }} />
      </div>

      <div style={S.scrollView}>
        <div style={S.scrollContent}>
          {requests.length === 0 ? (
            <div style={S.emptyState}>
              <div style={S.emptyIconCircle}>
                <Icon name="document-text-outline" size={40} color={COLORS.primary} />
              </div>
              <div style={S.emptyTitle}>Chưa có yêu cầu nào</div>
              <div style={S.emptyText}>
                Bạn chưa gửi yêu cầu thay đổi hồ sơ nào. Vào "Hồ sơ" &gt; "Yêu cầu sửa hồ sơ" để
                bắt đầu.
              </div>
            </div>
          ) : (
            requests.map((req: any) => {
              const st = STATUS_MAP[req.status] || STATUS_MAP.pending;
              return (
                <div key={req.id} style={S.card}>
                  {/* Header row */}
                  <div style={S.cardHeader}>
                    <div style={{ ...S.statusBadge, background: st.bg }}>
                      <Icon name={st.icon} size={14} color={st.color} />
                      <div style={{ ...S.statusText, color: st.color }}>{st.label}</div>
                    </div>
                    <div style={S.dateText}>
                      {new Date(req.created_at).toLocaleString("vi-VN", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>

                  {/* Changes */}
                  {renderChanges(req.proposed_changes)}

                  {/* Admin review — chỉ hiện khi bị từ chối */}
                  {req.status === "rejected" && req.admin_review && (
                    <div style={S.reviewBox}>
                      <Icon name="information-circle" size={16} color={COLORS.error} />
                      <div style={S.reviewText}>Lý do: {req.admin_review}</div>
                    </div>
                  )}
                </div>
              );
            })
          )}

          <div style={{ height: 40 }} />
        </div>
      </div>
    </div>
  );
};

export default ProfileChangeRequestsScreen;
