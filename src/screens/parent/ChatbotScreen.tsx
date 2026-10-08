/**
 * ChatbotScreen — port CHÍNH XÁC mobile/src/screens/ChatbotScreen.js (483 dòng).
 * Tab GIỮA của Parent: chat với AI trợ lý Educarelink.
 * - Nền COLORS.background; header trắng: avatar tròn 44 primaryLight + Icon
 *   sparkles 22 cam + "AI Trợ lý Educarelink" (TYPO.h5/700) + dot xanh 7×7
 *   "Đang hoạt động" (TYPO.caption success/600).
 * - Bubble user cam borderBottomRightRadius 4 text trắng 14/20; bubble bot
 *   trắng viền COLORS.border borderBottomLeftRadius 4; bot render markdown-lite
 *   qua FormattedText port tại chỗ (bold **, italic *, bullet •/-/*, numbered
 *   "1.", heading ###, dòng trống) — text thuần, KHÔNG innerHTML (an toàn XSS).
 * - Job card AI (luồng ghép cặp 2026-09-27): badge loại việc (tutoring book
 *   #F26522 / childcare happy #8B5CF6 / pickup car #2DB84B), giá /giờ, radar
 *   text theo total_matched, preview top 3, CTA "Xem ứng viên đề xuất" ->
 *   CandidatesList; biến thể needsReview (status != ai_parsed) nền warningBg
 *   + CTA "Xem trong Việc của tôi" -> tab MyTasks.
 * - Typing bubble 3 dot nhảy: CSS keyframes edc-typing (app.css) delay
 *   0/0.15s/0.3s — tương đương Animated.sequence 300ms lên/xuống RN.
 * - API sendChatMessage(text, history) (timeout 60s); history đệm 20 tin;
 *   lỗi đọc e.response.data.response || e.response.data.error.
 * Khác platform (mobile-parity-map.md):
 * - Không KeyboardAvoidingView (web Zalo webview tự đẩy viewport); layout cao
 *   cố định calc(100dvh - TabBar 84) — FlatList -> div scroll, scrollToEnd =
 *   scrollTop = scrollHeight sau 100ms (như RN setTimeout 100).
 * - RN ChatbotScreen KHÔNG có quick replies chips (chỉ welcome message) —
 *   chips chỉ tồn tại ở WorkerChatbotScreen, giữ nguyên như RN.
 */
import React, { useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon";
import { Spinner, StatusBarSpacer, Touchable } from "@/components/ui";
import { COLORS, TYPO, SHADOWS, TAB_BAR_HEIGHT } from "@/theme";
import { useNav } from "@/navigation/router";
import { sendChatMessage } from "@/api/tasks";

const JOB_TYPE_META: Record<string, { label: string; icon: string; color: string }> = {
  tutoring: { label: "Gia sư", icon: "book", color: "#F26522" },
  childcare: { label: "Đồng hành cùng trẻ", icon: "happy", color: "#8B5CF6" },
  pickup: { label: "Đón trẻ", icon: "car", color: "#2DB84B" },
};

interface CandidatePreview {
  display_name?: string;
  school?: string;
  rating?: number | string;
  distance_km?: number | string;
}

interface JobData {
  id?: number | string;
  job_type?: string;
  hourly_rate_vnd?: number | string;
  title?: string;
  schedule?: string;
  location_note?: string;
  status?: string;
  status_label_vi?: string;
  total_matched?: number;
  candidates_preview?: CandidatePreview[];
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "typing";
  text: string;
  job?: JobData;
}

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: "welcome",
    role: "assistant",
    text: '👋 Xin chào! Tôi là trợ lý AI của Educarelink.\n\nBạn chỉ cần mô tả nhu cầu, ví dụ:\n• "Tôi cần tìm gia sư Toán lớp 5 vào tối thứ 3 ở Quận 1"\n• "Cần người đón bé lúc 11h sáng"\n\nTôi sẽ hỏi nhanh vài câu rồi tạo tin đăng và quét ngay 8 Carepartner phù hợp nhất cho bạn! 🚀',
  },
];

/* ---------------- FormattedText — port mobile/src/components/FormattedText.js ---------------- */
const FormattedText: React.FC<{ text: string; baseColor?: string }> = ({ text, baseColor }) => {
  if (!text) return null;

  const textColor = baseColor || COLORS.textPrimary;
  const base: React.CSSProperties = { fontSize: 14, lineHeight: "20px", color: textColor };
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
              <span style={{ ...base, fontWeight: 700, minWidth: 14 }}>•</span>
              <span style={{ ...base, flex: 1 }}>{renderInline(content, `b-${idx}`)}</span>
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
              <span style={{ ...base, fontWeight: 700, minWidth: 14 }}>{numMatch[1]}.</span>
              <span style={{ ...base, flex: 1 }}>{renderInline(numMatch[2], `n-${idx}`)}</span>
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

const ChatbotScreen: React.FC = () => {
  const nav = useNav();
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const flatListRef = useRef<HTMLDivElement | null>(null);
  const chatHistoryRef = useRef<{ role: string; text: string }[]>([]);

  /** RN scrollToEnd — try/catch vì list có thể chưa đo xong layout; cuộn là phụ */
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

  const sendMessage = async () => {
    const text = input.trim();
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

      const res: any = await sendChatMessage(text, historyForAPI);
      const botText = res?.response || "AI đang được tích hợp. Vui lòng thử lại sau!";
      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        text: botText,
      };
      // 2026-09-27: AI đăng việc hộ theo luồng ghép cặp mới — kèm JobPost
      if (res?.job && res.job.id) {
        botMsg.job = res.job;
      } else if (res?.task) {
        // LEGACY — server không còn trả task cũ
        botMsg.text += `\n\n📋 Công việc đã tạo:\n• ${res.task.title}`;
      }

      chatHistoryRef.current.push({ role: "assistant", text: botText });
      if (chatHistoryRef.current.length > 20) {
        chatHistoryRef.current = chatHistoryRef.current.slice(-20);
      }

      setMessages((prev) => [...prev, botMsg]);
    } catch (e: any) {
      // chatbot-fix-3: backend soạn sẵn message thân thiện (vd 503 quota /
      // high-demand) — không nuốt nữa.
      const errMsg =
        e?.response?.data?.response ||
        e?.response?.data?.error ||
        "❌ Lỗi kết nối. Vui lòng kiểm tra lại kết nối mạng.";
      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: "assistant", text: errMsg },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  /* ---------------- Job Card (luồng ghép cặp mới — 2026-09-27) ---------------- */
  const renderJobCard = (job: JobData) => {
    const meta = JOB_TYPE_META[job.job_type || ""] || JOB_TYPE_META.tutoring;
    const price = job.hourly_rate_vnd
      ? `${parseInt(String(job.hourly_rate_vnd)).toLocaleString("vi-VN")}đ/giờ`
      : "";
    // chatbot-fix-3: publish-fail (ai_failed / needs_admin_review) → biến thể
    // cảnh báo thay vì radar + CTA ứng viên (job chưa vào radar được).
    const needsReview = !!job.status && job.status !== "ai_parsed";
    const preview =
      !needsReview && Array.isArray(job.candidates_preview) ? job.candidates_preview.slice(0, 3) : [];

    // Radar text theo total_matched (hợp đồng backend 2026-09-27)
    let radarText = "AI đang quét Carepartner phù hợp nhất…";
    if (typeof job.total_matched === "number" && job.total_matched > 0) {
      radarText = `🎉 AI đã quét thấy ${job.total_matched} CarePartner phù hợp!`;
    } else if (job.total_matched === 0) {
      radarText = "Chưa có CarePartner nào khớp ca này — hệ thống tiếp tục quét...";
    }

    return (
      <div
        style={{
          borderRadius: 14,
          border: `2px solid ${needsReview ? `${COLORS.warning}66` : `${meta.color}55`}`,
          background: needsReview ? COLORS.warningBg : COLORS.surface,
          padding: 12,
        }}
      >
        {/* Header: badge loại việc + giá */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 8,
          }}
        >
          <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 7 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: `${meta.color}1A`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name={meta.icon} size={16} color={meta.color} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.5, color: COLORS.textSecondary }}>
              {meta.label.toUpperCase()}
            </span>
          </div>
          {price ? <span style={{ fontSize: 15, fontWeight: 800, color: COLORS.primary }}>{price}</span> : null}
        </div>

        {/* Tiêu đề + lịch + địa điểm */}
        <div
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: COLORS.textPrimary,
            lineHeight: "20px",
            marginBottom: 6,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {job.title || "Tin đăng mới"}
        </div>
        <div style={{ display: "flex", flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {job.schedule ? (
            <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 1 }}>
              <Icon name="time-outline" size={13} color={COLORS.textMuted} />
              <span style={{ fontSize: 12, color: COLORS.textMuted }}>{job.schedule}</span>
            </div>
          ) : null}
          {job.location_note ? (
            <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 1 }}>
              <Icon name="location-outline" size={13} color={COLORS.textMuted} />
              <span
                style={{
                  fontSize: 12,
                  color: COLORS.textMuted,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {job.location_note}
              </span>
            </div>
          ) : null}
        </div>

        {needsReview ? (
          <>
            {/* Cảnh báo publish-fail — nền vàng nhạt + icon ⚠️ */}
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "flex-start",
                gap: 8,
                background: COLORS.warningBg,
                borderRadius: 10,
                padding: "9px 10px",
                marginTop: 10,
              }}
            >
              <span style={{ fontSize: 16, lineHeight: "20px" }}>⚠️</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: COLORS.textPrimary, marginBottom: 2 }}>
                  {job.status_label_vi || "Tin đăng đang được xử lý lại"}
                </div>
                <div style={{ fontSize: 12, color: COLORS.textSecondary, lineHeight: "17px" }}>
                  Đang xử lý lại tin đăng — theo dõi trong mục Việc của tôi
                </div>
              </div>
            </div>
            {/* CTA duy nhất — không radar, không CTA ứng viên */}
            <Touchable
              onPress={() => {
                // Registry AppNavigator: tab 'MyTasks' → stack 'MyTasksMain'
                nav.navigate("MyTasks");
              }}
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 7,
                borderRadius: 12,
                padding: "11px 0",
                marginTop: 10,
                background: COLORS.warning,
              }}
            >
              <Icon name="briefcase-outline" size={17} color="#fff" />
              <span style={{ color: "#fff", fontSize: 14, fontWeight: 700 }}>Xem trong Việc của tôi</span>
            </Touchable>
          </>
        ) : (
          <>
            {/* Radar pulse */}
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                borderRadius: 10,
                padding: "8px 10px",
                marginTop: 10,
                background: `${meta.color}0D`,
              }}
            >
              <div style={{ width: 9, height: 9, borderRadius: 5, background: meta.color, flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: meta.color, flexShrink: 1 }}>{radarText}</span>
            </div>
            {/* Preview ứng viên (top 3 — hợp đồng candidates_preview) */}
            {preview.length > 0 ? (
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 3 }}>
                {preview.map((c, idx) => (
                  <div
                    key={idx}
                    style={{
                      fontSize: 12,
                      color: COLORS.textSecondary,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {`• ${c.display_name} · ${c.school} · ★${c.rating} · ${c.distance_km}km`}
                  </div>
                ))}
              </div>
            ) : null}
            {/* CTA — sang radar ứng viên */}
            <Touchable
              onPress={() => {
                // ChatbotScreen là tab trung tâm → sang CandidatesList (RN: nested
                // navigate ParentHome/CandidatesList; router web push trong stack)
                nav.navigate("CandidatesList", { jobId: job.id });
              }}
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 7,
                borderRadius: 12,
                padding: "11px 0",
                marginTop: 10,
                background: COLORS.primary,
              }}
            >
              {/* RN Ionicons 'radar' — Icon.tsx alias sang glyph pulse */}
              <Icon name="radar" size={17} color="#fff" />
              <span style={{ color: "#fff", fontSize: 14, fontWeight: 700 }}>Xem ứng viên đề xuất</span>
            </Touchable>
          </>
        )}
      </div>
    );
  };

  const renderMessage = (item: ChatMessage) => {
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
            <div>
              <FormattedText text={item.text} baseColor={COLORS.textPrimary} />
              {/* 2026-09-27: Job Card luồng ghép cặp mới */}
              {item.job ? <div style={{ marginTop: 10 }}>{renderJobCard(item.job)}</div> : null}
            </div>
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

  // Data cho FlatList = messages + typing indicator
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
            <div style={{ ...TYPO.h5, color: COLORS.textPrimary, fontWeight: 700 }}>AI Trợ lý Educarelink</div>
            <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 4 }}>
              <div style={{ width: 7, height: 7, borderRadius: 4, background: COLORS.success }} />
              <div style={{ ...TYPO.caption, color: COLORS.success, fontWeight: 600 }}>Đang hoạt động</div>
            </div>
          </div>
        </div>
      </div>

      {/* Danh sách tin nhắn */}
      <div ref={flatListRef} style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "14px 14px 20px" }}>
        {listData.map((item) => {
          if (item.role === "typing") return renderTyping();
          return renderMessage(item);
        })}
      </div>

      {/* Input bar */}
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
          onPress={sendMessage}
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

export default ChatbotScreen;
