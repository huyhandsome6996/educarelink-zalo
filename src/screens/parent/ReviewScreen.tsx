/**
 * ReviewScreen — port CHÍNH XÁC mobile/src/screens/Parent/ReviewScreen.js (145 dòng).
 * Đánh giá Carepartner sau ca: 1-5 sao touchable (bounce khi bấm), nhãn mức sao,
 * textarea nhận xét, createReview({ task, rating, comment }) → thành công popToTop.
 * Khác biệt platform (ghi mobile-parity-map.md):
 *  - Animated.sequence/spring sao → CSS transform scale 1→1.3 (transition 150ms = ANIM.timingFast)
 *    rồi trả về 1 (transition 250ms = ANIM.timingNormal).
 *  - Alert.alert("✅ Cảm ơn!", ..., [{ text: 'OK', onPress: popToTop }]) → showAlert()
 *    (window.alert chặn) rồi popToTop; popToTop của RN → nav.switchTab(nav.state.tab)
 *    (reset stack tab hiện tại về root — tương đương về đích đến).
 *  - useSafeAreaInsets → StatusBarSpacer; TextInput multiline → <textarea>.
 *  - FRAGMENTS.inputFocus (border primary 1.5) + SHADOWS.inputFocus port inline.
 */
import React, { useState } from "react";
import Icon from "@/components/Icon";
import { Spinner, StatusBarSpacer, Touchable, showAlert } from "@/components/ui";
import { COLORS, SHADOWS, SIZES, TYPO } from "@/theme";
import { useNav } from "@/navigation/router";
import { createReview } from "@/api/tasks";

/* ── Styles — chuyển 1:1 từ StyleSheet của RN ── */
const ST: Record<string, React.CSSProperties> = {
  container: { flex: 1, background: COLORS.background },
  header: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 16px 16px", // paddingTop: insets.top + 8 → StatusBarSpacer + 8
    background: COLORS.surface,
    borderBottom: `1px solid ${COLORS.border}`,
    boxShadow: SHADOWS.small,
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
  headerTitle: { ...TYPO.h4, color: COLORS.textPrimary, fontWeight: 800 },
  headerSpacer: { width: 40 },

  body: {
    flex: 1,
    padding: SIZES.lg,
    gap: SIZES.md,
    display: "flex",
    flexDirection: "column",
  },
  heroBox: {
    background: COLORS.primaryLight,
    borderRadius: SIZES.radiusLg,
    padding: SIZES.lg,
    alignItems: "center",
    gap: SIZES.sm,
    border: `1.5px solid ${COLORS.primarySoft}`,
    boxShadow: SHADOWS.small,
    display: "flex",
    flexDirection: "column",
  },
  heroEmoji: { fontSize: "48px" },
  heroTitle: { ...TYPO.h2, color: COLORS.primaryDark },
  heroSub: { ...TYPO.body, color: COLORS.primary },
  label: { ...TYPO.overline, color: COLORS.textSecondary },
  starsRow: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "center",
    gap: SIZES.sm,
  },
  ratingLabel: { textAlign: "center", ...TYPO.bodyLarge, color: COLORS.warning, fontWeight: 700 },
  textarea: {
    background: COLORS.surface,
    borderRadius: SIZES.radiusSm,
    border: `1.5px solid ${COLORS.border}`,
    padding: SIZES.md,
    ...TYPO.body,
    color: COLORS.textPrimary,
    minHeight: 120,
    resize: "none",
    outline: "none",
    fontFamily: TYPO.body.fontFamily,
    width: "100%",
  },
  textareaFocused: {
    borderColor: COLORS.primary, // FRAGMENTS.inputFocus
    boxShadow: SHADOWS.inputFocus,
  },
  submitBtn: {
    background: COLORS.primary,
    borderRadius: SIZES.radiusMd,
    height: 54,
    display: "flex",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    boxShadow: SHADOWS.large,
    marginTop: SIZES.sm,
  },
  submitText: { color: COLORS.textOnPrimary, ...TYPO.button },
};

const RATING_LABELS = ["", "Rất tệ", "Tệ", "Ổn", "Tốt", "Xuất sắc"];

const ReviewScreen: React.FC<{ taskId?: string | number; revieweeId?: string | number }> = ({
  taskId,
  revieweeId,
}) => {
  const navigation = useNav();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [commentFocused, setCommentFocused] = useState(false);
  // Animated scale cho hiệu ứng nhấn sao (RN Animated → CSS transition)
  const [starScales, setStarScales] = useState<number[]>([1, 1, 1, 1, 1]);

  const handleStarPress = (star: number) => {
    setRating(star);
    // Scale bounce effect trên sao vừa bấm: 1 → 1.3 (150ms) → 1 (250ms spring-ish)
    setStarScales((prev) => {
      const next = [...prev];
      next[star - 1] = 1.3;
      return next;
    });
    window.setTimeout(() => {
      setStarScales((prev) => {
        const next = [...prev];
        next[star - 1] = 1;
        return next;
      });
    }, 150);
  };

  const handleSubmit = async () => {
    if (!comment.trim()) {
      showAlert("Thiếu thông tin", "Vui lòng để lại nhận xét của bạn.");
      return;
    }
    setIsLoading(true);
    try {
      await createReview({ task: taskId, rating, comment });
      // RN: Alert OK → navigation.popToTop(); window.alert chặn tới khi bấm OK
      showAlert("✅ Cảm ơn!", "Đánh giá của bạn đã được ghi nhận.");
      navigation.switchTab(navigation.state.tab); // popToTop — về root stack hiện tại
    } catch (e: any) {
      const data = e.response?.data;
      // Lấy lỗi chi tiết từ backend
      let msg = "Gửi đánh giá thất bại.";
      if (data) {
        if (typeof data === "string") {
          msg = data;
        } else if (data.detail) {
          msg = data.detail;
        } else if (data.task) {
          msg = Array.isArray(data.task) ? data.task[0] : data.task;
        } else if (data.rating) {
          msg = Array.isArray(data.rating) ? data.rating[0] : data.rating;
        } else if (data.comment) {
          msg = Array.isArray(data.comment) ? data.comment[0] : data.comment;
        } else if (data.error) {
          msg = data.error;
        }
      }
      showAlert("Lỗi", msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ ...ST.container, minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <style>{`.edc-review-textarea::placeholder{color:${COLORS.textMuted};opacity:1}`}</style>

      {/* Header */}
      <StatusBarSpacer />
      <div style={ST.header}>
        <Touchable onPress={() => navigation.goBack()} style={ST.backBtn} activeOpacity={0.7}>
          <Icon name="close" size={22} color={COLORS.textSecondary} />
        </Touchable>
        <div style={ST.headerTitle}>Đánh giá Carepartner</div>
        <div style={ST.headerSpacer} />
      </div>

      <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        <div style={ST.body}>
          <div style={ST.heroBox}>
            <span style={ST.heroEmoji}>⭐</span>
            <span style={ST.heroTitle}>Công việc hoàn thành!</span>
            <span style={ST.heroSub}>Hãy đánh giá trải nghiệm của bạn</span>
          </div>

          {/* Rating stars */}
          <div style={ST.label}>Đánh giá sao</div>
          <div style={ST.starsRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Touchable key={star} onPress={() => handleStarPress(star)} activeOpacity={0.7}>
                <div
                  style={{
                    transform: `scale(${starScales[star - 1]})`,
                    transition: "transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)", // Animated.spring
                  }}
                >
                  <Icon
                    name={star <= rating ? "star" : "star-outline"}
                    size={40}
                    color={star <= rating ? COLORS.warning : COLORS.border}
                  />
                </div>
              </Touchable>
            ))}
          </div>
          <div style={ST.ratingLabel}>{RATING_LABELS[rating]}</div>

          {/* Comment */}
          <div style={ST.label}>Nhận xét của bạn</div>
          <textarea
            className="edc-review-textarea"
            style={{ ...ST.textarea, ...(commentFocused ? ST.textareaFocused : {}) }}
            placeholder="Chia sẻ trải nghiệm thực tế của bạn về Carepartner này..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            onFocus={() => setCommentFocused(true)}
            onBlur={() => setCommentFocused(false)}
          />

          <Touchable
            style={{ ...ST.submitBtn, ...(isLoading ? { opacity: 0.7 } : {}) }}
            onPress={handleSubmit}
            disabled={isLoading}
            activeOpacity={0.85}
          >
            {isLoading ? (
              <Spinner color="#fff" />
            ) : (
              <>
                <Icon name="send" size={18} color="#fff" />
                <span style={ST.submitText}>Gửi đánh giá</span>
              </>
            )}
          </Touchable>
        </div>
      </div>

      {/* revieweeId — RN cũng đọc từ params nhưng không dùng trong body (parity) */}
    </div>
  );
};

export default ReviewScreen;
