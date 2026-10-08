/**
 * ChatScreen — port CHÍNH XÁC mobile/src/screens/ChatScreen.js (377 dòng).
 * Cửa sổ chat Parent ↔ CarePartner (còn hiệu lực), DÙNG CHUNG cả 2 role —
 * API tự check ownership; currentUserId lấy từ /profile/ để phân bong bóng.
 * - Params: { taskId, taskTitle } (registry spread props từ hash router).
 * - getConversation(taskId): status open/closed + closes_at → badge cửa sổ 24h
 *   ("còn ~X giờ" / "còn ~X phút" / "trong suốt ca làm" / "đã hết hạn" / "Đã khoá").
 * - getMessages(taskId, since) POLL 4s (POLL_INTERVAL_MS) + append + last_id +
 *   markChatRead khi có tin mới; clearInterval khi unmount (pattern B5).
 * - sendMessage(taskId, content): 403 (cửa sổ đóng lazy-close) → Alert "Đã khoá"
 *   + refresh; lỗi khác (kể cả 400 kiểm duyệt nội dung) → Alert "Không gửi được"
 *   đúng message backend e.response.data.error.
 * - Bong bóng: mine cam borderBottomRightRadius 4 text trắng; other trắng
 *   borderBottomLeftRadius 4 text #1F2937; time 10px + " ✓✓" khi đã đọc.
 * - Cửa sổ đóng: banner xám #374151 "Cuộc trò chuyện đã hết hiệu lực — chỉ xem
 *   lại lịch sử" + ẨN composer (quyết định C của spec RN).
 * Khác platform (mobile-parity-map.md):
 * - Không KeyboardAvoidingView; FlatList -> div scroll; TextInput -> textarea.
 * - useFocusEffect -> useEffect mount/unmount (SPA render lại route mỗi lần).
 * - Glyph 'lock-closed' (filled) thiếu trong bộ 159 ionicons -> fallback
 *   'lock-closed-outline' cục bộ.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon";
import { showAlert, Spinner, StatusBarSpacer, Touchable } from "@/components/ui";
import { COLORS, TYPO, SIZES, TAB_BAR_HEIGHT } from "@/theme";
import { useNav } from "@/navigation/router";
import api from "@/api/client";
import { getConversation, getMessages, sendMessage, markChatRead } from "@/api/misc";

const POLL_INTERVAL_MS = 4000;

/** Glyph thiếu trong bộ ionicons.ts 159 glyph (Icon.tsx chưa có alias) — fallback gần nhất */
const ICON_FALLBACKS: Record<string, string> = {
  "lock-closed": "lock-closed-outline",
};
const ic = (name: string) => ICON_FALLBACKS[name] ?? name;

interface ChatMessageItem {
  id: number | string;
  sender_id?: number | string;
  sender_name?: string;
  content: string;
  created_at?: string;
  read_at?: string | null;
}

const ChatScreen: React.FC<{ taskId?: string; taskTitle?: string }> = ({ taskId, taskTitle }) => {
  const nav = useNav();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [conversation, setConversation] = useState<any | null>(null); // detail + window status
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<number | string | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastMessageIdRef = useRef<number | string | null>(null);
  const flatListRef = useRef<HTMLDivElement | null>(null);

  // ── Load current user id (phân bong bóng) ─────────────────────────
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res: any = await api.get("/profile/");
        if (mounted) setCurrentUserId(res?.id ?? null);
      } catch (e) {
        /* bong bóng mặc định bên trái */
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // ── Refresh trạng thái cửa sổ + tin nhắn mới (polling) ────────────
  const refresh = useCallback(async () => {
    if (!taskId) return;
    try {
      const conv: any = await getConversation(taskId);
      setConversation(conv);
      setError(null);

      const msgRes: any = await getMessages(taskId, lastMessageIdRef.current);
      const newMessages: ChatMessageItem[] = msgRes?.messages || [];
      if (newMessages.length) {
        setMessages((prev) => [...prev, ...newMessages]);
        lastMessageIdRef.current = msgRes?.last_id ?? newMessages[newMessages.length - 1].id;
        // Đang mở màn hình chat = đã xem tin mới → mark read
        markChatRead(taskId).catch(() => {});
      }
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 404) {
        setError("Công việc này chưa có cuộc trò chuyện.");
      } else if (status !== 403) {
        // 403 = không phải bên trong hội thoại — hiển thị rõ
        setError(e?.response?.data?.error || "Không tải được cuộc trò chuyện.");
      } else {
        setError(e?.response?.data?.error || "Bạn không có quyền truy cập.");
      }
    }
  }, [taskId]);

  // ── Load lần đầu ──────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      await refresh();
      if (mounted) setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [refresh]);

  // ── Polling 4s — cleanup khi unmount (RN useFocusEffect + pattern B5) ──
  useEffect(() => {
    pollRef.current = setInterval(() => {
      refresh().catch(() => {});
    }, POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [refresh]);

  const scrollToEnd = () => {
    setTimeout(() => {
      try {
        const el = flatListRef.current;
        if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      } catch (e) {
        /* bỏ qua — list chưa đo xong layout */
      }
    }, 100);
  };

  useEffect(() => {
    // RN onContentSizeChange -> scrollToEnd khi có nội dung mới
    if (messages.length) scrollToEnd();
  }, [messages]);

  // ── Gửi tin nhắn ──────────────────────────────────────────────────
  const handleSend = async () => {
    const content = input.trim();
    if (!content || sending || !taskId) return;
    setSending(true);
    try {
      const msg: any = await sendMessage(taskId, content);
      setMessages((prev) => [
        ...prev,
        {
          id: msg.id,
          sender_id: msg.sender_id,
          sender_name: "",
          content: msg.content,
          created_at: msg.created_at,
          read_at: null,
        },
      ]);
      lastMessageIdRef.current = Math.max(Number(lastMessageIdRef.current || 0), Number(msg.id));
      setInput("");
      scrollToEnd();
    } catch (e: any) {
      const status = e?.response?.status;
      const msg = e?.response?.data?.error;
      if (status === 403) {
        // Cửa sổ đóng (lazy-close phát hiện server-side) — refresh trạng thái
        showAlert("Đã khoá", msg || "Cuộc trò chuyện đã hết hiệu lực.");
        refresh().catch(() => {});
      } else {
        // 400 kiểm duyệt nội dung → message backend hiển thị thẳng cho user
        showAlert("Không gửi được", msg || "Vui lòng thử lại.");
      }
    } finally {
      setSending(false);
    }
  };

  // ── Trạng thái cửa sổ chat ────────────────────────────────────────
  const isOpen = conversation?.status === "open";
  const hoursLeftLabel = () => {
    if (!conversation?.closes_at) return "trong suốt ca làm";
    const ms = new Date(conversation.closes_at).getTime() - new Date().getTime();
    if (ms <= 0) return "đã hết hạn";
    const h = Math.floor(ms / 3600000);
    if (h >= 1) return `còn ~${h} giờ`;
    return `còn ~${Math.floor(ms / 60000)} phút`;
  };

  if (loading) {
    return (
      <div
        style={{
          height: `calc(100dvh - ${TAB_BAR_HEIGHT}px)`,
          background: COLORS.surfaceWarm,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          gap: 12,
        }}
      >
        <StatusBarSpacer />
        <Spinner size={36} color={COLORS.primary} />
        <div style={{ ...TYPO.body, color: COLORS.onSurfaceVariant }}>Đang tải cuộc trò chuyện...</div>
      </div>
    );
  }

  if (error && !conversation) {
    return (
      <div
        style={{
          height: `calc(100dvh - ${TAB_BAR_HEIGHT}px)`,
          background: COLORS.surfaceWarm,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          gap: 12,
        }}
      >
        <StatusBarSpacer />
        <Icon name="chatbubble-ellipses-outline" size={56} color={COLORS.textMuted} />
        <div style={{ ...TYPO.body, color: COLORS.error, textAlign: "center" }}>{error}</div>
        <Touchable
          onPress={() => {
            setError(null);
            refresh();
          }}
          style={{
            padding: "10px 24px",
            background: COLORS.primary,
            borderRadius: SIZES.radiusSm,
          }}
        >
          <span style={{ color: "#fff", fontWeight: 700 }}>Thử lại</span>
        </Touchable>
      </div>
    );
  }

  const otherName = conversation?.other_party
    ? conversation.other_party.first_name || conversation.other_party.last_name
      ? `${conversation.other_party.first_name || ""} ${conversation.other_party.last_name || ""}`.trim()
      : conversation.other_party.username
    : "Đối tác";

  return (
    <div
      style={{
        height: `calc(100dvh - ${TAB_BAR_HEIGHT}px)`,
        display: "flex",
        flexDirection: "column",
        background: COLORS.surfaceWarm,
        overflow: "hidden",
      }}
    >
      {/* RN TextInput placeholder màu textMuted — ghi đè màu placeholder mặc định của app.css */}
      <style>{`.edc-chat-placeholder::placeholder{color:${COLORS.textMuted};opacity:1}`}</style>

      {/* Header */}
      <div style={{ background: COLORS.primary }}>
        <StatusBarSpacer />
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            padding: "10px 12px",
          }}
        >
          <Touchable
            onPress={nav.goBack}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              background: "rgba(255,255,255,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Icon name="arrow-back" size={22} color="#fff" />
          </Touchable>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                color: "#fff",
                fontSize: 16,
                fontWeight: 800,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {otherName}
            </div>
            <div
              style={{
                color: "rgba(255,255,255,0.8)",
                fontSize: 11,
                marginTop: 1,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {conversation?.task_title || taskTitle || ""}
            </div>
          </div>
          {/* Badge trạng thái cửa sổ */}
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              padding: "4px 8px",
              borderRadius: 999,
              background: isOpen ? "rgba(16,185,129,0.9)" : "rgba(107,114,128,0.9)",
              flexShrink: 0,
            }}
          >
            <Icon name={isOpen ? "time" : ic("lock-closed")} size={12} color="#fff" />
            <span style={{ color: "#fff", fontSize: 10, fontWeight: 700 }}>
              {isOpen ? hoursLeftLabel() : "Đã khoá"}
            </span>
          </div>
        </div>
      </div>

      {/* Banner read-only khi đóng */}
      {!isOpen && (
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            background: "#374151",
            padding: "8px 12px",
          }}
        >
          <Icon name={ic("lock-closed")} size={14} color="#fff" />
          <span style={{ color: "#fff", fontSize: 11, fontWeight: 600, textAlign: "center" }}>
            Cuộc trò chuyện đã hết hiệu lực — chỉ xem lại lịch sử
          </span>
        </div>
      )}

      {/* Danh sách tin nhắn */}
      <div
        ref={flatListRef}
        style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "14px 14px 20px" }}
      >
        {messages.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "60px 0", gap: 8 }}>
            <Icon name="chatbubbles-outline" size={48} color={COLORS.textMuted} />
            <div style={{ ...TYPO.body, color: COLORS.onSurfaceVariant }}>Chưa có tin nhắn nào.</div>
            <div style={{ fontSize: 12, color: COLORS.textMuted }}>Hãy gửi lời chào đầu tiên!</div>
          </div>
        ) : (
          messages.map((item) => {
            const isMine = item.sender_id === currentUserId;
            return (
              <div
                key={String(item.id)}
                style={{
                  display: "flex",
                  flexDirection: "row",
                  marginBottom: 10,
                  justifyContent: isMine ? "flex-end" : "flex-start",
                }}
              >
                <div
                  style={{
                    maxWidth: "78%",
                    borderRadius: 18,
                    padding: "9px 14px",
                    background: isMine ? COLORS.primary : "#fff",
                    ...(isMine ? { borderBottomRightRadius: 4 } : { borderBottomLeftRadius: 4 }),
                  }}
                >
                  <div
                    style={{
                      fontSize: 14,
                      lineHeight: "20px",
                      color: isMine ? "#fff" : "#1F2937",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {item.content}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: isMine ? "rgba(255,255,255,0.75)" : "#9CA3AF",
                      marginTop: 3,
                      textAlign: "right",
                    }}
                  >
                    {item.created_at
                      ? new Date(item.created_at).toLocaleTimeString("vi-VN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : ""}
                    {isMine && item.read_at ? " ✓✓" : ""}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Composer — ẨN khi cửa sổ đóng (quyết định C của spec RN) */}
      {isOpen ? (
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "flex-end",
            gap: 8,
            padding: 10,
            background: "#fff",
            borderTop: "1px solid #F3F4F6",
          }}
        >
          <textarea
            className="edc-chat-placeholder"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Nhập tin nhắn..."
            maxLength={2000}
            readOnly={sending}
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
              color: "#1F2937",
              border: "none",
              outline: "none",
              resize: "none",
              overflowY: "auto",
            }}
          />
          <Touchable
            onPress={handleSend}
            disabled={!input.trim() || sending}
            style={{
              width: 42,
              height: 42,
              borderRadius: 21,
              background: COLORS.primary,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              opacity: !input.trim() || sending ? 0.4 : 1,
            }}
          >
            {sending ? <Spinner size={20} color="#fff" /> : <Icon name="send" size={20} color="#fff" />}
          </Touchable>
        </div>
      ) : null}
    </div>
  );
};

export default ChatScreen;
