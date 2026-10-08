/**
 * AdminSendNotificationScreen — port CHÍNH XÁC mobile/src/screens/Admin/AdminSendNotificationScreen.js (331 dòng).
 * Modal presentation: 2 mode "Gửi cho tất cả Carepartner" (send_to_all: true) hoặc
 * "Gửi cho 1 Carepartner" (recipient_id) — chọn qua fullscreen picker (getAllWorkers,
 * filter is_approved); title + message + preview card + nút Gửi.
 *
 * Khác biệt platform (ghi mobile-parity-map.md):
 * - Modal slide fullscreen của RN → overlay fixed phủ màn (không animation).
 * - Alert.alert('✅ Thành công', ..., [OK → goBack]) → showAlert rồi nav.goBack() ngay
 *   (window.alert không có callback nút OK).
 * - Alert.alert 1 nút (lỗi validate) → showAlert.
 * - Icon thiếu glyph: person-add→person-add-outline (bộ 159 glyph).
 */
import React, { useState, useEffect } from "react";
import Icon from "@/components/Icon";
import { Touchable, Spinner, showAlert, StatusBarSpacer, useStatusBarHeight } from "@/components/ui";
import { COLORS, TYPO, SIZES, SHADOWS, typo } from "@/theme";
import { useNav } from "@/navigation/router";
import { sendNotification, getAllWorkers } from "@/api/misc";

// ====================================================================
// Admin Send Notification — đồng bộ với web (admin_dashboard.html phần notify)
// 2 mode: gửi broadcast cho tất cả carepartner HOẶC gửi cho 1 worker cụ thể
// ====================================================================

interface WorkerRow {
  id: number | string;
  username?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  is_approved?: boolean;
}

const AdminSendNotificationScreen: React.FC = () => {
  const nav = useNav();
  const sbH = useStatusBarHeight();
  const [mode, setMode] = useState("broadcast"); // broadcast | individual
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [selectedWorker, setSelectedWorker] = useState<WorkerRow | null>(null);
  const [workers, setWorkers] = useState<WorkerRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showWorkerPicker, setShowWorkerPicker] = useState(false);

  useEffect(() => {
    getAllWorkers()
      .then((res: any) => setWorkers(res.data || []))
      .catch(() => {});
  }, []);

  const displayName = (w: WorkerRow) =>
    w.first_name || w.last_name ? `${w.first_name} ${w.last_name || ""}`.trim() : (w.username ?? "");

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) {
      showAlert("Lỗi", "Vui lòng nhập tiêu đề và nội dung.");
      return;
    }
    if (mode === "individual" && !selectedWorker) {
      showAlert("Lỗi", "Vui lòng chọn carepartner nhận thông báo.");
      return;
    }

    setIsLoading(true);
    try {
      const payload: Record<string, any> = {
        title: title.trim(),
        message: message.trim(),
      };
      if (mode === "broadcast") {
        payload.send_to_all = true;
      } else {
        payload.recipient_id = selectedWorker!.id;
      }
      await sendNotification(payload);
      // RN: Alert OK → navigation.goBack(); web alert không có callback → alert rồi back ngay
      showAlert("✅ Thành công", "Đã gửi thông báo.");
      nav.goBack();
    } catch (e: any) {
      showAlert("Lỗi", e?.response?.data?.error || "Gửi thất bại.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: COLORS.background, overflow: "hidden", position: "relative" }}>
      <StatusBarSpacer />

      <div style={{ ...S.header, paddingTop: Math.max(6, 56 - sbH) }}>
        <Touchable onPress={nav.goBack} style={S.backBtn}>
          <Icon name="arrow-back" size={22} color="#fff" />
        </Touchable>
        <div style={S.headerTitle}>Gửi thông báo</div>
        <div style={{ marginRight: 8 }}>
          <Icon name="notifications" size={22} color="#fff" />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16, paddingBottom: 40 }}>
          {/* Mode switch */}
          <div>
            <div style={S.sectionLabel}>Loại thông báo</div>
            <div style={S.modeRow}>
              <Touchable
                style={{ ...S.modeCard, ...(mode === "broadcast" ? S.modeCardActive : {}) }}
                onPress={() => setMode("broadcast")}
                activeOpacity={0.85}
              >
                <Icon name="megaphone" size={22} color={mode === "broadcast" ? "#fff" : COLORS.primary} />
                <div style={{ ...S.modeLabel, ...(mode === "broadcast" ? S.modeLabelActive : {}) }}>Gửi cho tất cả Carepartner</div>
                <div style={{ ...S.modeDesc, ...(mode === "broadcast" ? S.modeDescActive : {}) }}>
                  Thông báo chung, mọi carepartner đều nhận được
                </div>
              </Touchable>

              <Touchable
                style={{ ...S.modeCard, ...(mode === "individual" ? S.modeCardActive : {}) }}
                onPress={() => setMode("individual")}
                activeOpacity={0.85}
              >
                <Icon name="person" size={22} color={mode === "individual" ? "#fff" : COLORS.primary} />
                <div style={{ ...S.modeLabel, ...(mode === "individual" ? S.modeLabelActive : {}) }}>Gửi cho 1 Carepartner</div>
                <div style={{ ...S.modeDesc, ...(mode === "individual" ? S.modeDescActive : {}) }}>
                  Chọn carepartner cụ thể từ danh sách
                </div>
              </Touchable>
            </div>
          </div>

          {/* Recipient picker (individual mode) */}
          {mode === "individual" && (
            <div>
              <div style={S.sectionLabel}>Người nhận</div>
              <Touchable style={S.recipientPicker} onPress={() => setShowWorkerPicker(true)} activeOpacity={0.85}>
                {selectedWorker ? (
                  <div style={S.recipientInfo}>
                    <div style={S.recipientAvatar}>
                      <span style={S.recipientAvatarText}>{selectedWorker.username?.[0]?.toUpperCase()}</span>
                    </div>
                    <div>
                      <div style={S.recipientName}>{displayName(selectedWorker)}</div>
                      <div style={S.recipientUsername}>@{selectedWorker.username}</div>
                    </div>
                  </div>
                ) : (
                  <div style={S.recipientPlaceholder}>
                    <Icon name="person-add-outline" size={20} color={COLORS.textMuted} />
                    <div style={S.recipientPlaceholderText}>Chọn carepartner...</div>
                  </div>
                )}
                <Icon name="chevron-forward" size={18} color={COLORS.textMuted} />
              </Touchable>
            </div>
          )}

          {/* Title */}
          <div>
            <div style={S.sectionLabel}>
              Tiêu đề <span style={{ color: COLORS.error }}>*</span>
            </div>
            <input
              style={S.textInput}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="VD: Bảo trì hệ thống, Thông báo mới, ..."
              maxLength={255}
            />
          </div>

          {/* Message */}
          <div>
            <div style={S.sectionLabel}>
              Nội dung <span style={{ color: COLORS.error }}>*</span>
            </div>
            <textarea
              style={{ ...S.textInput, ...S.messageInput }}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Nhập nội dung thông báo..."
              maxLength={2000}
              rows={4}
            />
            <div style={S.charCount}>{message.length}/2000</div>
          </div>

          {/* Preview */}
          {(title || message) && (
            <div style={S.previewCard}>
              <div style={S.previewLabel}>👁️ Preview</div>
              <div style={S.previewTitle}>{title || "(Tiêu đề)"}</div>
              <div style={S.previewMessage}>{message || "(Nội dung)"}</div>
              <div style={S.previewRecipient}>
                {mode === "broadcast" ? "📢 Tất cả carepartner" : `👤 ${selectedWorker?.username || "(chưa chọn)"}`}
              </div>
            </div>
          )}

          {/* Send button */}
          <Touchable style={{ ...S.sendBtn, ...(isLoading ? { opacity: 0.6 } : {}) }} onPress={handleSend} disabled={isLoading} activeOpacity={0.85}>
            {isLoading ? (
              <Spinner size={20} color="#fff" />
            ) : (
              <>
                <Icon name="send" size={18} color="#fff" />
                <div style={S.sendBtnText}>Gửi thông báo</div>
              </>
            )}
          </Touchable>
        </div>
      </div>

      {/* Worker picker modal — RN Modal animationType slide transparent={false} */}
      {showWorkerPicker && (
        <div style={S.pickerContainer}>
          <StatusBarSpacer />
          <div style={S.pickerHeader}>
            <div style={S.pickerTitle}>Chọn carepartner</div>
            <Touchable onPress={() => setShowWorkerPicker(false)} style={S.pickerCloseBtn}>
              <Icon name="close" size={22} color={COLORS.textPrimary} />
            </Touchable>
          </div>
          <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
            {workers.filter((w) => w.is_approved).length === 0 ? (
              <div style={S.emptyState}>
                <Icon name="people-outline" size={40} color={COLORS.textMuted} />
                <div style={S.emptyText}>Không có carepartner nào</div>
              </div>
            ) : (
              workers
                .filter((w) => w.is_approved)
                .map((item) => {
                  const isSelected = selectedWorker?.id === item.id;
                  return (
                    <Touchable
                      key={String(item.id)}
                      style={{ ...S.workerItem, ...(isSelected ? S.workerItemSelected : {}) }}
                      onPress={() => {
                        setSelectedWorker(item);
                        setShowWorkerPicker(false);
                      }}
                      activeOpacity={0.85}
                    >
                      <div style={S.workerAvatar}>
                        <span style={S.workerAvatarText}>{item.username?.[0]?.toUpperCase()}</span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={S.workerName}>{displayName(item)}</div>
                        <div style={S.workerUsername}>
                          @{item.username} • {item.email || "—"}
                        </div>
                      </div>
                      {isSelected && <Icon name="checkmark-circle" size={22} color={COLORS.primary} />}
                    </Touchable>
                  );
                })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const S: Record<string, React.CSSProperties> = {
  header: {
    display: "flex",
    alignItems: "center",
    padding: "0 16px 16px",
    background: COLORS.primary,
    gap: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: SIZES.radiusSm,
    background: "rgba(255,255,255,0.15)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  headerTitle: { ...typo("h4"), color: "#fff", fontWeight: 800, flex: 1 },
  sectionLabel: { ...typo("buttonSmall"), color: COLORS.textSecondary, marginBottom: 8, fontWeight: 700 },
  modeRow: { display: "flex", flexDirection: "column", gap: 10 },
  modeCard: {
    background: COLORS.surface,
    borderRadius: SIZES.radiusMd,
    padding: 16,
    border: `2px solid ${COLORS.border}`,
    display: "flex",
    flexDirection: "column",
    gap: 6,
    boxShadow: SHADOWS.small,
  },
  modeCardActive: {
    borderColor: COLORS.primary,
    background: COLORS.primary,
    boxShadow: SHADOWS.large,
  },
  modeLabel: { ...typo("h5"), color: COLORS.textPrimary, fontWeight: 700 },
  modeLabelActive: { color: "#fff" },
  modeDesc: { ...typo("caption"), color: COLORS.textSecondary },
  modeDescActive: { color: "rgba(255,255,255,0.9)" },
  recipientPicker: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    background: COLORS.surface,
    borderRadius: SIZES.radiusMd,
    padding: 14,
    border: `1.5px solid ${COLORS.border}`,
    boxShadow: SHADOWS.small,
  },
  recipientInfo: { display: "flex", flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  recipientAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    background: COLORS.primary,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  recipientAvatarText: { color: "#fff", ...typo("h5"), fontWeight: 800 },
  recipientName: { ...typo("body"), color: COLORS.textPrimary, fontWeight: 700 },
  recipientUsername: { ...typo("caption"), color: COLORS.textMuted },
  recipientPlaceholder: { display: "flex", flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  recipientPlaceholderText: { ...typo("body"), color: COLORS.textMuted },
  textInput: {
    width: "100%",
    background: COLORS.surface,
    borderRadius: SIZES.radiusMd,
    padding: 14,
    border: `1.5px solid ${COLORS.border}`,
    ...TYPO.body,
    lineHeight: "22px",
    color: COLORS.textPrimary,
    boxShadow: SHADOWS.small,
    outline: "none",
    fontFamily: TYPO.body.fontFamily,
  },
  messageInput: { minHeight: 120, resize: "vertical" },
  charCount: { ...typo("caption"), color: COLORS.textMuted, textAlign: "right", marginTop: 4 },
  previewCard: {
    background: COLORS.primaryLight,
    borderRadius: SIZES.radiusMd,
    padding: 14,
    display: "flex",
    flexDirection: "column",
    gap: 6,
    borderLeft: `4px solid ${COLORS.primary}`,
    boxShadow: SHADOWS.small,
  },
  previewLabel: { ...typo("overline"), color: COLORS.primary, fontWeight: 700 },
  previewTitle: { ...typo("h5"), color: COLORS.textPrimary, fontWeight: 700, whiteSpace: "pre-wrap" },
  previewMessage: { ...typo("body"), color: COLORS.textPrimary, whiteSpace: "pre-wrap" },
  previewRecipient: { ...typo("caption"), color: COLORS.textSecondary, fontStyle: "italic", marginTop: 4 },
  sendBtn: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    background: COLORS.primary,
    borderRadius: SIZES.radiusMd,
    paddingTop: 16,
    paddingBottom: 16,
    boxShadow: SHADOWS.large,
    marginTop: 8,
  },
  sendBtnText: { color: "#fff", ...typo("button"), fontSize: 16 },
  // Picker modal
  pickerContainer: {
    position: "fixed",
    inset: 0,
    zIndex: 300,
    display: "flex",
    flexDirection: "column",
    background: COLORS.background,
  },
  pickerHeader: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 16px 12px",
    background: COLORS.surface,
    borderBottom: `1px solid ${COLORS.border}`,
  },
  pickerTitle: { ...typo("h4"), color: COLORS.textPrimary, fontWeight: 800 },
  pickerCloseBtn: { padding: 4 },
  workerItem: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    background: COLORS.surface,
    borderBottom: `1px solid ${COLORS.border}`,
  },
  workerItemSelected: { background: COLORS.primaryLight },
  workerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    background: COLORS.primary,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  workerAvatarText: { color: "#fff", ...typo("h5"), fontWeight: 800 },
  workerName: { ...typo("body"), color: COLORS.textPrimary, fontWeight: 700 },
  workerUsername: { ...typo("caption"), color: COLORS.textMuted },
  emptyState: { display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 60, gap: 12 },
  emptyText: { ...typo("body"), color: COLORS.textMuted },
};

export default AdminSendNotificationScreen;
