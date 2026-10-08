/**
 * HelpCenterScreen — port CHÍNH XÁC mobile/src/screens/HelpCenter/HelpCenterScreen.js (287 dòng).
 * Chatbot Trung tâm hỗ trợ: sendHelpCenterMessage(message, history) (timeout AI 60s),
 * quick questions ngang, typing indicator 3 dot bounce, FormattedText cho bubble AI
 * (bold/italic/bullet/numbered/heading — port NỘI TẠY components/FormattedText.js).
 *
 * Khác biệt platform (ghi mobile-parity-map.md):
 *  - Animated.loop 3 dot (translateY 0→-5, delay 0/150/300ms) → CSS @keyframes
 *    edcDotBounce 0.6s infinite + animation-delay tương ứng.
 *  - FlatList scrollToEnd → div overflowY + scrollTop = scrollHeight sau mỗi
 *    messages/isTyping thay đổi (RN onContentSizeChange).
 *  - KeyboardAvoidingView không cần trên web; TextInput multiline maxLength 500
 *    → <textarea> (onSubmitEditing RN-iOS không fire trên multiline → không
 *    bind Enter, gửi bằng nút send như RN).
 *  - shadowColor/shadowOffset riêng của bubbleUser/sendBtn → boxShadow tương đương.
 *  - Icon thiếu glyph → alias cục bộ: help-circle→help-circle-outline,
 *    paper-plane-outline→send (quickBtn dùng send của zalo), ribbon-outline→ribbon,
 *    close-circle-outline→close-circle.
 */
import React, { useState, useRef, useEffect } from "react";
import Icon from "@/components/Icon";
import { StatusBarSpacer, Touchable } from "@/components/ui";
import { COLORS, TYPO, SIZES, SHADOWS, typo } from "@/theme";
import { useNav } from "@/navigation/router";
import { sendHelpCenterMessage } from "@/api/tasks";

/* ── Alias icon: glyph RN không có trong ionicons.ts zalo → glyph gần nhất ── */
const ICON_ALIAS: Record<string, string> = {
  "help-circle": "help-circle-outline",
  "paper-plane-outline": "send",
  "ribbon-outline": "ribbon",
  "close-circle-outline": "close-circle",
};
const ic = (name: string) => ICON_ALIAS[name] ?? name;

/* ════════ FormattedText — port nguyên văn components/FormattedText.js ════════ */
/**
 * Render text AI response với format: gạch đầu dòng, **bold**, headings.
 * - `**text**` → bold | `*text*` → italic
 * - Dòng `•`, `-`, `*` → bullet | `1.` → numbered | `###` → heading
 */
const FormattedText: React.FC<{
  text: string;
  style: React.CSSProperties;
  baseColor?: string;
}> = ({ text, style, baseColor }) => {
  if (!text) return null;

  const textColor = baseColor || (style.color as string) || COLORS.textPrimary;

  // Split text thành các dòng
  const lines = text.split("\n");

  const renderInline = (str: string, keyPrefix: string): React.ReactNode[] => {
    // Parse **bold** và *italic*
    const parts: React.ReactNode[] = [];
    let remaining = str;
    let keyIdx = 0;

    while (remaining.length > 0) {
      // Bold **text**
      const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
      // Italic *text* (single asterisk, không phải **)
      const italicMatch = remaining.match(/\*(.+?)\*/);

      if (boldMatch && (!italicMatch || (boldMatch.index ?? 0) <= (italicMatch.index ?? 0))) {
        const before = remaining.substring(0, boldMatch.index);
        if (before) parts.push(<span key={`${keyPrefix}-${keyIdx++}`}>{before}</span>);
        parts.push(
          <span key={`${keyPrefix}-${keyIdx++}`} style={{ fontWeight: 700 }}>
            {boldMatch[1]}
          </span>
        );
        remaining = remaining.substring(boldMatch.index! + boldMatch[0].length);
      } else if (italicMatch) {
        const before = remaining.substring(0, italicMatch.index);
        if (before) parts.push(<span key={`${keyPrefix}-${keyIdx++}`}>{before}</span>);
        parts.push(
          <span key={`${keyPrefix}-${keyIdx++}`} style={{ fontStyle: "italic" }}>
            {italicMatch[1]}
          </span>
        );
        remaining = remaining.substring(italicMatch.index! + italicMatch[0].length);
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
              style={{ ...style, fontWeight: 700, fontSize: 15, marginTop: 6, marginBottom: 2 }}
            >
              {renderInline(trimmed.substring(4), `h3-${idx}`)}
            </div>
          );
        }

        // Bullet • - *
        if (/^[•\-\*]\s+/.test(trimmed)) {
          const content = trimmed.replace(/^[•\-\*]\s+/, "");
          return (
            <div key={`bullet-${idx}`} style={{ display: "flex", flexDirection: "row", gap: 8, padding: "1px 0 1px 4px" }}>
              <div style={{ ...style, fontWeight: 700, fontSize: 14, lineHeight: "20px", minWidth: 14, color: textColor }}>
                •
              </div>
              <div style={{ ...style, flex: 1, lineHeight: "20px" }}>
                {renderInline(content, `b-${idx}`)}
              </div>
            </div>
          );
        }

        // Numbered 1. 2. 3.
        const numMatch = trimmed.match(/^(\d+)\.\s+(.+)/);
        if (numMatch) {
          return (
            <div key={`num-${idx}`} style={{ display: "flex", flexDirection: "row", gap: 8, padding: "1px 0 1px 4px" }}>
              <div style={{ ...style, fontWeight: 700, fontSize: 14, lineHeight: "20px", minWidth: 14, color: textColor }}>
                {numMatch[1]}.
              </div>
              <div style={{ ...style, flex: 1, lineHeight: "20px" }}>
                {renderInline(numMatch[2], `n-${idx}`)}
              </div>
            </div>
          );
        }

        // Plain line
        return (
          <div key={`line-${idx}`} style={style}>
            {renderInline(trimmed, `l-${idx}`)}
          </div>
        );
      })}
    </div>
  );
};

const INITIAL_MESSAGES = [
  {
    id: "welcome",
    role: "assistant",
    text: "👋 Xin chào! Tôi là trợ lý AI của EduCareLink.\n\nTôi sẽ giúp bạn giải đáp mọi thắc mắc về cách sử dụng ứng dụng. Hãy chọn câu hỏi gợi ý bên dưới hoặc gõ câu hỏi của bạn 👇",
  },
];

const QUICK_QUESTIONS = [
  { label: "Cách ứng tuyển việc?", icon: "paper-plane-outline" },
  { label: "Làm sao để gửi bằng cấp?", icon: "ribbon-outline" },
  { label: "Cách chỉnh sửa hồ sơ?", icon: "create-outline" },
  { label: "Tại sao tài khoản chưa được duyệt?", icon: "time-outline" },
  { label: "Khi nào nhận được tiền?", icon: "wallet-outline" },
  { label: "Cách huỷ việc đã ứng tuyển?", icon: "close-circle-outline" },
];

/* ── Styles (StyleSheet.create RN → CSS 1:1) ── */
const S: Record<string, React.CSSProperties> = {
  container: {
    flex: 1,
    minHeight: "100dvh",
    background: COLORS.background,
    display: "flex",
    flexDirection: "column",
  },
  header: {
    background: COLORS.surface,
    padding: "12px 12px 16px",
    borderBottom: `1px solid ${COLORS.border}`,
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: SIZES.radiusSm,
    background: COLORS.background,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  botInfo: { display: "flex", flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    background: COLORS.primaryLight,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    boxShadow: SHADOWS.small,
    flexShrink: 0,
  },
  headerName: { ...typo("h5"), color: COLORS.textPrimary, fontWeight: 700 },
  statusRow: { display: "flex", flexDirection: "row", alignItems: "center", gap: 4 },
  statusDot: { width: 7, height: 7, borderRadius: 4, background: COLORS.success },
  headerStatus: { ...typo("caption"), color: COLORS.success, fontWeight: 600 },
  list: {
    flex: 1,
    overflowY: "auto",
    padding: 16,
    display: "flex",
    flexDirection: "column",
    gap: 12,
    flexGrow: 1,
  },
  sectionLabel: { ...typo("overline"), color: COLORS.textMuted, marginBottom: 8, fontWeight: 700 },
  quickScroll: { display: "flex", flexDirection: "row", gap: 8, padding: "4px 0 8px", overflowX: "auto" },
  quickBtn: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    background: COLORS.primaryLight,
    borderRadius: SIZES.radiusXl,
    padding: "6px 12px",
    border: `1px solid ${COLORS.primarySoft}`,
    whiteSpace: "nowrap",
    flexShrink: 0,
  },
  quickText: { ...typo("caption"), color: COLORS.primary, fontWeight: 600 },
  msgRow: { display: "flex", flexDirection: "row", gap: 8, alignItems: "flex-end" },
  msgRowUser: { justifyContent: "flex-end" },
  botAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    background: COLORS.primaryLight,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
    overflow: "hidden",
  },
  bubble: { maxWidth: "78%", borderRadius: 18, padding: 12, boxSizing: "border-box" },
  bubbleUser: {
    background: COLORS.primary,
    borderBottomRightRadius: 4,
    boxShadow: "0px 2px 8px rgba(242, 101, 34, 0.25)",
  },
  bubbleBot: {
    background: COLORS.surface,
    borderBottomLeftRadius: 4,
    boxShadow: SHADOWS.cardHover,
    border: `1px solid ${COLORS.border}`,
  },
  bubbleText: { ...typo("body", { lineHeight: "22px" }) },
  bubbleTextUser: { color: COLORS.textOnPrimary },
  bubbleTextBot: { color: COLORS.textPrimary },
  typingRow: { display: "flex", flexDirection: "row", gap: 8, alignItems: "center", marginTop: 4 },
  typingBubble: {
    display: "flex",
    flexDirection: "row",
    gap: 5,
    alignItems: "center",
    background: COLORS.surface,
    borderRadius: 18,
    padding: 12,
    boxShadow: SHADOWS.small,
    border: `1px solid ${COLORS.border}`,
  },
  typingDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    background: COLORS.primarySoft,
    animation: "edcDotBounce 0.6s ease-in-out infinite",
  },
  typingText: {
    ...typo("bodySmall"),
    color: COLORS.textSecondary,
    fontStyle: "italic",
    marginLeft: 4,
  },
  inputBar: {
    display: "flex",
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    padding: "12px 16px 28px",
    background: COLORS.surface,
    borderTop: `1px solid ${COLORS.border}`,
  },
  inputWrap: {
    flex: 1,
    background: COLORS.background,
    borderRadius: SIZES.radiusXl,
    border: "1.5px solid transparent",
    boxSizing: "border-box",
  },
  inputWrapFocused: {
    borderColor: COLORS.primary,
    background: COLORS.surface,
    boxShadow: SHADOWS.inputFocus,
  },
  input: {
    ...typo("body", { lineHeight: "22px" }),
    color: COLORS.textPrimary,
    padding: "10px 16px",
    maxHeight: 100,
    border: "none",
    outline: "none",
    background: "transparent",
    resize: "none",
    width: "100%",
    boxSizing: "border-box",
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
    boxShadow: "0px 2px 8px rgba(242, 101, 34, 0.3)",
    flexShrink: 0,
  },
  sendBtnDisabled: { background: COLORS.divider, boxShadow: "none" },
};

const HelpCenterScreen: React.FC = () => {
  const nav = useNav();
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const chatHistoryRef = useRef<any[]>([]);

  const sendMessage = async (textArg?: string) => {
    const text = (textArg || input).trim();
    if (!text) return;

    const userMsg = { id: Date.now().toString(), role: "user", text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    chatHistoryRef.current.push({ role: "user", text });

    try {
      const historyForAPI = chatHistoryRef.current.map((m) => ({
        role: m.role === "user" ? "user" : "model",
        text: m.text,
      }));

      const res: any = await sendHelpCenterMessage(text, historyForAPI);
      const botText = res.response || res.answer || "Tôi đang được tích hợp. Vui lòng thử lại sau!";
      const botMsg = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        text: botText,
      };

      chatHistoryRef.current.push({ role: "assistant", text: botText });
      if (chatHistoryRef.current.length > 20) {
        chatHistoryRef.current = chatHistoryRef.current.slice(-20);
      }

      setMessages((prev) => [...prev, botMsg]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          text: "❌ Lỗi kết nối. Vui lòng kiểm tra mạng và thử lại.",
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  // RN: scrollToEnd sau mỗi messages/isTyping thay đổi (FlatList + setTimeout 100ms)
  useEffect(() => {
    if (!listRef.current) return undefined;
    const timerId = setTimeout(() => {
      if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
    }, 100);
    return () => clearTimeout(timerId);
  }, [messages, isTyping]);

  const renderMessage = (item: any) => {
    const isUser = item.role === "user";
    return (
      <div style={{ ...S.msgRow, ...(isUser ? S.msgRowUser : {}) }}>
        {!isUser && (
          <div style={S.botAvatar}>
            <Icon name={ic("help-circle")} size={18} color={COLORS.info} />
          </div>
        )}
        <div style={{ ...S.bubble, ...(isUser ? S.bubbleUser : S.bubbleBot) }}>
          {isUser ? (
            <div style={{ ...S.bubbleText, ...S.bubbleTextUser }}>{item.text}</div>
          ) : (
            <FormattedText
              text={item.text}
              style={{ ...S.bubbleText, ...S.bubbleTextBot }}
              baseColor={COLORS.textPrimary}
            />
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={S.container}>
      <StatusBarSpacer />
      {/* Keyframes typing indicator (thay Animated.loop của RN) */}
      <style>{`
        @keyframes edcDotBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        .edc-hc-input::placeholder{color:${COLORS.textMuted};opacity:1}
      `}</style>

      <div style={S.header}>
        <Touchable onPress={nav.goBack} style={S.backBtn}>
          <Icon name="arrow-back" size={22} color={COLORS.textPrimary} />
        </Touchable>
        <div style={S.botInfo}>
          <div style={S.headerAvatar}>
            <Icon name={ic("help-circle")} size={22} color={COLORS.info} />
          </div>
          <div>
            <div style={S.headerName}>Trung tâm hỗ trợ</div>
            <div style={S.statusRow}>
              <div style={S.statusDot} />
              <div style={S.headerStatus}>AI đang trực tuyến</div>
            </div>
          </div>
        </div>
      </div>

      {/* RN FlatList — ListHeader = quick questions, ListFooter = typing indicator */}
      <div ref={listRef} style={S.list}>
        <div>
          <div style={S.sectionLabel}>Câu hỏi phổ biến</div>
          <div style={S.quickScroll}>
            {QUICK_QUESTIONS.map((q, idx) => (
              <Touchable
                key={idx}
                style={S.quickBtn}
                onPress={() => sendMessage(q.label)}
                activeOpacity={0.8}
              >
                <Icon name={ic(q.icon)} size={12} color={COLORS.primary} />
                <div style={S.quickText}>{q.label}</div>
              </Touchable>
            ))}
          </div>
        </div>

        {messages.map((m) => (
          <React.Fragment key={m.id}>{renderMessage(m)}</React.Fragment>
        ))}

        {isTyping && (
          <div style={S.typingRow}>
            <div style={S.botAvatar}>
              <Icon name={ic("help-circle")} size={18} color={COLORS.info} />
            </div>
            <div style={S.typingBubble}>
              <div style={{ ...S.typingDot, animationDelay: "0s" }} />
              <div style={{ ...S.typingDot, animationDelay: "0.15s" }} />
              <div style={{ ...S.typingDot, animationDelay: "0.3s" }} />
              <div style={S.typingText}>AI đang suy nghĩ...</div>
            </div>
          </div>
        )}
      </div>

      <div style={S.inputBar}>
        <div style={{ ...S.inputWrap, ...(inputFocused ? S.inputWrapFocused : {}) }}>
          <textarea
            className="edc-hc-input"
            style={S.input}
            placeholder="Mô tả vấn đề của bạn..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={500}
            rows={1}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
          />
        </div>
        <Touchable
          style={{ ...S.sendBtn, ...(input.trim() ? {} : S.sendBtnDisabled) }}
          onPress={() => sendMessage()}
          disabled={!input.trim() || isTyping}
        >
          <Icon name="send" size={18} color={input.trim() ? "#fff" : COLORS.textMuted} />
        </Touchable>
      </div>
    </div>
  );
};

export default HelpCenterScreen;
