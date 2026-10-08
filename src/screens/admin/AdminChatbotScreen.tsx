/**
 * AdminChatbotScreen — port CHÍNH XÁC mobile/src/screens/Admin/AdminChatbotScreen.js (428 dòng).
 * AI Trợ lý Admin (modal presentation) — chat + vision: gửi FormData {message, image?}
 * qua sendAdminChatMessage (timeout 60s), render bold/italic/bullet/heading (markdown
 * của AI) qua FormattedText port tại chỗ (giống parent/ChatbotScreen.tsx), typing dots
 * animation, quick actions, preview ảnh đính kèm.
 *
 * Khác biệt platform (ghi mobile-parity-map.md):
 * - expo-image-picker (Thư viện/Camera + permission) → 1 <input type="file" accept="image/*">
 *   ẩn: trình chọn file của hệ điều hành mở luôn gallery + camera trên mobile web.
 * - Alert.alert 3 nút "Đính kèm ảnh" → mở trực tiếp file picker (không có Alert 3 nút trên web).
 * - KeyboardAvoidingView → không cần trên web (webview tự co viewport khi bàn phím mở).
 * - Animated.loop typing dots → CSS keyframe edc-typing (có sẵn trong app.css).
 * - Backend có thể trả image_analysis trong response text — RN không render field riêng,
 *   bản port giữ nguyên hành vi (chỉ render text + actions).
 * - Icon thiếu glyph: không có (camera→camera-outline dùng sẵn).
 */
import React, { useState, useRef, useEffect } from "react";
import Icon from "@/components/Icon";
import { Touchable, Spinner, StatusBarSpacer, useStatusBarHeight } from "@/components/ui";
import { COLORS, TYPO, SIZES, SHADOWS, typo } from "@/theme";
import { useNav } from "@/navigation/router";
import { sendAdminChatMessage } from "@/api/misc";

// ====================================================================
// Admin AI Chatbot — đồng bộ với web (admin_dashboard.html phần chat)
// Hỗ trợ vision: upload ảnh + message → Gemini phân tích
// ====================================================================

interface ChatMsg {
  id: string;
  role: "user" | "assistant";
  text: string;
  image?: string | null;
  actions?: string[];
}

const INITIAL_MESSAGES: ChatMsg[] = [
  {
    id: "welcome",
    role: "assistant",
    text: "🛡️ Xin chào Admin! Tôi là trợ lý AI của EduCareLink.\n\nTôi có thể:\n• Thống kê nhanh số liệu hệ thống\n• Phân tích ảnh (CCCD, bằng cấp, ảnh khiếu nại)\n• Gợi ý hành động xử lý khiếu nại\n• Tìm kiếm user theo tiêu chí\n\nBạn có thể gửi kèm ảnh để tôi phân tích! 📸",
  },
];

/* ---------------- FormattedText — port mobile/src/components/FormattedText.js ---------------- */
const FormattedText: React.FC<{ text: string; baseColor?: string }> = ({ text, baseColor }) => {
  if (!text) return null;

  const textColor = baseColor || COLORS.textPrimary;
  const base: React.CSSProperties = { ...TYPO.body, fontSize: 15, lineHeight: "22px", color: textColor };
  const lines = text.split("\n");

  const renderInline = (str: string, keyPrefix: string): React.ReactNode[] => {
    // Parse **bold** và *italic* — thuật toán nguyên bản RN
    const parts: React.ReactNode[] = [];
    let remaining = str;
    let keyIdx = 0;

    while (remaining.length > 0) {
      const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
      const italicMatch = remaining.match(/\*(.+?)\*/);

      if (boldMatch && (!italicMatch || (boldMatch.index ?? 0) <= (italicMatch.index ?? 0))) {
        const before = remaining.substring(0, boldMatch.index);
        if (before) parts.push(<span key={`${keyPrefix}-${keyIdx++}`}>{before}</span>);
        parts.push(
          <span key={`${keyPrefix}-${keyIdx++}`} style={{ fontWeight: 700 }}>
            {boldMatch[1]}
          </span>
        );
        remaining = remaining.substring((boldMatch.index ?? 0) + boldMatch[0].length);
      } else if (italicMatch) {
        const before = remaining.substring(0, italicMatch.index);
        if (before) parts.push(<span key={`${keyPrefix}-${keyIdx++}`}>{before}</span>);
        parts.push(
          <span key={`${keyPrefix}-${keyIdx++}`} style={{ fontStyle: "italic" }}>
            {italicMatch[1]}
          </span>
        );
        remaining = remaining.substring((italicMatch.index ?? 0) + italicMatch[0].length);
      } else {
        parts.push(<span key={`${keyPrefix}-${keyIdx++}`}>{remaining}</span>);
        remaining = "";
      }
    }
    return parts;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {lines.map((line, idx) => {
        const trimmed = line.trim();

        // Dòng trống
        if (!trimmed) {
          return <div key={`empty-${idx}`} style={{ height: 6 }} />;
        }

        // Heading ###
        if (trimmed.startsWith("### ")) {
          return (
            <div
              key={`h3-${idx}`}
              style={{ ...base, fontWeight: 700, fontSize: 15, marginTop: 6, marginBottom: 2 }}
            >
              {renderInline(trimmed.substring(4), `h3-${idx}`)}
            </div>
          );
        }

        // Bullet • - *
        if (/^[•\-\*]\s+/.test(trimmed)) {
          const content = trimmed.replace(/^[•\-\*]\s+/, "");
          return (
            <div
              key={`bullet-${idx}`}
              style={{ display: "flex", flexDirection: "row", gap: 8, paddingLeft: 4, paddingTop: 1, paddingBottom: 1 }}
            >
              <span style={{ ...base, fontWeight: 700, fontSize: 14, lineHeight: "20px", minWidth: 14 }}>•</span>
              <span style={{ ...base, fontSize: 14, lineHeight: "20px", flex: 1 }}>{renderInline(content, `b-${idx}`)}</span>
            </div>
          );
        }

        // Numbered 1. 2. 3.
        const numMatch = trimmed.match(/^(\d+)\.\s+(.+)/);
        if (numMatch) {
          return (
            <div
              key={`num-${idx}`}
              style={{ display: "flex", flexDirection: "row", gap: 8, paddingLeft: 4, paddingTop: 1, paddingBottom: 1 }}
            >
              <span style={{ ...base, fontWeight: 700, fontSize: 14, lineHeight: "20px", minWidth: 14 }}>{numMatch[1]}.</span>
              <span style={{ ...base, fontSize: 14, lineHeight: "20px", flex: 1 }}>{renderInline(numMatch[2], `n-${idx}`)}</span>
            </div>
          );
        }

        // Plain line
        return (
          <div key={`line-${idx}`} style={base}>
            {renderInline(trimmed, `l-${idx}`)}
          </div>
        );
      })}
    </div>
  );
};

const AdminChatbotScreen: React.FC = () => {
  const nav = useNav();
  const sbH = useStatusBarHeight();
  const [messages, setMessages] = useState<ChatMsg[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [attachedImage, setAttachedImage] = useState<{ uri: string; file: File } | null>(null);
  const flatListRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const chatHistoryRef = useRef<{ role: string; text: string }[]>([]);

  /** RN scrollToEnd + onContentSizeChange — cuộn xuống cuối sau khi render xong */
  useEffect(() => {
    const timerId = setTimeout(() => {
      try {
        flatListRef.current?.scrollTo({ top: flatListRef.current.scrollHeight, behavior: "smooth" });
      } catch (e) {
        /* bỏ qua */
      }
    }, 100);
    return () => clearTimeout(timerId);
  }, [messages, isTyping]);

  /** expo-image-picker → file picker của web (gallery + camera tuỳ HĐH) */
  const openImagePicker = () => {
    fileInputRef.current?.click();
  };

  const onFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAttachedImage({ uri: URL.createObjectURL(file), file });
    }
    // Cho phép chọn lại cùng 1 file lần nữa
    e.target.value = "";
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text && !attachedImage) return;

    const userMsg: ChatMsg = {
      id: Date.now().toString(),
      role: "user",
      text: text || "(ảnh đính kèm)",
      image: attachedImage?.uri || null,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    const imageData = attachedImage;
    setAttachedImage(null);

    // Lưu vào history (chỉ text để backend Gemini không cần ảnh trong history)
    if (text) chatHistoryRef.current.push({ role: "user", text });

    try {
      // Build FormData — gửi kèm ảnh nếu có
      const formData = new FormData();
      formData.append("message", text || "Hãy phân tích ảnh này.");
      if (imageData) {
        formData.append("image", imageData.file, "admin_upload.jpg");
      }

      const res = await sendAdminChatMessage(formData);
      const botText = res.data?.response || res.data?.message || "AI đang xử lý. Vui lòng thử lại sau!";
      const botMsg: ChatMsg = {
        id: `${Date.now() + 1}`,
        role: "assistant",
        text: botText,
      };

      // Nếu backend trả về thêm actions (gợi ý hành động)
      if (res.data?.actions && Array.isArray(res.data.actions) && res.data.actions.length > 0) {
        botMsg.actions = res.data.actions;
      }

      chatHistoryRef.current.push({ role: "assistant", text: botText });
      if (chatHistoryRef.current.length > 20) {
        chatHistoryRef.current = chatHistoryRef.current.slice(-20);
      }

      setMessages((prev) => [...prev, botMsg]);
    } catch (e: any) {
      const errMsg = e?.response?.data?.error || e?.message || "Lỗi kết nối tới AI.";
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now() + 1}`,
          role: "assistant",
          text: `❌ ${errMsg}`,
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const renderMessage = (item: ChatMsg) => {
    const isUser = item.role === "user";
    return (
      <div style={{ ...S.msgRow, ...(isUser ? S.msgRowUser : S.msgRowBot) }}>
        {!isUser && (
          <div style={S.botAvatar}>
            <Icon name="shield-checkmark" size={20} color={COLORS.primary} />
          </div>
        )}
        <div style={{ ...S.bubble, ...(isUser ? S.bubbleUser : S.bubbleBot) }}>
          {item.image && <img src={item.image} alt="" style={{ ...S.msgImage, objectFit: "cover" }} />}
          {isUser ? (
            <div style={{ ...S.bubbleText, ...S.bubbleTextUser, whiteSpace: "pre-wrap" }}>{item.text}</div>
          ) : (
            <div style={{ ...S.bubbleText, ...S.bubbleTextBot }}>
              <FormattedText text={item.text || ""} baseColor={COLORS.textPrimary} />
            </div>
          )}
          {item.actions && item.actions.length > 0 && (
            <div style={S.actionsWrap}>
              {item.actions.map((action, idx) => (
                <div key={idx} style={S.actionChip}>
                  <Icon name="sparkles" size={11} color={COLORS.primary} />
                  <span style={S.actionText}>{action}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: COLORS.background, overflow: "hidden" }}>
      {/* RN TextInput placeholder màu textMuted */}
      <style>{`.edc-admin-chat-input::placeholder{color:${COLORS.textMuted};opacity:1}`}</style>
      {/* File picker ẩn thay expo-image-picker */}
      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onFilePicked} />

      {/* Header */}
      <div style={{ ...S.header, paddingTop: Math.max(6, 56 - sbH) }}>
        <Touchable onPress={nav.goBack} style={S.backBtn}>
          <Icon name="arrow-back" size={22} color="#fff" />
        </Touchable>
        <div style={S.headerInfo}>
          <div style={S.headerTitle}>AI Trợ lý Admin</div>
          <div style={S.statusRow}>
            <div style={S.statusDot} />
            <div style={S.headerStatus}>Vision + Chat</div>
          </div>
        </div>
        <div style={{ marginRight: 8 }}>
          <Icon name="sparkles" size={22} color="#fff" />
        </div>
      </div>

      {/* Danh sách tin nhắn */}
      <div ref={flatListRef} style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
        <div style={S.list}>
          {messages.map((item) => renderMessage(item))}
          {isTyping && (
            <div style={S.typingRow}>
              <div style={S.botAvatar}>
                <Icon name="shield-checkmark" size={20} color={COLORS.primary} />
              </div>
              <div style={S.typingBubble}>
                {[0, 0.15, 0.3].map((delay, i) => (
                  <span
                    key={i}
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: 4,
                      background: COLORS.primarySoft,
                      display: "inline-block",
                      animation: `edc-typing 0.9s ${delay}s infinite`,
                    }}
                  />
                ))}
                <span style={S.typingText}>AI đang phân tích...</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Preview ảnh đã chọn */}
      {attachedImage && (
        <div style={S.imagePreviewBar}>
          <img src={attachedImage.uri} alt="" style={{ ...S.previewThumb, objectFit: "cover" }} />
          <div style={{ flex: 1 }}>
            <div style={S.previewLabel}>📸 Ảnh đã đính kèm</div>
            <div style={S.previewHint}>Sẽ gửi kèm tin nhắn tới AI</div>
          </div>
          <Touchable onPress={() => setAttachedImage(null)} style={S.removeImageBtn}>
            <Icon name="close-circle" size={22} color={COLORS.error} />
          </Touchable>
        </div>
      )}

      {/* Quick actions */}
      <div style={S.quickActionsRow}>
        <Touchable style={S.quickBtn} onPress={() => setInput("Thống kê nhanh hệ thống")}>
          <Icon name="stats-chart" size={14} color={COLORS.primary} />
          <span style={S.quickBtnText}>Thống kê</span>
        </Touchable>
        <Touchable style={S.quickBtn} onPress={() => setInput("Có bao nhiêu khiếu nại đang chờ xử lý?")}>
          <Icon name="alert-circle" size={14} color={COLORS.warning} />
          <span style={S.quickBtnText}>Khiếu nại</span>
        </Touchable>
        <Touchable style={S.quickBtn} onPress={() => setInput("Liệt kê carepartner có đánh giá 1 sao")}>
          <Icon name="star-outline" size={14} color={COLORS.error} />
          <span style={S.quickBtnText}>Review xấu</span>
        </Touchable>
        <Touchable style={S.quickBtn} onPress={openImagePicker}>
          <Icon name="camera-outline" size={14} color={COLORS.secondary} />
          <span style={S.quickBtnText}>Phân tích ảnh</span>
        </Touchable>
      </div>

      {/* Input bar */}
      <div style={S.inputBar}>
        <Touchable style={S.attachBtn} onPress={openImagePicker}>
          <Icon name="add-circle" size={26} color={COLORS.primary} />
        </Touchable>
        <div style={{ ...S.inputWrap, ...(inputFocused ? S.inputWrapFocused : {}) }}>
          <textarea
            className="edc-admin-chat-input"
            style={S.input}
            placeholder="Nhắn tin cho AI hoặc gửi ảnh để phân tích..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={1000}
            rows={1}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
          />
        </div>
        <Touchable
          style={{ ...S.sendBtn, ...(!input.trim() && !attachedImage ? S.sendBtnDisabled : {}) }}
          onPress={sendMessage}
          disabled={(!input.trim() && !attachedImage) || isTyping}
        >
          {isTyping ? (
            <Spinner size={18} color="#fff" />
          ) : (
            <Icon name="send" size={18} color={input.trim() || attachedImage ? "#fff" : COLORS.textMuted} />
          )}
        </Touchable>
      </div>
    </div>
  );
};

const S: Record<string, React.CSSProperties> = {
  header: {
    display: "flex",
    alignItems: "center",
    background: COLORS.primary,
    padding: "0 16px 16px",
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
  headerInfo: { flex: 1, display: "flex", flexDirection: "column" },
  headerTitle: { ...typo("h4"), color: "#fff", fontWeight: 800 },
  statusRow: { display: "flex", flexDirection: "row", alignItems: "center", gap: 4 },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    background: "#fff",
  },
  headerStatus: { ...typo("caption"), color: "#fff", fontWeight: 600 },
  list: { padding: 16, display: "flex", flexDirection: "column", gap: 12, flexGrow: 1, paddingBottom: 20 },
  msgRow: { display: "flex", flexDirection: "row", gap: 8, alignItems: "flex-end" },
  msgRowUser: { justifyContent: "flex-end" },
  msgRowBot: { justifyContent: "flex-start" },
  botAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    background: COLORS.primaryLight,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  bubble: { maxWidth: "78%", borderRadius: 18, padding: 12 },
  bubbleUser: {
    background: COLORS.primary,
    borderBottomRightRadius: 4,
    boxShadow: SHADOWS.small,
  },
  bubbleBot: {
    background: COLORS.surface,
    borderBottomLeftRadius: 4,
    boxShadow: SHADOWS.cardHover,
    border: `1px solid ${COLORS.border}`,
  },
  bubbleText: { ...TYPO.body, lineHeight: "22px" },
  bubbleTextUser: { color: COLORS.textOnPrimary },
  bubbleTextBot: { color: COLORS.textPrimary },
  msgImage: {
    width: 180,
    height: 130,
    borderRadius: 8,
    marginBottom: 8,
    display: "block",
  },
  actionsWrap: { display: "flex", flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  actionChip: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    background: COLORS.primaryLight,
    borderRadius: 12,
    padding: "4px 8px",
  },
  actionText: { ...typo("caption"), color: COLORS.primary, fontWeight: 700, fontSize: 11 },
  typingRow: { display: "flex", flexDirection: "row", gap: 8, alignItems: "center", marginTop: 4 },
  typingBubble: {
    display: "flex",
    flexDirection: "row",
    gap: 5,
    alignItems: "center",
    background: COLORS.surface,
    borderRadius: 18,
    padding: 12,
    border: `1px solid ${COLORS.border}`,
    boxShadow: SHADOWS.small,
  },
  typingText: { ...typo("bodySmall"), color: COLORS.textSecondary, fontStyle: "italic", marginLeft: 4 },
  imagePreviewBar: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: "8px 16px",
    background: COLORS.primaryLight,
    borderBottom: `1px solid ${COLORS.primarySoft}`,
  },
  previewThumb: { width: 50, height: 50, borderRadius: 6, flexShrink: 0 },
  previewLabel: { ...typo("buttonSmall"), color: COLORS.primary, fontWeight: 700 },
  previewHint: { ...typo("caption"), color: COLORS.textSecondary },
  removeImageBtn: { padding: 4 },
  quickActionsRow: {
    display: "flex",
    flexDirection: "row",
    gap: 6,
    padding: "8px 12px",
    background: COLORS.surface,
    borderTop: `1px solid ${COLORS.border}`,
    flexWrap: "wrap",
  },
  quickBtn: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    background: COLORS.background,
    borderRadius: 14,
    padding: "6px 10px",
    border: `1px solid ${COLORS.border}`,
  },
  quickBtnText: { ...typo("caption"), color: COLORS.textPrimary, fontWeight: 600, fontSize: 11 },
  inputBar: {
    display: "flex",
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    padding: "10px 12px 28px",
    background: COLORS.surface,
    borderTop: `1px solid ${COLORS.border}`,
  },
  attachBtn: { padding: 4 },
  inputWrap: {
    flex: 1,
    background: COLORS.background,
    borderRadius: SIZES.radiusXl,
    border: "1.5px solid transparent",
  },
  inputWrapFocused: {
    borderColor: COLORS.primary,
    background: COLORS.surface,
    boxShadow: SHADOWS.inputFocus,
  },
  input: {
    ...typo("body"),
    color: COLORS.textPrimary,
    width: "100%",
    padding: "10px 14px",
    maxHeight: 100,
    background: "transparent",
    border: "none",
    outline: "none",
    resize: "none",
    fontFamily: TYPO.body.fontFamily,
    display: "block",
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    background: COLORS.primary,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    boxShadow: SHADOWS.small,
    flexShrink: 0,
  },
  sendBtnDisabled: { background: COLORS.divider },
};

export default AdminChatbotScreen;
