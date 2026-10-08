/**
 * CareDiaryDetailScreen — port CHÍNH XÁC mobile/src/screens/Parent/CareDiaryDetailScreen.js (414 dòng)
 * + 2 component RN đi kèm được port TẠI CHỖ (files thuộc agent khác, không được tạo/sửa):
 *   - mobile/src/components/TutoringAssessmentCard.js (132 dòng) → TutoringAssessmentCard
 *   - mobile/src/components/ChildcareAssessmentCard.js (146 dòng) → ChildcareAssessmentCard
 *
 * Params: { taskId, taskTitle }. Dữ liệu: getCareDiaryEntry(taskId) — /tasks/<id>/care-diary/
 * (zalo api trả data trực tiếp; RN đọc res.data). 404 → "CarePartner chưa ghi nhật ký cho buổi này."
 *
 * Attachments: <img src={att.url}> TRỰC TIẾP — backend build_absolute_uri (/media/ public,
 * Render force https) nên không cần blob-auth (khác ảnh verification).
 * Tap ảnh → RN navigate('ImagePreview', {uri, title}) — route ImagePreview do agent khác sở hữu
 * (còn stub) → port thành OVERLAY xem ảnh ngay trong màn, style y ImagePreviewScreen RN
 * (nền #000, header close + title, ảnh contain).
 *
 * PLATFORM ADAPTATION (ghi mobile-parity-map.md):
 * - ScrollView → Screen scroll; FlatList/Animated fade → CSS transition; StatusBar → StatusBarSpacer.
 * - paddingTop app bar: RN `insets.top + 32` → StatusBarSpacer + paddingTop 32.
 * - Icon thiếu trong bộ 159 glyph → fallback gần nghĩa cục bộ (ic()):
 *   sad→sad-outline, ellipse→radio-outline, book-outline→book.
 */
import React, { useState, useRef, useEffect } from "react";
import Icon from "@/components/Icon";
import { Spinner, StatusBarSpacer, Touchable } from "@/components/ui";
import { COLORS, SHADOWS, TYPO, ANIM } from "@/theme";
import { useNav } from "@/navigation/router";
import { getCareDiaryEntry } from "@/api/misc";

const STATUS_STYLE: Record<string, { icon: string; color: string; border: string; label: string }> = {
  done: { icon: "checkmark", color: COLORS.secondary, border: COLORS.secondary, label: "Hoàn thành" },
  partial: { icon: "ellipse", color: COLORS.primary, border: COLORS.primary, label: "Một phần" },
  skipped: { icon: "close", color: COLORS.onSurfaceVariant, border: COLORS.outline, label: "Bỏ qua" },
};

// mood canonical (backend chuẩn hoá) → glyph Ionicons. 'neutral'/'excited'
// là từ vựng của form WEB — Ionicons không có 2 tên này → map sang glyph
// gần nghĩa, tránh icon trống khi phụ huynh xem nhật ký ghi từ web.
const MOOD_IONICON: Record<string, string> = {
  happy: "happy",
  neutral: "thumbs-up",
  sad: "sad",
  excited: "happy",
  "alert-circle": "alert-circle",
  "thumbs-up": "thumbs-up",
};

/** Glyph thiếu trong ionicons.ts 159 glyph → fallback gần nghĩa (không sửa ionicons.ts) */
const ic = (name: string) =>
  ({
    sad: "sad-outline",
    ellipse: "radio-outline",
    "book-outline": "book",
  } as Record<string, string>)[name] ?? name;

/* ---------------- Types (shape theo care_diary/services.py build_entry_response) ---------------- */
interface DiaryAttachment {
  id: number | string;
  type?: string;
  url?: string | null;
}
interface DiaryActivity {
  time?: string;
  title?: string;
  desc?: string;
  status?: string;
}
interface DiaryEntry {
  id?: number | string;
  assessment_type?: "tutoring" | "childcare" | "general" | string;
  assessment_data?: Record<string, any> | null;
  carepartner?: { name?: string; role?: string; avatarInitial?: string; verified?: boolean };
  date?: string;
  mood?: { icon?: string; label?: string; note?: string | null };
  completion?: {
    percent?: number;
    stats?: Array<{ value: number | string; label: string; color: string }>;
  };
  activities?: DiaryActivity[];
  note?: string | null;
  attachments?: DiaryAttachment[];
}

/* ============================================================
   TutoringAssessmentCard — port tại chỗ từ mobile/src/components/TutoringAssessmentCard.js
   Card học tập (chi tiết nhật ký Gia sư): lesson_content, comprehension
   (sao 1-5, thái độ), classwork_homework, remarks.
   ============================================================ */
const SCORE_LABELS: Record<number, string> = {
  1: "Chưa tiếp thu được",
  2: "Cần hỗ trợ nhiều",
  3: "Tiếp thu ở mức cơ bản",
  4: "Hiểu bài nhanh",
  5: "Tiếp thu xuất sắc",
};

const TutorRow: React.FC<{ icon: string; label: string; value?: string }> = ({ icon, label, value }) => {
  if (!value) return null;
  return (
    <div style={TTS.row}>
      <Icon name={icon} size={15} color={COLORS.primary} style={TTS.rowIcon} />
      <div style={TTS.rowBody}>
        <div style={TTS.rowLabel}>{label}</div>
        <div style={TTS.rowValue}>{value}</div>
      </div>
    </div>
  );
};

const TutoringAssessmentCard: React.FC<{ data?: Record<string, any> | null }> = ({ data }) => {
  const d = data || {};
  const lesson = d.lesson_content || {};
  const comp = d.comprehension || {};
  const classwork = d.classwork_homework || {};
  const remarks = d.remarks || {};
  const score = Number(comp.score) || 0;

  return (
    <div style={TTS.card}>
      <div style={TTS.header}>
        <Icon name="school" size={18} color={COLORS.primary} />
        <div style={TTS.headerTitle}>Đánh giá buổi học</div>
      </div>

      {/* Môn học + chủ đề */}
      <div style={TTS.subjectBox}>
        <div style={TTS.subject}>{lesson.subject || "—"}</div>
        {lesson.topic ? <div style={TTS.topic}>{lesson.topic}</div> : null}
        {(lesson.is_new_knowledge || lesson.is_review) && (
          <div style={TTS.badgeRow}>
            {!!lesson.is_new_knowledge && (
              <div style={{ ...TTS.badge, ...TTS.badgeGreen }}>
                <span style={TTS.badgeTextGreen}>Kiến thức mới</span>
              </div>
            )}
            {!!lesson.is_review && (
              <div style={{ ...TTS.badge, ...TTS.badgeBlue }}>
                <span style={TTS.badgeTextBlue}>Ôn tập</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mức độ tiếp thu — sao + nhãn */}
      <div style={TTS.scoreBox}>
        <div style={TTS.scoreTitle}>Mức độ tiếp thu bài</div>
        <div style={TTS.starRow}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Icon
              key={n}
              name={score >= n ? "star" : "star-outline"}
              size={24}
              color={score >= n ? "#F59E0B" : COLORS.outlineVariant}
              style={TTS.star}
            />
          ))}
        </div>
        <div style={TTS.scoreLabel}>{comp.score_label || SCORE_LABELS[score] || ""}</div>
        {comp.attitude ? <div style={TTS.attitude}>{comp.attitude}</div> : null}
      </div>

      <TutorRow icon="pencil" label="Bài tập trên lớp" value={classwork.classwork_status} />
      <TutorRow icon="home" label="Bài tập về nhà" value={classwork.homework} />
      <TutorRow icon="alert-circle-outline" label="Lỗ hổng kiến thức" value={remarks.knowledge_gap} />
      <TutorRow icon="calendar-outline" label="Kế hoạch buổi tới" value={remarks.next_session_plan} />
    </div>
  );
};

/* ============================================================
   ChildcareAssessmentCard — port tại chỗ từ mobile/src/components/ChildcareAssessmentCard.js
   Card sinh hoạt (chi tiết nhật ký Đồng hành cùng trẻ): meals, nap,
   hygiene_health, activities, notes_for_parents.
   ============================================================ */
const ChildRow: React.FC<{ icon: string; label: string; value?: string }> = ({ icon, label, value }) => {
  if (!value) return null;
  return (
    <div style={CTS.row}>
      <Icon name={icon} size={15} color={COLORS.primary} style={CTS.rowIcon} />
      <div style={CTS.rowBody}>
        <div style={CTS.rowLabel}>{label}</div>
        <div style={CTS.rowValue}>{value}</div>
      </div>
    </div>
  );
};

const ChildcareAssessmentCard: React.FC<{ data?: Record<string, any> | null }> = ({ data }) => {
  const d = data || {};
  const meals = Array.isArray(d.meals) ? d.meals : [];
  const nap = d.nap || {};
  const hygiene = d.hygiene_health || {};
  const activities = d.activities || {};
  const actList = Array.isArray(activities.list) ? activities.list.filter(Boolean) : [];

  const napTime = [nap.start_time, nap.end_time].filter(Boolean).join(" → ");

  return (
    <div style={CTS.card}>
      <div style={CTS.header}>
        <Icon name="heart" size={18} color={COLORS.primary} />
        <div style={CTS.headerTitle}>Sinh hoạt trong buổi đồng hành cùng trẻ</div>
      </div>

      {/* Bữa ăn */}
      {meals.length > 0 && (
        <div style={CTS.subBox}>
          <div style={CTS.subTitle}>
            <Icon name="restaurant" size={13} color={COLORS.primary} /> Bữa ăn
          </div>
          {meals.map((m: any, idx: number) => (
            <div key={idx} style={CTS.mealRow}>
              <div style={CTS.timePill}>
                <span style={CTS.timePillText}>{m.time || "--:--"}</span>
              </div>
              <div style={CTS.mealBody}>
                {m.meal ? <div style={CTS.mealName}>{m.meal}</div> : null}
                {m.amount ? <div style={CTS.mealAmount}>{m.amount}</div> : null}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Giấc ngủ — glyph 'bed' không có trong bộ 159 ionicons → dùng emoji tương đương
          (fallback vòng tròn mờ của Icon.tsx sẽ xấu hơn) */}
      {(napTime || nap.quality) && (
        <div style={CTS.subBox}>
          <div style={CTS.subTitle}>
            <span style={{ fontSize: 13 }}>🛏️</span> Giấc ngủ
          </div>
          {napTime ? <div style={CTS.subValue}>⏰ {napTime}</div> : null}
          {nap.quality ? <div style={CTS.subValue}>{nap.quality}</div> : null}
        </div>
      )}

      {/* medkit-outline / fitness-outline thiếu -outline → bản filled có sẵn trong bộ glyph */}
      <ChildRow icon={ic("medkit-outline")} label="Vệ sinh / đi vệ sinh" value={hygiene.diaper_toilet} />
      <ChildRow icon={ic("fitness-outline")} label="Tình trạng thể chất" value={hygiene.physical_condition} />

      {/* Hoạt động — glyph 'toys' thiếu → fallback 'sparkles' gần nghĩa */}
      {(actList.length > 0 || activities.mood_during) && (
        <div style={CTS.subBox}>
          <div style={CTS.subTitle}>
            <Icon name="sparkles" size={13} color={COLORS.primary} /> Hoạt động
          </div>
          <div style={CTS.activityWrap}>
            {actList.map((a: string, idx: number) => (
              <div key={idx} style={CTS.activityChip}>
                <span style={CTS.activityChipText}>{a}</span>
              </div>
            ))}
          </div>
          {activities.mood_during ? <div style={CTS.subValue}>Tâm trạng: {activities.mood_during}</div> : null}
        </div>
      )}

      {/* Ghi chú cho phụ huynh */}
      {d.notes_for_parents ? (
        <div style={CTS.noteBox}>
          <Icon name="chatbubble-ellipses" size={16} color={COLORS.primary} />
          <div style={CTS.noteText}>{d.notes_for_parents}</div>
        </div>
      ) : null}
    </div>
  );
};

/* ============================================================
   CareDiaryDetailScreen — thân màn (RN exact)
   ============================================================ */
const CareDiaryDetailScreen: React.FC<{ taskId?: string; taskTitle?: string }> = ({ taskId }) => {
  const nav = useNav();
  const [diary, setDiary] = useState<DiaryEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<{ uri: string; title: string } | null>(null);

  // QA-FIX-UI 3.2: fade-in animation khi mount (RN Animated.timing → CSS transition)
  const fadeRef = useRef(false);
  const [faded, setFaded] = useState(false);
  useEffect(() => {
    if (fadeRef.current) return;
    fadeRef.current = true;
    const r = requestAnimationFrame(() => setFaded(true));
    return () => cancelAnimationFrame(r);
  }, []);

  useEffect(() => {
    if (!taskId) {
      setError("Không tìm thấy thông tin công việc.");
      setLoading(false);
      return;
    }
    let mounted = true;
    setLoading(true);
    setError(null);
    // async/await (Promise.prototype.finally không có trong lib es2017 của tsconfig)
    const load = async () => {
      try {
        const res = (await getCareDiaryEntry(taskId)) as DiaryEntry;
        if (mounted) setDiary(res);
      } catch (err: any) {
        if (!mounted) return;
        if (err.response?.status === 404) {
          setError("CarePartner chưa ghi nhật ký cho buổi này.");
        } else {
          const msg = err.response?.data?.error || "Không thể tải nhật ký. Vui lòng thử lại.";
          setError(msg);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [taskId]);

  /* === LOADING STATE === */
  if (loading) {
    return (
      <div
        style={{
          minHeight: "100dvh",
          background: COLORS.surfaceContainerLow,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 12,
        }}
      >
        <Spinner size={30} color={COLORS.primary} />
        <div style={{ ...TYPO.body, color: COLORS.onSurfaceVariant }}>Đang tải nhật ký...</div>
      </div>
    );
  }

  const appBar = (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "32px 12px 12px",
        background: COLORS.surfaceContainerLow,
      }}
    >
      <Touchable onPress={nav.goBack} style={{ width: 44, height: 44, borderRadius: 22, display: "flex", justifyContent: "center", alignItems: "center" }}>
        <Icon name="arrow-back" size={22} color={COLORS.primary} />
      </Touchable>
      <div style={{ ...TYPO.h2, color: COLORS.primary, flex: 1, textAlign: "center", marginRight: 44 }}>Chi tiết nhật ký</div>
      <div style={{ width: 44 }} />
    </div>
  );

  /* === ERROR STATE (bao gồm 404 chưa có nhật ký) === */
  if (error || !diary) {
    return (
      <div style={{ minHeight: "100dvh", background: COLORS.surfaceWarm, display: "flex", flexDirection: "column" }}>
        <StatusBarSpacer />
        {appBar}
        <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", padding: "0 40px", gap: 16 }}>
          <Icon name={ic("book-outline")} size={48} color={COLORS.onSurfaceVariant} />
          <div style={{ ...TYPO.body, color: COLORS.onSurfaceVariant, textAlign: "center", lineHeight: "22px" }}>{error || "Không có dữ liệu."}</div>
        </div>
      </div>
    );
  }

  /* === RENDER DIARY === */
  return (
    <div
      style={{
        minHeight: "100dvh",
        background: COLORS.surfaceWarm,
        opacity: faded ? 1 : 0,
        transition: `opacity ${ANIM.timingNormal}ms`,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <StatusBarSpacer />
      {appBar}

      <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
        <div style={{ padding: "24px 20px 40px", display: "flex", flexDirection: "column", gap: 24 }}>
          {/* CarePartner info card */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              background: COLORS.surfaceContainer,
              borderRadius: 20,
              padding: 16,
              border: `1px solid ${COLORS.outlineVariant}`,
              boxShadow: SHADOWS.small,
            }}
          >
            <div style={{ position: "relative" }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  background: COLORS.primary,
                  border: `2px solid ${COLORS.primary}`,
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <span style={{ ...TYPO.h2, color: COLORS.textOnPrimary }}>{diary.carepartner?.avatarInitial || "C"}</span>
              </div>
              {diary.carepartner?.verified && (
                <div
                  style={{
                    position: "absolute",
                    bottom: -2,
                    right: -2,
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    background: COLORS.secondaryContainer,
                    border: `2px solid ${COLORS.surface}`,
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <Icon name="shield-checkmark" size={12} color={COLORS.onSecondaryContainer} />
                </div>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ ...TYPO.h3, color: COLORS.onSurface, marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {diary.carepartner?.name || "CarePartner"}
              </div>
              <div style={{ ...TYPO.caption, color: COLORS.secondaryDark, fontWeight: 700 }}>{diary.carepartner?.role || "CarePartner"}</div>
              <div style={{ ...TYPO.body, fontSize: 13, color: COLORS.onSurfaceVariant, marginTop: 2 }}>{diary.date}</div>
            </div>
          </div>

          {/* Bento grid: Mood + Completion */}
          <div style={{ display: "flex", gap: 12 }}>
            {/* Mood card */}
            <div
              style={{
                flex: 1,
                background: COLORS.surface,
                borderRadius: 20,
                padding: 16,
                border: `1px solid ${COLORS.outlineVariant}`,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
                boxShadow: SHADOWS.small,
              }}
            >
              <div style={{ ...TYPO.h4, color: COLORS.onSurface, marginBottom: 12, alignSelf: "flex-start" }}>Tâm trạng của bé</div>
              <div
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  background: COLORS.surfaceContainerHigh,
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  marginBottom: 4,
                }}
              >
                <Icon name={MOOD_IONICON[diary.mood?.icon || ""] || "happy"} size={48} color={COLORS.primary} />
              </div>
              <div style={{ ...TYPO.h3, color: COLORS.primary, textAlign: "center" }}>{diary.mood?.label}</div>
              {diary.mood?.note ? (
                <div style={{ ...TYPO.caption, color: COLORS.onSurfaceVariant, textAlign: "center", lineHeight: "16px" }}>{diary.mood.note}</div>
              ) : null}
            </div>

            {/* Completion card */}
            <div
              style={{
                flex: 1,
                background: COLORS.surface,
                borderRadius: 20,
                padding: 16,
                border: `1px solid ${COLORS.outlineVariant}`,
                boxShadow: SHADOWS.small,
              }}
            >
              <div style={{ ...TYPO.h4, color: COLORS.onSurface, marginBottom: 12, alignSelf: "flex-start" }}>Mức độ hoàn thành</div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 8, marginBottom: 8 }}>
                <span style={{ ...TYPO.h1, color: COLORS.secondary, fontSize: 32, lineHeight: "38px" }}>{diary.completion?.percent ?? 0}%</span>
                <span style={{ ...TYPO.body, fontSize: 12, color: COLORS.onSurfaceVariant, paddingBottom: 4 }}>Mục tiêu ngày</span>
              </div>
              <div
                style={{
                  width: "100%",
                  height: 14,
                  background: COLORS.surfaceContainerHigh,
                  borderRadius: 7,
                  overflow: "hidden",
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    height: "100%",
                    background: COLORS.secondaryContainer,
                    borderRadius: 7,
                    width: `${Math.min(100, Math.max(0, diary.completion?.percent ?? 0))}%`,
                  }}
                />
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                {(diary.completion?.stats || []).map((stat, idx) => (
                  <div
                    key={idx}
                    style={{
                      flex: 1,
                      background: COLORS.surfaceContainerLow,
                      borderRadius: 8,
                      padding: 6,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      border: `1px solid ${COLORS.outlineVariant}`,
                    }}
                  >
                    <span style={{ ...TYPO.h4, fontWeight: 900, color: stat.color, lineHeight: "22px" }}>{stat.value}</span>
                    <span style={{ fontSize: 9, color: COLORS.onSurfaceVariant, textAlign: "center", marginTop: 2 }}>{stat.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* CARE DIARY NÂNG CẤP — card chuyên sâu theo assessment_type.
              tutoring → Card học tập; childcare → Card sinh hoạt;
              general → giữ nguyên hiển thị cũ (timeline hoạt động). */}
          {diary.assessment_type === "tutoring" && !!diary.assessment_data && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <TutoringAssessmentCard data={diary.assessment_data} />
            </div>
          )}
          {diary.assessment_type === "childcare" && !!diary.assessment_data && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <ChildcareAssessmentCard data={diary.assessment_data} />
            </div>
          )}

          {/* Activities timeline */}
          {diary.activities && diary.activities.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ ...TYPO.h4, color: COLORS.onSurface }}>Hoạt động đã thực hiện</div>
              <div>
                {diary.activities.map((act, idx) => {
                  const st = STATUS_STYLE[act.status || ""] || STATUS_STYLE.done;
                  return (
                    <div key={idx} style={{ display: "flex", gap: 12 }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 32 }}>
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 16,
                            background: COLORS.surface,
                            border: `2px solid ${st.border}`,
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                            boxShadow: SHADOWS.small,
                            flexShrink: 0,
                          }}
                        >
                          <Icon name={st.icon} size={14} color={st.color} />
                        </div>
                        {idx < diary.activities!.length - 1 && (
                          <div style={{ width: 2, flex: 1, background: COLORS.outlineVariant, marginTop: 4, marginBottom: 4, minHeight: 24 }} />
                        )}
                      </div>
                      <div
                        style={{
                          flex: 1,
                          background: COLORS.surface,
                          borderRadius: 14,
                          padding: 12,
                          border: `1px solid ${COLORS.outlineVariant}`,
                          marginBottom: 12,
                          minWidth: 0,
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                          <span style={{ ...TYPO.caption, color: COLORS.primary, fontWeight: 700 }}>{act.time}</span>
                          <span
                            style={{
                              padding: "2px 8px",
                              borderRadius: 999,
                              background: `${st.color}20`,
                              fontSize: 10,
                              fontWeight: 700,
                              textTransform: "uppercase",
                              color: st.color,
                            }}
                          >
                            {st.label}
                          </span>
                        </div>
                        <div style={{ ...TYPO.h4, color: COLORS.onSurface, fontSize: 15, marginBottom: 4 }}>{act.title}</div>
                        {act.desc ? <div style={{ ...TYPO.body, fontSize: 13, color: COLORS.onSurfaceVariant, lineHeight: "18px" }}>{act.desc}</div> : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Note section */}
          {diary.note ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ ...TYPO.h4, color: COLORS.onSurface }}>Ghi chú thêm</div>
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  background: COLORS.primaryLight,
                  borderRadius: 14,
                  padding: 14,
                  border: `1px solid ${COLORS.primarySoft}`,
                }}
              >
                <Icon name="chatbubble-ellipses" size={18} color={COLORS.primary} style={{ marginTop: 2, flexShrink: 0 }} />
                <div style={{ flex: 1, ...TYPO.body, fontSize: 14, color: COLORS.onSurface, lineHeight: "22px", fontStyle: "italic" }}>{diary.note}</div>
              </div>
            </div>
          ) : null}

          {/* Attachments — <img> trực tiếp (/media/ public, backend trả absolute URL) */}
          {diary.attachments && diary.attachments.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ ...TYPO.h4, color: COLORS.onSurface }}>Ảnh đính kèm ({diary.attachments.length})</div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {diary.attachments.map((att) => (
                  <Touchable
                    key={String(att.id)}
                    onPress={() => {
                      if (att.url) {
                        // RN: navigation.navigate('ImagePreview', { uri: att.url, ... })
                        setPhotoPreview({ uri: att.url, title: "Ảnh đính kèm nhật ký" });
                      }
                    }}
                    style={{
                      width: 100,
                      height: 100,
                      borderRadius: 14,
                      overflow: "hidden",
                      boxShadow: SHADOWS.small,
                      background: COLORS.surfaceContainerLow,
                      flexShrink: 0,
                    }}
                  >
                    <img src={att.url || ""} alt="Ảnh đính kèm" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  </Touchable>
                ))}
              </div>
            </div>
          )}

          <div style={{ height: 60 }} />
        </div>
      </div>

      {/* === IMAGE PREVIEW OVERLAY (RN navigate('ImagePreview') — port thành overlay tại chỗ) === */}
      {photoPreview && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "#000", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "44px 16px 12px", background: "rgba(0,0,0,0.8)" }}>
            <Touchable onPress={() => setPhotoPreview(null)} style={{ padding: 4 }}>
              <Icon name="close" size={24} color="#fff" />
            </Touchable>
            <span style={{ ...TYPO.h5, color: "#fff", fontWeight: 700, flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {photoPreview.title}
            </span>
          </div>
          <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", padding: 12 }}>
            <img src={photoPreview.uri} alt={photoPreview.title} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
          </div>
        </div>
      )}
    </div>
  );
};

/* ============ Stylesheet TutoringAssessmentCard (1:1 với RN) ============ */
const TTS: Record<string, React.CSSProperties> = {
  card: {
    background: COLORS.surface,
    borderRadius: 20,
    padding: 16,
    border: `1px solid ${COLORS.outlineVariant}`,
    display: "flex",
    flexDirection: "column",
    gap: 12,
    boxShadow: SHADOWS.small,
  },
  header: { display: "flex", alignItems: "center", gap: 8 },
  headerTitle: { ...TYPO.h4, color: COLORS.onSurface, flex: 1 },
  subjectBox: {
    background: COLORS.primaryLight,
    borderRadius: 14,
    padding: 12,
    border: `1px solid ${COLORS.primarySoft}`,
  },
  subject: { ...TYPO.h3, color: COLORS.primary },
  topic: { ...TYPO.bodySmall, color: COLORS.onSurface, marginTop: 2 },
  badgeRow: { display: "flex", gap: 8, marginTop: 8 },
  badge: { padding: "3px 10px", borderRadius: 999 },
  badgeGreen: { background: "#DCFCE7" },
  badgeBlue: { background: "#DBEAFE" },
  badgeTextGreen: { fontSize: 11, fontWeight: 700, color: "#15803D" },
  badgeTextBlue: { fontSize: 11, fontWeight: 700, color: "#1D4ED8" },
  scoreBox: {
    background: COLORS.surfaceContainerLow,
    borderRadius: 14,
    padding: 12,
    border: `1px solid ${COLORS.outlineVariant}`,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
  },
  scoreTitle: { ...TYPO.caption, color: COLORS.onSurfaceVariant, fontWeight: 700 },
  starRow: { display: "flex" },
  star: { margin: "0 2px" },
  scoreLabel: { ...TYPO.bodySmall, color: "#F59E0B", fontWeight: 800 },
  attitude: { ...TYPO.caption, color: COLORS.onSurfaceVariant, textAlign: "center", fontStyle: "italic" },
  row: { display: "flex", gap: 10 },
  rowIcon: { marginTop: 2, flexShrink: 0 },
  rowBody: { flex: 1, minWidth: 0 },
  rowLabel: { ...TYPO.caption, color: COLORS.onSurfaceVariant, fontWeight: 700 },
  rowValue: { ...TYPO.bodySmall, color: COLORS.onSurface, lineHeight: "19px", marginTop: 1 },
};

/* ============ Stylesheet ChildcareAssessmentCard (1:1 với RN) ============ */
const CTS: Record<string, React.CSSProperties> = {
  card: {
    background: COLORS.surface,
    borderRadius: 20,
    padding: 16,
    border: `1px solid ${COLORS.outlineVariant}`,
    display: "flex",
    flexDirection: "column",
    gap: 12,
    boxShadow: SHADOWS.small,
  },
  header: { display: "flex", alignItems: "center", gap: 8 },
  headerTitle: { ...TYPO.h4, color: COLORS.onSurface, flex: 1 },
  subBox: {
    background: COLORS.surfaceContainerLow,
    borderRadius: 14,
    padding: 12,
    border: `1px solid ${COLORS.outlineVariant}`,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  subTitle: { ...TYPO.caption, color: COLORS.onSurface, fontWeight: 800, display: "flex", alignItems: "center", gap: 4 },
  subValue: { ...TYPO.bodySmall, color: COLORS.onSurface, lineHeight: "19px" },
  mealRow: { display: "flex", alignItems: "center", gap: 10 },
  timePill: {
    padding: "4px 8px",
    borderRadius: 8,
    background: COLORS.primaryLight,
    border: `1px solid ${COLORS.primarySoft}`,
    flexShrink: 0,
  },
  timePillText: { fontSize: 11, fontWeight: 800, color: COLORS.primary },
  mealBody: { flex: 1, minWidth: 0 },
  mealName: { ...TYPO.bodySmall, color: COLORS.onSurface, fontWeight: 700 },
  mealAmount: { ...TYPO.caption, color: COLORS.onSurfaceVariant },
  activityWrap: { display: "flex", flexWrap: "wrap", gap: 6 },
  activityChip: {
    padding: "5px 10px",
    borderRadius: 999,
    background: COLORS.surface,
    border: `1px solid ${COLORS.outlineVariant}`,
  },
  activityChipText: { fontSize: 12, fontWeight: 600, color: COLORS.onSurface },
  noteBox: {
    display: "flex",
    gap: 10,
    background: COLORS.primaryLight,
    borderRadius: 14,
    padding: 12,
    border: `1px solid ${COLORS.primarySoft}`,
  },
  noteText: { flex: 1, ...TYPO.bodySmall, color: COLORS.onSurface, lineHeight: "19px", fontStyle: "italic" },
  row: { display: "flex", gap: 10 },
  rowIcon: { marginTop: 2, flexShrink: 0 },
  rowBody: { flex: 1, minWidth: 0 },
  rowLabel: { ...TYPO.caption, color: COLORS.onSurfaceVariant, fontWeight: 700 },
  rowValue: { ...TYPO.bodySmall, color: COLORS.onSurface, lineHeight: "19px", marginTop: 1 },
};

export default CareDiaryDetailScreen;
