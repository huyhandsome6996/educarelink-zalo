/**
 * WorkerChatbotScreen — port CHÍNH XÁC mobile/src/screens/Worker/WorkerChatbotScreen.js (496 dòng).
 * Tab GIỮA của Worker: y hệt ChatbotScreen parent nhưng:
 * - Tên bot "AI Trợ lý Carepartner"; API sendWorkerChatMessage (timeout 60s).
 * - ListHeaderComponent QuickQuestions: chips nền primaryLight radius
 *   SIZES.radiusXl viền primarySoft, bấm gửi thẳng label (RN sendMessage(q.label)).
 * - Card NGÀY BẬN (chatbot-fix-3 §3): AI trả type=blackout_created + blackouts →
 *   bubble maxWidth 88% gap 8, chips 46×46 ngày, nút "Lưu vào Lịch Bận & Bảo vệ
 *   ELO" (addBlackout TUẦN TỰ, 409 = trùng lịch bỏ qua) + "Mở Lịch bận" ->
 *   tab MatchingAvailability stack Blackout (switchTab).
 * - unmount-safe: isMountedRef chặn setState sau khi thoát màn (như RN).
 * Khác platform (mobile-parity-map.md):
 * - Không KeyboardAvoidingView; FlatList -> div scroll; textarea thay TextInput.
 * - Glyph thiếu trong bộ 159 ionicons: paper-plane-outline -> send, ribbon-outline
 *   -> ribbon (fallback cục bộ, thêm glyph sau bằng scripts/fetch_ionicons.py).
 * - Typing dots: CSS keyframes edc-typing delay 0/0.15/0.3s.
 */
import React, { useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon";
import { Spinner, showAlert, StatusBarSpacer, Touchable } from "@/components/ui";
import { COLORS, TYPO, SHADOWS, SIZES, TAB_BAR_HEIGHT } from "@/theme";
import { useNav } from "@/navigation/router";
import { sendWorkerChatMessage } from "@/api/tasks";
import { addBlackout } from "@/api/matching";

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: "welcome",
    role: "assistant",
    text: '👋 Chào Carepartner! Tôi là trợ lý AI dành riêng cho bạn.\n\nBạn có thể hỏi tôi về:\n• "Cách ứng tuyển việc?"\n• "Làm sao để gửi bằng cấp?"\n• "Khi nào nhận được tiền?"\n• "Tại sao tài khoản chưa được duyệt?"\n• Khai ngày bận nhanh: "thứ 5 tới mình bận cả ngày" — tôi tạo thẻ xác nhận, bạn duyệt mới lưu nhé!\n\nTôi sẽ hỗ trợ bạn! 🚀',
  },
];

const QUICK_QUESTIONS = [
  { label: "Cách ứng tuyển?", icon: "paper-plane-outline" },
  { label: "Gửi bằng cấp?", icon: "ribbon-outline" },
  { label: "Khi nào nhận tiền?", icon: "wallet-outline" },
  { label: "Tài khoản chưa duyệt?", icon: "time-outline" },
  { label: "Khai ngày bận", icon: "calendar-clear-outline" },
];

/** Glyph thiếu trong bộ ionicons.ts 159 glyph (Icon.tsx chưa có alias) — fallback gần nhất */
const ICON_FALLBACKS: Record<string, string> = {
  "paper-plane-outline": "send", // send = máy bay giấy
  "ribbon-outline": "ribbon",
};
const ic = (name: string) => ICON_FALLBACKS[name] ?? name;

interface BlackoutItem {
  date?: string;
  time_from?: string | null;
  time_to?: string | null;
  reason?: string;
  reason_label_vi?: string;
  note?: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "typing";
  text: string;
  blackouts?: BlackoutItem[];
  state?: "pending" | "saving" | "saved";
  savedCount?: number;
}

// 'YYYY-MM-DD' → 'DD/MM' (format vi-VN). Tách chuỗi thay vì new Date() để
// không dính lệch timezone (date 'YYYY-MM-DD' parse là UTC midnight).
const formatChipDate = (dateStr?: string) => {
  if (!dateStr) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(dateStr));
  if (m) return `${m[3]}/${m[2]}`;
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  return String(dateStr);
};

/* ---------------- FormattedText — port mobile/src/components/FormattedText.js ---------------- */
const FormattedText: React.FC<{ text: string; baseColor?: string }> = ({ text, baseColor }) => {
  if (!text) return null;

  const textColor = baseColor || COLORS.textPrimary;
  const base: React.CSSProperties = { fontSize: 14, lineHeight: "20px", color: textColor };
  const lines = text.split("\n");

  const renderInline = (str: string, keyPrefix: string): React.ReactNode[] => {
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

        if (!trimmed) {
          return <div key={`empty-${idx}`} style={{ height: 6 }} />;
        }

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

        if (/^[•\-\*]\s+/.test(trimmed)) {
          const content = trimmed.replace(/^[•\-\*]\s+/, "");
          return (
            <div
              key={`bullet-${idx}`}
              style={{ display: "flex", flexDirection: "row", gap: 8, paddingLeft: 4, paddingTop: 1, paddingBottom: 1 }}
            >
              <span style={{ ...base, fontWeight: 700, minWidth: 14 }}>•</span>
              <span style={{ ...base, flex: 1 }}>{renderInline(content, `b-${idx}`)}</span>
            </div>
          );
        }

        const numMatch = trimmed.match(/^(\d+)\.\s+(.+)/);
        if (numMatch) {
          return (
            <div
              key={`num-${idx}`}
              style={{ display: "flex", flexDirection: "row", gap: 8, paddingLeft: 4, paddingTop: 1, paddingBottom: 1 }}
            >
              <span style={{ ...base, fontWeight: 700, minWidth: 14 }}>{numMatch[1]}.</span>
              <span style={{ ...base, flex: 1 }}>{renderInline(numMatch[2], `n-${idx}`)}</span>
            </div>
          );
        }

        return (
          <div key={`line-${idx}`} style={base}>
            {renderInline(trimmed, `l-${idx}`)}
          </div>
        );
      })}
    </div>
  );
};

const WorkerChatbotScreen: React.FC = () => {
  const nav = useNav();
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const flatListRef = useRef<HTMLDivElement | null>(null);
  const chatHistoryRef = useRef<{ role: string; text: string }[]>([]);

  // chatbot-fix-3: unmount-safe — chặn setState sau khi thoát màn
  const isMountedRef = useRef(true);
  const savingBlackoutsRef = useRef(false);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  /** RN scrollToEnd — setTimeout 100ms, cuộn là phụ */
  const scrollToEnd = () => {
    setTimeout(() => {
      try {
        const el = flatListRef.current;
        if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      } catch (e) {
        /* bỏ qua */
      }
    }, 100);
  };

  useEffect(() => {
    scrollToEnd();
  }, [messages, isTyping]);

  const sendMessage = async (textArg?: string) => {
    const text = (textArg || input).trim();
    if (!text) return;

    const userMsg: ChatMessage = { id: Date.now().toString(), role: "user", text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    chatHistoryRef.current.push({ role: "user", text });

    try {
      const historyForAPI = chatHistoryRef.current.map((m) => ({
        role: m.role === "user" ? "user" : "model",
        text: m.text,
      }));

      const res: any = await sendWorkerChatMessage(text, historyForAPI);
      if (!isMountedRef.current) return;
      const data = res || {};
      const botText = data.response || "AI đang được tích hợp. Vui lòng thử lại sau!";
      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        text: botText,
      };

      // chatbot-fix-3 (§3 spec): AI phát hiện ngày bận → kèm danh sách
      // blackout để user duyệt 1-tap. Backend KHÔNG lưu — app gọi addBlackout
      // khi user bấm nút trên card.
      if (data.type === "blackout_created" && Array.isArray(data.blackouts) && data.blackouts.length > 0) {
        botMsg.blackouts = data.blackouts;
        botMsg.state = "pending"; // pending | saving | saved
      }

      chatHistoryRef.current.push({ role: "assistant", text: botText });
      if (chatHistoryRef.current.length > 20) {
        chatHistoryRef.current = chatHistoryRef.current.slice(-20);
      }

      setMessages((prev) => [...prev, botMsg]);
    } catch (e: any) {
      if (!isMountedRef.current) return;
      const errMsg =
        e?.response?.data?.response ||
        e?.response?.data?.error ||
        "❌ Lỗi kết nối. Vui lòng kiểm tra mạng và thử lại.";
      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: "assistant", text: errMsg },
      ]);
    } finally {
      if (isMountedRef.current) setIsTyping(false);
    }
  };

  // ===== LƯU NGÀY BẬN 1-TAP (POST /api/matching/carepartners/me/blackouts/)
  // Tuần tự addBlackout từng item — 409 coi là trùng lịch, bỏ qua.
  const handleSaveBlackouts = async (item: ChatMessage) => {
    if (item.state !== "pending" || savingBlackoutsRef.current) return;
    const patch = (p: Partial<ChatMessage>) =>
      setMessages((prev) => prev.map((m) => (m.id === item.id ? { ...m, ...p } : m)));
    savingBlackoutsRef.current = true;
    patch({ state: "saving" });

    let saved = 0;
    let skipped = 0;
    try {
      for (const b of item.blackouts || []) {
        try {
          await addBlackout({
            date: b.date,
            time_from: b.time_from ?? null,
            time_to: b.time_to ?? null,
            reason: b.reason,
            note: b.note || "",
          });
          saved += 1;
        } catch (e: any) {
          if (e?.response?.status === 409) {
            skipped += 1; // trùng đơn đã xác nhận — đã được bảo vệ sẵn, bỏ qua
          } else {
            if (!isMountedRef.current) return;
            showAlert(
              "Chưa lưu được",
              e?.response?.data?.detail || e?.response?.data?.error || "Có lỗi khi lưu ngày bận. Bạn thử lại nhé."
            );
          }
        }
      }
    } finally {
      savingBlackoutsRef.current = false;
    }

    if (!isMountedRef.current) return;
    const total = saved + skipped; // ngày bận đã được bảo vệ (kể cả trùng)
    if (total > 0) {
      patch({ state: "saved", savedCount: total });
      showAlert(
        "Thành công",
        `Đã lưu ${total} ngày bận${skipped > 0 ? ` (${skipped} ngày trùng lịch đã có sẵn — bỏ qua)` : ""}. ELO của bạn được bảo vệ khỏi đề xuất trong ngày bận.`
      );
    } else {
      patch({ state: "pending" }); // tất cả lỗi khác → cho thử lại
    }
  };

  const renderBlackoutCard = (item: ChatMessage) => {
    const items = item.blackouts || [];
    const saved = item.state === "saved";
    const saving = item.state === "saving";
    return (
      <div style={{ display: "flex", flexDirection: "row", gap: 8, alignItems: "flex-end", marginBottom: 10 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            background: COLORS.primaryLight,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            overflow: "hidden",
          }}
        >
          <Icon name="sparkles" size={18} color={COLORS.primary} />
        </div>
        <div
          style={{
            maxWidth: "88%",
            borderRadius: 18,
            padding: "10px 14px",
            background: COLORS.surface,
            border: `1px solid ${COLORS.border}`,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {/* Giữ câu trả lời của AI để user không mất ngữ cảnh */}
          {item.text ? <FormattedText text={item.text} baseColor={COLORS.textPrimary} /> : null}
          <div style={{ fontSize: 14, fontWeight: 800, color: COLORS.textPrimary, lineHeight: "19px" }}>
            {saved
              ? `✅ Đã lưu ${item.savedCount || items.length} ngày bận. ELO của bạn được bảo vệ khỏi đề xuất trong ngày bận.`
              : `🗓️ Phát hiện ${items.length} ngày bạn bận`}
          </div>
          {items.map((b, idx) => (
            <div
              key={idx}
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                gap: 9,
                background: COLORS.primaryLight,
                borderRadius: 12,
                padding: 8,
                border: `1px solid ${COLORS.primarySoft}`,
              }}
            >
              <div
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 10,
                  background: COLORS.surface,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 800, color: COLORS.primary }}>{formatChipDate(b.date)}</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.textPrimary }}>
                  {b.time_from && b.time_to ? `${b.time_from}-${b.time_to}` : "Cả ngày"}
                </div>
                {b.reason_label_vi ? (
                  <div
                    style={{
                      fontSize: 12,
                      color: COLORS.textSecondary,
                      marginTop: 1,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {b.reason_label_vi}
                    {b.note ? ` · ${b.note}` : ""}
                  </div>
                ) : b.note ? (
                  <div
                    style={{
                      fontSize: 12,
                      color: COLORS.textSecondary,
                      marginTop: 1,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {b.note}
                  </div>
                ) : null}
              </div>
            </div>
          ))}
          <Touchable
            onPress={() => handleSaveBlackouts(item)}
            disabled={saving || saved}
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 7,
              background: COLORS.primary,
              borderRadius: 12,
              padding: "11px 0",
              marginTop: 2,
              opacity: saving || saved ? 0.55 : 1,
            }}
          >
            {saving ? <Spinner size={16} color="#fff" /> : <Icon name="shield-checkmark" size={16} color="#fff" />}
            <span style={{ color: "#fff", fontSize: 13, fontWeight: 800 }}>Lưu vào Lịch Bận & Bảo vệ ELO</span>
          </Touchable>
          <Touchable
            onPress={() => {
              // Registry AppNavigator: tab 'MatchingAvailability' → stack 'Blackout'
              nav.switchTab("MatchingAvailability", "Blackout");
            }}
            disabled={saving}
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 5,
              borderRadius: 12,
              padding: "8px 0",
              border: `1px solid ${COLORS.primarySoft}`,
            }}
          >
            <Icon name="calendar-outline" size={15} color={COLORS.primary} />
            <span style={{ color: COLORS.primary, fontSize: 13, fontWeight: 700 }}>Mở Lịch bận</span>
          </Touchable>
        </div>
      </div>
    );
  };

  const renderMessage = (item: ChatMessage) => {
    if (item.role === "assistant" && item.blackouts) return renderBlackoutCard(item);
    const isUser = item.role === "user";
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          gap: 8,
          alignItems: "flex-end",
          marginBottom: 10,
          justifyContent: isUser ? "flex-end" : "flex-start",
        }}
      >
        {!isUser && (
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              background: COLORS.primaryLight,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              overflow: "hidden",
            }}
          >
            <Icon name="sparkles" size={18} color={COLORS.primary} />
          </div>
        )}
        <div
          style={{
            maxWidth: "78%",
            borderRadius: 18,
            padding: "10px 14px",
            ...(isUser
              ? { background: COLORS.primary, borderBottomRightRadius: 4 }
              : {
                  background: COLORS.surface,
                  borderBottomLeftRadius: 4,
                  border: `1px solid ${COLORS.border}`,
                }),
          }}
        >
          {isUser ? (
            <span style={{ fontSize: 14, lineHeight: "20px", color: "#fff", whiteSpace: "pre-wrap" }}>{item.text}</span>
          ) : (
            <FormattedText text={item.text} baseColor={COLORS.textPrimary} />
          )}
        </div>
      </div>
    );
  };

  const renderTyping = () => {
    if (!isTyping) return null;
    return (
      <div style={{ display: "flex", flexDirection: "row", gap: 8, alignItems: "flex-end", marginBottom: 10 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            background: COLORS.primaryLight,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            overflow: "hidden",
          }}
        >
          <Icon name="sparkles" size={18} color={COLORS.primary} />
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            gap: 5,
            alignItems: "center",
            background: COLORS.surface,
            borderRadius: 18,
            padding: 12,
            border: `1px solid ${COLORS.border}`,
          }}
        >
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
          <span style={{ ...TYPO.bodySmall, color: COLORS.textSecondary, fontStyle: "italic", marginLeft: 4 }}>
            AI đang suy nghĩ...
          </span>
        </div>
      </div>
    );
  };

  // ListHeaderComponent — QuickQuestions chips (render đầu danh sách cuộn)
  const QuickQuestions = () => (
    <div style={{ display: "flex", flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
      {QUICK_QUESTIONS.map((q, idx) => (
        <Touchable
          key={idx}
          onPress={() => sendMessage(q.label)}
          activeOpacity={0.8}
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            background: COLORS.primaryLight,
            borderRadius: SIZES.radiusXl,
            padding: "6px 12px",
            border: `1px solid ${COLORS.primarySoft}`,
          }}
        >
          <Icon name={ic(q.icon)} size={12} color={COLORS.primary} />
          <span style={{ ...TYPO.caption, color: COLORS.primary, fontWeight: 600 }}>{q.label}</span>
        </Touchable>
      ))}
    </div>
  );

  const listData: ChatMessage[] = isTyping ? [...messages, { id: "typing", role: "typing", text: "" }] : messages;

  return (
    <div
      style={{
        height: `calc(100dvh - ${TAB_BAR_HEIGHT}px)`,
        display: "flex",
        flexDirection: "column",
        background: COLORS.background,
        overflow: "hidden",
      }}
    >
      {/* RN TextInput placeholder màu textMuted — ghi đè màu placeholder mặc định của app.css */}
      <style>{`.edc-chat-placeholder::placeholder{color:${COLORS.textMuted};opacity:1}`}</style>

      {/* Header */}
      <div style={{ background: COLORS.surface, borderBottom: `1px solid ${COLORS.border}` }}>
        <StatusBarSpacer />
        <div style={{ padding: "12px 16px 16px", display: "flex", flexDirection: "row", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              background: COLORS.primaryLight,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              boxShadow: SHADOWS.small,
              flexShrink: 0,
            }}
          >
            <Icon name="sparkles" size={22} color={COLORS.primary} />
          </div>
          <div>
            <div style={{ ...TYPO.h5, color: COLORS.textPrimary, fontWeight: 700 }}>AI Trợ lý Carepartner</div>
            <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 4 }}>
              <div style={{ width: 7, height: 7, borderRadius: 4, background: COLORS.success }} />
              <div style={{ ...TYPO.caption, color: COLORS.success, fontWeight: 600 }}>Đang hoạt động</div>
            </div>
          </div>
        </div>
      </div>

      {/* Danh sách tin nhắn — ListHeaderComponent QuickQuestions */}
      <div ref={flatListRef} style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "14px 14px 20px" }}>
        <QuickQuestions />
        {listData.map((item) => {
          if (item.role === "typing") return renderTyping();
          return renderMessage(item);
        })}
      </div>

      {/* Input bar — giống pattern ChatScreen */}
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "flex-end",
          gap: 8,
          padding: 10,
          background: COLORS.surface,
          borderTop: `1px solid ${COLORS.border}`,
        }}
      >
        <textarea
          className="edc-chat-placeholder"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Nhắn tin cho AI..."
          maxLength={500}
          rows={1}
          style={{
            flex: 1,
            minHeight: 42,
            maxHeight: 110,
            borderRadius: 21,
            background: "#F3F4F6",
            padding: "12px 16px 10px",
            fontSize: 14,
            lineHeight: "20px",
            color: COLORS.textPrimary,
            border: "none",
            outline: "none",
            resize: "none",
            overflowY: "auto",
          }}
        />
        <Touchable
          onPress={() => sendMessage()}
          disabled={!input.trim() || isTyping}
          style={{
            width: 42,
            height: 42,
            borderRadius: 21,
            background: COLORS.primary,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            opacity: !input.trim() || isTyping ? 0.4 : 1,
          }}
        >
          {isTyping ? <Spinner size={20} color="#fff" /> : <Icon name="send" size={20} color="#fff" />}
        </Touchable>
      </div>
    </div>
  );
};

export default WorkerChatbotScreen;
