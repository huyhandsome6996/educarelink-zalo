/**
 * CareDiaryFormScreen — port CHÍNH XÁC mobile/src/screens/Worker/CareDiaryFormScreen.js (488 dòng).
 * Worker ghi/sửa nhật ký chăm sóc (B1): POST createCareDiaryEntry / PATCH
 * updateCareDiaryEntry (mood_icon/mood_label/mood_note/completion_percent/note/
 * activities[]/assessment_type/assessment_data) + uploadCareDiaryAttachments
 * (FormData images[]).
 *
 * TutoringAssessmentSection & ChildcareAssessmentSection (screens/Worker/components/)
 * + 2 hàm validate + extractApiError/isDowngradeConfirmError được port NỘI TẠY
 * (nguyên văn logic) vì agent chỉ được phép ghi đúng file màn hình này.
 *
 * Khác biệt platform (ghi mobile-parity-map.md):
 *  - expo-image-picker → <input type="file" accept="image/*" multiple> ẩn;
 *    quality 0.8 / chỉnh ảnh native không có trên web (browser tự quản quyền).
 *  - Upload: web gửi File trực tiếp vào FormData (RN gửi {uri,type,name});
 *    preview ảnh bằng URL.createObjectURL (revoke khi xoá/unmount).
 *  - Alert 1 nút + goBack → showAlert() rồi nav.goBack(); Alert 2 nút
 *    "Giữ nguyên"/"Xoá & lưu" → window.confirm (L2 confirm_clear_assessment).
 *  - KeyboardAvoidingView không cần trên web; textAlignVertical → textarea.
 *  - Icon thiếu glyph → alias cục bộ: sad→sad-outline, image-outline→images-outline,
 *    save-outline→download-outline, book-outline→book, pencil-outline→pencil,
 *    bulb-outline→sparkles, restaurant-outline→restaurant, bed-outline→hourglass-outline,
 *    medkit-outline→medkit, toys-outline→play.
 */
import React, { useState, useEffect } from "react";
import Icon from "@/components/Icon";
import { Spinner, showAlert, StatusBarSpacer, Touchable } from "@/components/ui";
import { COLORS, SHADOWS, TYPO, typo } from "@/theme";
import { useNav } from "@/navigation/router";
import {
  createCareDiaryEntry,
  updateCareDiaryEntry,
  getCareDiaryEntry,
  uploadCareDiaryAttachments,
} from "@/api/misc";
import { getTaskDetail } from "@/api/tasks";

/* ── Alias icon: glyph RN không có trong ionicons.ts zalo → glyph gần nhất ── */
const ICON_ALIAS: Record<string, string> = {
  sad: "sad-outline",
  "image-outline": "images-outline",
  "save-outline": "download-outline",
  "book-outline": "book",
  "pencil-outline": "pencil",
  "bulb-outline": "sparkles",
  "restaurant-outline": "restaurant",
  "bed-outline": "hourglass-outline",
  "medkit-outline": "medkit",
  "toys-outline": "play",
};
const ic = (name: string) => ICON_ALIAS[name] ?? name;

const MOODS = [
  { icon: "happy", label: "Vui vẻ & Hợp tác" },
  { icon: "sad", label: "Buồn & Khóc nhiều" },
  { icon: "alert-circle", label: "Cần chú ý" },
  { icon: "thumbs-up", label: "Bình thường" },
];

const ACTIVITY_STATUSES = [
  { key: "done", label: "Hoàn thành" },
  { key: "partial", label: "Một phần" },
  { key: "skipped", label: "Bỏ qua" },
];

// L2 (QA 2026-09-19) — backend trả lỗi dạng dict field-level của DRF, vd:
//   {'error': '...'}                                            — lỗi chung
//   {'assessment_type': ['Đổi về form chung sẽ xóa...']}         — chặn hạ cấp
//   {'assessment_data': {'meals': ['Cần ít nhất 1 bữa ăn...']}}  — sai dữ liệu
// Gom về 1 chuỗi để Alert hiển thị thông điệp thật thay vì lỗi chung chung.
export const extractApiError = (data: any): string | null => {
  if (!data || typeof data !== "object") return null;
  if (typeof data.error === "string" && data.error.trim()) return data.error;
  const parts: string[] = [];
  const pushStr = (m: any) => {
    if (typeof m === "string" && m.trim()) parts.push(m);
  };
  Object.values(data).forEach((v: any) => {
    if (typeof v === "string") pushStr(v);
    else if (Array.isArray(v)) v.forEach(pushStr);
    else if (v && typeof v === "object")
      Object.values(v).forEach((sub: any) => {
        if (Array.isArray(sub)) sub.forEach(pushStr);
        else pushStr(sub);
      });
  });
  return parts.length ? parts.join("\n") : null;
};

// Nhận diện đúng lỗi chặn hạ cấp của backend (H1): entry đang có dữ liệu
// đánh giá chuyên sâu, đổi về general cần cờ confirm_clear_assessment.
export const isDowngradeConfirmError = (data: any) =>
  !!data &&
  typeof data === "object" &&
  "assessment_type" in data &&
  (extractApiError(data) || "").includes("confirm_clear_assessment");

/* ════════ TutoringAssessmentSection — port nguyên văn components/TutoringAssessmentSection.js ════════ */

const SUBJECTS = ["Toán", "Ngữ văn", "Tiếng Anh", "Vật Lý", "Hóa học", "Sinh học", "Lịch sử", "Địa lí", "Tin học", "Khác"];

const SCORE_LABELS: Record<number, string> = {
  1: "Chưa tiếp thu được",
  2: "Cần hỗ trợ nhiều",
  3: "Tiếp thu ở mức cơ bản",
  4: "Hiểu bài nhanh",
  5: "Tiếp thu xuất sắc",
};

const ATTITUDES = [
  "Rất tập trung, hăng hái",
  "Tập trung, hợp tác tốt",
  "Đôi lúc mất tập trung",
  "Mệt mỏi, ít tương tác",
];

const TutoringAssessmentSection: React.FC<{
  value: Record<string, any>;
  onChange: (next: Record<string, any>) => void;
}> = ({ value, onChange }) => {
  const data = value || {};
  const lesson = data.lesson_content || {};
  const comp = data.comprehension || {};
  const classwork = data.classwork_homework || {};
  const remarks = data.remarks || {};

  // patch(sub, {field: val}) — cập nhật 1 section rồi bắn onChange
  const patch = (section: string, fields: Record<string, any>) =>
    onChange({ ...data, [section]: { ...(data[section] || {}), ...fields } });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* ── Nội dung bài học ── */}
      <div style={{ ...typo("h4"), color: COLORS.onSurface, marginTop: 10, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
        <Icon name={ic("book-outline")} size={15} color={COLORS.primary} /> Nội dung bài học
      </div>
      <div style={{ display: "flex", flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 }}>
        {SUBJECTS.map((s) => (
          <Touchable
            key={s}
            style={{
              padding: "6px 12px",
              borderRadius: 999,
              background: COLORS.surfaceContainerLow,
              border: `1px solid ${COLORS.outlineVariant}`,
              ...(lesson.subject === s
                ? { background: COLORS.primaryLight, borderColor: COLORS.primary }
                : {}),
            }}
            onPress={() => patch("lesson_content", { subject: s })}
            activeOpacity={0.7}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: lesson.subject === s ? COLORS.primary : COLORS.onSurfaceVariant,
              }}
            >
              {s}
            </div>
          </Touchable>
        ))}
      </div>
      <input
        className="edc-diary-input"
        style={AS.input}
        value={lesson.subject || ""}
        onChange={(e) => patch("lesson_content", { subject: e.target.value })}
        placeholder="Môn học (bắt buộc)"
      />
      <input
        className="edc-diary-input"
        style={AS.input}
        value={lesson.topic || ""}
        onChange={(e) => patch("lesson_content", { topic: e.target.value })}
        placeholder="Chủ đề bài học hôm nay (bắt buộc)"
      />
      <div style={{ display: "flex", flexDirection: "row", gap: 10, marginBottom: 4 }}>
        <Touchable
          style={{
            flex: 1,
            padding: "10px 0",
            borderRadius: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: COLORS.surfaceContainerLow,
            border: `1px solid ${COLORS.outlineVariant}`,
            ...(lesson.is_new_knowledge ? { background: COLORS.primaryLight, borderColor: COLORS.primary } : {}),
          }}
          onPress={() => patch("lesson_content", { is_new_knowledge: !lesson.is_new_knowledge, is_review: false })}
          activeOpacity={0.7}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: lesson.is_new_knowledge ? COLORS.primary : COLORS.onSurfaceVariant,
            }}
          >
            Kiến thức mới
          </div>
        </Touchable>
        <Touchable
          style={{
            flex: 1,
            padding: "10px 0",
            borderRadius: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: COLORS.surfaceContainerLow,
            border: `1px solid ${COLORS.outlineVariant}`,
            ...(lesson.is_review ? { background: COLORS.primaryLight, borderColor: COLORS.primary } : {}),
          }}
          onPress={() => patch("lesson_content", { is_review: !lesson.is_review, is_new_knowledge: false })}
          activeOpacity={0.7}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: lesson.is_review ? COLORS.primary : COLORS.onSurfaceVariant,
            }}
          >
            Ôn tập
          </div>
        </Touchable>
      </div>

      {/* ── Mức độ tiếp thu (thang sao 1-5 kèm nhãn) ── */}
      <div style={{ ...typo("h4"), color: COLORS.onSurface, marginTop: 10, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
        <Icon name="star-outline" size={15} color={COLORS.primary} /> Mức độ tiếp thu bài
      </div>
      <div style={{ display: "flex", flexDirection: "row", gap: 6, marginBottom: 2 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Touchable
            key={n}
            onPress={() => patch("comprehension", { score: n, score_label: SCORE_LABELS[n] })}
            activeOpacity={0.7}
            style={{ padding: 2 }}
          >
            <Icon
              name={comp.score >= n ? "star" : "star-outline"}
              size={30}
              color={comp.score >= n ? "#F59E0B" : COLORS.outlineVariant}
            />
          </Touchable>
        ))}
      </div>
      {comp.score ? (
        <div style={{ ...typo("bodySmall"), color: "#F59E0B", fontWeight: 700, marginBottom: 4 }}>
          {SCORE_LABELS[comp.score] || comp.score_label || ""}
        </div>
      ) : null}
      <div style={{ display: "flex", flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 }}>
        {ATTITUDES.map((a) => (
          <Touchable
            key={a}
            style={{
              padding: "6px 12px",
              borderRadius: 999,
              background: COLORS.surfaceContainerLow,
              border: `1px solid ${COLORS.outlineVariant}`,
              ...(comp.attitude === a ? { background: COLORS.primaryLight, borderColor: COLORS.primary } : {}),
            }}
            onPress={() => patch("comprehension", { attitude: a })}
            activeOpacity={0.7}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: comp.attitude === a ? COLORS.primary : COLORS.onSurfaceVariant,
              }}
            >
              {a}
            </div>
          </Touchable>
        ))}
      </div>
      <input
        className="edc-diary-input"
        style={AS.input}
        value={comp.attitude || ""}
        onChange={(e) => patch("comprehension", { attitude: e.target.value })}
        placeholder="Thái độ buổi học (tuỳ chọn)"
      />

      {/* ── Bài tập trên lớp & về nhà ── */}
      <div style={{ ...typo("h4"), color: COLORS.onSurface, marginTop: 10, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
        <Icon name={ic("pencil-outline")} size={15} color={COLORS.primary} /> Bài tập trên lớp &amp; về nhà
      </div>
      <textarea
        className="edc-diary-input"
        style={{ ...AS.input, ...AS.multiline }}
        value={classwork.classwork_status || ""}
        onChange={(e) => patch("classwork_homework", { classwork_status: e.target.value })}
        placeholder="Tình trạng bài tập trên lớp (bắt buộc) — VD: Đã giải 10 bài SGK"
        rows={2}
      />
      <textarea
        className="edc-diary-input"
        style={{ ...AS.input, ...AS.multiline }}
        value={classwork.homework || ""}
        onChange={(e) => patch("classwork_homework", { homework: e.target.value })}
        placeholder="Bài tập về nhà (tuỳ chọn) — VD: Trang 45-46, bài 1-5 / Không có"
        rows={2}
      />

      {/* ── Nhận xét & kế hoạch ── */}
      <div style={{ ...typo("h4"), color: COLORS.onSurface, marginTop: 10, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
        <Icon name={ic("bulb-outline")} size={15} color={COLORS.primary} /> Nhận xét &amp; kế hoạch buổi tới
      </div>
      <textarea
        className="edc-diary-input"
        style={{ ...AS.input, ...AS.multiline }}
        value={remarks.knowledge_gap || ""}
        onChange={(e) => patch("remarks", { knowledge_gap: e.target.value })}
        placeholder="Lỗ hổng kiến thức cần khắc phục (tuỳ chọn)"
        rows={2}
      />
      <textarea
        className="edc-diary-input"
        style={{ ...AS.input, ...AS.multiline }}
        value={remarks.next_session_plan || ""}
        onChange={(e) => patch("remarks", { next_session_plan: e.target.value })}
        placeholder="Kế hoạch cho buổi học tới (tuỳ chọn)"
        rows={2}
      />
    </div>
  );
};

// Validate client-side — khớp 100% với backend (Phase 2) để tránh
// round-trip 400 vô nghĩa. Trả về chuỗi lỗi đầu tiên hoặc null.
export function validateTutoringAssessment(data: any): string | null {
  const d = data || {};
  const lesson = d.lesson_content || {};
  const comp = d.comprehension || {};
  const classwork = d.classwork_homework || {};
  if (!String(lesson.subject || "").trim()) return "Vui lòng nhập môn học.";
  if (!String(lesson.topic || "").trim()) return "Vui lòng nhập chủ đề bài học.";
  const score = Number(comp.score);
  if (!comp.score || Number.isNaN(score) || score < 1 || score > 5) {
    return "Vui lòng chọn mức độ tiếp thu từ 1 đến 5 sao.";
  }
  if (!String(classwork.classwork_status || "").trim()) {
    return "Vui lòng nhập tình trạng bài tập trên lớp.";
  }
  return null;
}

/* ════════ ChildcareAssessmentSection — port nguyên văn components/ChildcareAssessmentSection.js ════════ */

const ChildcareAssessmentSection: React.FC<{
  value: Record<string, any>;
  onChange: (next: Record<string, any>) => void;
}> = ({ value, onChange }) => {
  const data = value || {};
  const meals = Array.isArray(data.meals) ? data.meals : [];
  const nap = data.nap || {};
  const hygiene = data.hygiene_health || {};
  const activities = data.activities || {};
  const actList = Array.isArray(activities.list) ? activities.list : [];

  const patch = (section: string, fields: Record<string, any>) =>
    onChange({ ...data, [section]: { ...(data[section] || {}), ...fields } });

  const patchTop = (fields: Record<string, any>) => onChange({ ...data, ...fields });

  const updateMeal = (idx: number, field: string, val: string) => {
    const next = meals.map((m: any, i: number) => (i === idx ? { ...m, [field]: val } : m));
    patchTop({ meals: next });
  };
  const addMeal = () => patchTop({ meals: [...meals, { time: "", meal: "", amount: "" }] });
  const removeMeal = (idx: number) => patchTop({ meals: meals.filter((_: any, i: number) => i !== idx) });

  const updateActivity = (idx: number, val: string) => {
    patch("activities", { list: actList.map((a: any, i: number) => (i === idx ? val : a)) });
  };
  const addActivity = () => patch("activities", { list: [...actList, ""] });
  const removeActivity = (idx: number) =>
    patch("activities", { list: actList.filter((_: any, i: number) => i !== idx) });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* ── Bữa ăn (thêm được nhiều dòng) ── */}
      <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ ...typo("h4"), color: COLORS.onSurface, marginTop: 10, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
          <Icon name={ic("restaurant-outline")} size={15} color={COLORS.primary} /> Bữa ăn
        </div>
        <Touchable onPress={addMeal} style={CS.addBtn} activeOpacity={0.7}>
          <Icon name="add" size={18} color={COLORS.primary} />
        </Touchable>
      </div>
      {meals.length === 0 && (
        <div style={{ ...typo("caption"), color: COLORS.textMuted, marginBottom: 4 }}>
          Nhấn “+” để thêm bữa ăn (ít nhất 1 bữa).
        </div>
      )}
      {meals.map((m: any, idx: number) => (
        <div
          key={idx}
          style={{
            background: COLORS.surface,
            borderRadius: 14,
            padding: 12,
            border: `1px solid ${COLORS.outlineVariant}`,
            marginBottom: 6,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 8 }}>
            <input
              className="edc-diary-input"
              style={CS.timeInput}
              value={m.time || ""}
              onChange={(e) => updateMeal(idx, "time", e.target.value)}
              placeholder="Giờ"
              maxLength={5}
            />
            <input
              className="edc-diary-input"
              style={CS.mealInput}
              value={m.meal || ""}
              onChange={(e) => updateMeal(idx, "meal", e.target.value)}
              placeholder="Món ăn (VD: Cơm trưa + canh rau)"
            />
            <Touchable onPress={() => removeMeal(idx)} hitSlop={8}>
              <Icon name="close-circle" size={20} color={COLORS.error} />
            </Touchable>
          </div>
          <input
            className="edc-diary-input"
            style={AS.input}
            value={m.amount || ""}
            onChange={(e) => updateMeal(idx, "amount", e.target.value)}
            placeholder="Lượng ăn (VD: Ăn hết suất / Uống 200ml)"
          />
        </div>
      ))}

      {/* ── Giấc ngủ ── */}
      <div style={{ ...typo("h4"), color: COLORS.onSurface, marginTop: 10, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
        <Icon name={ic("bed-outline")} size={15} color={COLORS.primary} /> Giấc ngủ
      </div>
      <div style={{ display: "flex", flexDirection: "row", gap: 8 }}>
        <input
          className="edc-diary-input"
          style={{ ...CS.timeInput, flex: 1, width: "auto" }}
          value={nap.start_time || ""}
          onChange={(e) => patch("nap", { start_time: e.target.value })}
          placeholder="Bắt đầu (12:30)"
          maxLength={5}
        />
        <input
          className="edc-diary-input"
          style={{ ...CS.timeInput, flex: 1, width: "auto" }}
          value={nap.end_time || ""}
          onChange={(e) => patch("nap", { end_time: e.target.value })}
          placeholder="Kết thúc (14:15)"
          maxLength={5}
        />
      </div>
      <input
        className="edc-diary-input"
        style={AS.input}
        value={nap.quality || ""}
        onChange={(e) => patch("nap", { quality: e.target.value })}
        placeholder="Chất lượng giấc ngủ (bắt buộc) — VD: Ngủ ngon, sâu giấc"
      />

      {/* ── Vệ sinh & thể chất ── */}
      <div style={{ ...typo("h4"), color: COLORS.onSurface, marginTop: 10, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
        <Icon name={ic("medkit-outline")} size={15} color={COLORS.primary} /> Vệ sinh &amp; thể chất
      </div>
      <input
        className="edc-diary-input"
        style={AS.input}
        value={hygiene.diaper_toilet || ""}
        onChange={(e) => patch("hygiene_health", { diaper_toilet: e.target.value })}
        placeholder="Vệ sinh / đi vệ sinh (tuỳ chọn)"
      />
      <input
        className="edc-diary-input"
        style={AS.input}
        value={hygiene.physical_condition || ""}
        onChange={(e) => patch("hygiene_health", { physical_condition: e.target.value })}
        placeholder="Tình trạng thể chất (bắt buộc) — VD: Nhiệt độ bình thường, tỉnh táo"
      />

      {/* ── Hoạt động (thêm được nhiều dòng, không bắt buộc) ── */}
      <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ ...typo("h4"), color: COLORS.onSurface, marginTop: 10, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
          <Icon name={ic("toys-outline")} size={15} color={COLORS.primary} /> Hoạt động
        </div>
        <Touchable onPress={addActivity} style={CS.addBtn} activeOpacity={0.7}>
          <Icon name="add" size={18} color={COLORS.primary} />
        </Touchable>
      </div>
      {actList.map((a: any, idx: number) => (
        <div key={idx} style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 8 }}>
          <input
            className="edc-diary-input"
            style={{ ...AS.input, flex: 1 }}
            value={a}
            onChange={(e) => updateActivity(idx, e.target.value)}
            placeholder="Hoạt động (VD: Đọc truyện)"
          />
          <Touchable onPress={() => removeActivity(idx)} hitSlop={8}>
            <Icon name="close-circle" size={20} color={COLORS.error} />
          </Touchable>
        </div>
      ))}
      <input
        className="edc-diary-input"
        style={AS.input}
        value={activities.mood_during || ""}
        onChange={(e) => patch("activities", { mood_during: e.target.value })}
        placeholder="Tâm trạng trong lúc chơi (tuỳ chọn)"
      />

      {/* ── Ghi chú cho phụ huynh ── */}
      <div style={{ ...typo("h4"), color: COLORS.onSurface, marginTop: 10, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
        <Icon name="chatbubble-ellipses-outline" size={15} color={COLORS.primary} /> Ghi chú cho phụ huynh
      </div>
      <textarea
        className="edc-diary-input"
        style={{ ...AS.input, ...AS.multiline }}
        value={data.notes_for_parents || ""}
        onChange={(e) => patchTop({ notes_for_parents: e.target.value })}
        placeholder="Lưu ý gửi phụ huynh (tuỳ chọn)"
        rows={3}
      />
    </div>
  );
};

// Validate client-side — khớp 100% với backend (Phase 2).
export function validateChildcareAssessment(data: any): string | null {
  const d = data || {};
  const meals = Array.isArray(d.meals) ? d.meals : [];
  if (meals.length === 0) return "Vui lòng thêm ít nhất 1 bữa ăn.";
  for (let i = 0; i < meals.length; i++) {
    const m = meals[i] || {};
    if (!String(m.time || "").trim() || !String(m.amount || "").trim()) {
      return `Bữa ăn thứ ${i + 1} thiếu giờ hoặc lượng ăn.`;
    }
  }
  const nap = d.nap || {};
  if (!String(nap.quality || "").trim()) return "Vui lòng nhập chất lượng giấc ngủ của bé.";
  const hygiene = d.hygiene_health || {};
  if (!String(hygiene.physical_condition || "").trim()) {
    return "Vui lòng nhập tình trạng thể chất của bé.";
  }
  return null;
}

/* ── Styles TutoringAssessmentSection (StyleSheet.create RN → CSS) ── */
const AS: Record<string, React.CSSProperties> = {
  input: {
    background: COLORS.surface,
    borderRadius: 12,
    border: `1px solid ${COLORS.outlineVariant}`,
    padding: "12px 14px",
    ...typo("body"),
    color: COLORS.onSurface,
    marginBottom: 6,
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  },
  multiline: { minHeight: 64 },
};

/* ── Styles ChildcareAssessmentSection ── */
const CS: Record<string, React.CSSProperties> = {
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    background: COLORS.primaryLight,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    border: `1px solid ${COLORS.primarySoft}`,
  },
  timeInput: {
    width: 92,
    background: COLORS.surface,
    borderRadius: 12,
    border: `1px solid ${COLORS.outlineVariant}`,
    padding: "10px",
    ...typo("bodySmall"),
    color: COLORS.onSurface,
    textAlign: "center",
    outline: "none",
    boxSizing: "border-box",
  },
  mealInput: {
    flex: 1,
    background: COLORS.surface,
    borderRadius: 12,
    border: `1px solid ${COLORS.outlineVariant}`,
    padding: "10px 12px",
    ...typo("bodySmall"),
    color: COLORS.onSurface,
    outline: "none",
    boxSizing: "border-box",
    minWidth: 0,
  },
};

/* ── Styles màn hình chính (StyleSheet.create RN → CSS 1:1) ── */
const S: Record<string, React.CSSProperties> = {
  container: {
    flex: 1,
    minHeight: "100dvh",
    background: COLORS.surfaceWarm,
    display: "flex",
    flexDirection: "column",
  },
  loadingContainer: {
    flex: 1,
    minHeight: "100dvh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: COLORS.surfaceContainerLow,
  },
  appBar: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 12px 12px",
    background: COLORS.surfaceContainerLow,
  },
  appBarBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  appBarTitle: {
    ...typo("h2"),
    color: COLORS.primary,
    flex: 1,
    textAlign: "center",
    marginRight: 44,
  },
  scrollView: { flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" },
  scrollContent: { display: "flex", flexDirection: "column", padding: "16px 20px 20px", gap: 16 },
  // Task info
  taskInfo: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    background: COLORS.surfaceContainer,
    borderRadius: 12,
    padding: 10,
    border: `1px solid ${COLORS.outlineVariant}`,
  },
  taskInfoText: { ...typo("bodySmall"), color: COLORS.onSurface, flex: 1 },
  // Section
  sectionTitle: { ...typo("h4"), color: COLORS.onSurface, marginBottom: 4 },
  assessmentHeader: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
    background: COLORS.primaryLight,
    borderRadius: 12,
    padding: 12,
    border: `1px solid ${COLORS.primarySoft}`,
  },
  assessmentHeaderText: { ...typo("h4"), color: COLORS.primary, flex: 1 },
  sectionHeader: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    background: COLORS.primaryLight,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    border: `1px solid ${COLORS.primarySoft}`,
  },
  // Mood
  moodRow: { display: "flex", flexDirection: "row", gap: 12, marginBottom: 8 },
  moodChip: {
    width: 48,
    height: 48,
    borderRadius: 24,
    background: COLORS.surfaceContainer,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    border: `2px solid ${COLORS.outlineVariant}`,
    boxSizing: "border-box",
  },
  moodChipActive: { background: COLORS.primary, borderColor: COLORS.primary },
  // Input
  input: {
    background: COLORS.surface,
    borderRadius: 12,
    border: `1px solid ${COLORS.outlineVariant}`,
    padding: "12px 14px",
    ...typo("body"),
    color: COLORS.onSurface,
    marginBottom: 8,
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  },
  // Completion
  sliderRow: { display: "flex", flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  percentInput: {
    width: 60,
    background: COLORS.surface,
    borderRadius: 12,
    border: `1px solid ${COLORS.outlineVariant}`,
    padding: "10px 12px",
    ...typo("h4"),
    color: COLORS.onSurface,
    textAlign: "center",
    outline: "none",
    boxSizing: "border-box",
  },
  percentSymbol: { ...typo("h3"), color: COLORS.onSurfaceVariant },
  // Activity
  activityCard: {
    background: COLORS.surface,
    borderRadius: 14,
    padding: 12,
    border: `1px solid ${COLORS.outlineVariant}`,
    marginBottom: 12,
    gap: 8,
    display: "flex",
    flexDirection: "column",
  },
  activityRowTop: { display: "flex", flexDirection: "row", alignItems: "center", gap: 8 },
  timeInput: {
    width: 64,
    background: COLORS.surfaceContainerLow,
    borderRadius: 8,
    border: `1px solid ${COLORS.outlineVariant}`,
    padding: "8px",
    ...typo("caption"),
    color: COLORS.onSurface,
    textAlign: "center",
    outline: "none",
    boxSizing: "border-box",
  },
  statusChips: { flex: 1, display: "flex", flexDirection: "row", gap: 4 },
  statusChip: {
    padding: "4px 8px",
    borderRadius: 999,
    background: COLORS.surfaceContainerLow,
    border: `1px solid ${COLORS.outlineVariant}`,
    whiteSpace: "nowrap",
  },
  statusChipActive: { background: COLORS.primaryLight, borderColor: COLORS.primary },
  statusChipText: { fontSize: 10, fontWeight: 600, color: COLORS.onSurfaceVariant },
  statusChipTextActive: { color: COLORS.primary },
  actTitle: {
    background: COLORS.surfaceContainerLow,
    borderRadius: 8,
    border: `1px solid ${COLORS.outlineVariant}`,
    padding: "8px 10px",
    ...typo("bodySmall"),
    color: COLORS.onSurface,
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  },
  actDesc: {
    background: COLORS.surfaceContainerLow,
    borderRadius: 8,
    border: `1px solid ${COLORS.outlineVariant}`,
    padding: "8px 10px",
    ...typo("bodySmall"),
    color: COLORS.onSurface,
    minHeight: 40,
    outline: "none",
    resize: "none",
    width: "100%",
    boxSizing: "border-box",
  },
  noteInput: { minHeight: 80 },
  // Images
  imageRow: { display: "flex", flexDirection: "row", gap: 12, flexWrap: "wrap" },
  imageThumb: {
    width: 80,
    height: 80,
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
  },
  imageThumbImg: { width: "100%", height: "100%", objectFit: "cover" },
  imageRemove: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    background: "rgba(0,0,0,0.5)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  // Footer
  footer: {
    padding: 16,
    background: COLORS.surface,
    borderTop: `1px solid ${COLORS.outlineVariant}`,
  },
  submitBtn: {
    background: COLORS.primary,
    borderRadius: 14,
    height: 50,
    display: "flex",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    boxShadow: SHADOWS.large,
  },
  submitBtnText: { ...typo("button"), color: COLORS.textOnPrimary, fontWeight: 700 },
};

interface ActivityDraft {
  time: string;
  title: string;
  description: string;
  status: string;
}
interface ImageDraft {
  file: File;
  url: string;
}

const CareDiaryFormScreen: React.FC<{ taskId?: string | number; taskTitle?: string }> = ({
  taskId,
  taskTitle,
}) => {
  const nav = useNav();

  // === FORM STATE ===
  const [moodIcon, setMoodIcon] = useState("happy");
  const [moodLabel, setMoodLabel] = useState("Vui vẻ & Hợp tác");
  const [moodNote, setMoodNote] = useState("");
  const [completionPercent, setCompletionPercent] = useState("85");
  const [note, setNote] = useState("");
  const [activities, setActivities] = useState<ActivityDraft[]>([
    { time: "", title: "", description: "", status: "done" },
  ]);
  const [images, setImages] = useState<ImageDraft[]>([]); // web: File + objectURL

  // === CARE DIARY NÂNG CẤP — form đánh giá chuyên sâu ===
  // assessmentType: 'tutoring' | 'childcare' | 'general' — suy ra từ
  // category.code của task ('gia-su' → tutoring, 'trong-tre' → childcare,
  // còn lại general); nếu entry cũ đã có assessment_type thì ưu tiên entry.
  const [categoryCode, setCategoryCode] = useState("");
  const [assessmentType, setAssessmentType] = useState("general");
  const [assessmentData, setAssessmentData] = useState<Record<string, any>>({});

  // === UI STATE ===
  const [submitting, setSubmitting] = useState(false);
  const [loadingEntry, setLoadingEntry] = useState(true);
  const [isExisting, setIsExisting] = useState(false);

  // === LOAD EXISTING ENTRY + CATEGORY ===
  useEffect(() => {
    if (!taskId) {
      setLoadingEntry(false);
      return;
    }
    let mounted = true;
    setLoadingEntry(true);
    // 1) Category của task → chọn loại form (H1 — theo category.code)
    getTaskDetail(taskId)
      .then((res: any) => {
        if (!mounted) return;
        const code = res?.category_code || "";
        setCategoryCode(code);
      })
      .catch(() => {
        /* không lấy được category → dùng form chung */
      });
    // 2) Entry cũ (nếu có) → nạp vào form
    const loadEntry = async () => {
      try {
        const res: any = await getCareDiaryEntry(taskId);
        if (!mounted) return;
        const d = res;
        setIsExisting(true);
        setMoodIcon(d.mood?.icon || "happy");
        setMoodLabel(d.mood?.label || "");
        setMoodNote(d.mood?.note || "");
        setCompletionPercent(String(d.completion?.percent || 0));
        setNote(d.note || "");
        if (d.activities?.length) {
          setActivities(
            d.activities.map((a: any) => ({
              time: a.time,
              title: a.title,
              description: a.desc || "",
              status: a.status,
            }))
          );
        }
        // CARE DIARY NÂNG CẤP — nạp form đánh giá chuyên sâu
        if (d.assessment_type) setAssessmentType(d.assessment_type);
        if (d.assessment_data && typeof d.assessment_data === "object") {
          setAssessmentData(d.assessment_data);
        }
      } catch {
        /* 404 = chưa có entry → form trống */
      } finally {
        if (mounted) setLoadingEntry(false);
      }
    };
    loadEntry();
    return () => {
      mounted = false;
    };
  }, [taskId]);

  // Revoke objectURL khi unmount
  useEffect(() => {
    return () => {
      images.forEach((img) => URL.revokeObjectURL(img.url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Loại form hiệu lực: entry cũ ghi đè category, nhưng category là nguồn
  // mặc định khi tạo mới. Code 'gia-su' → tutoring, 'trong-tre' → childcare
  // (H1 — so khớp code, không so khớp tên hiển thị).
  const effectiveAssessmentType = isExisting
    ? assessmentType
    : categoryCode === "gia-su"
    ? "tutoring"
    : categoryCode === "trong-tre"
    ? "childcare"
    : "general";

  // === ACTIVITY CRUD ===
  const updateActivity = (idx: number, field: keyof ActivityDraft, value: string) => {
    setActivities((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };
  const addActivity = () =>
    setActivities((prev) => [...prev, { time: "", title: "", description: "", status: "done" }]);
  const removeActivity = (idx: number) =>
    setActivities((prev) => prev.filter((_, i) => i !== idx));

  // === IMAGE PICKER (web — thay expo-image-picker) ===
  const pickImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length) {
      setImages((prev) => [
        ...prev,
        ...files.map((file) => ({ file, url: URL.createObjectURL(file) })),
      ]);
    }
    e.target.value = ""; // cho phép chọn lại cùng file
  };

  const removeImage = (idx: number) => {
    setImages((prev) => {
      URL.revokeObjectURL(prev[idx].url);
      return prev.filter((_, i) => i !== idx);
    });
  };

  // === SUBMIT ===
  // L2 (QA 2026-09-19) — allowClear: lượt gửi lại sau khi người dùng xác nhận
  // dialog "Xác nhận xoá dữ liệu đánh giá" → gửi kèm confirm_clear_assessment
  // = true để backend cho phép hạ cấp tutoring/childcare → general (H1).
  const handleSubmit = async (allowClear = false) => {
    if (submitting) return;
    // Validate cơ bản (form chung)
    const validActivities = activities.filter((a) => a.title.trim());
    if (!moodLabel && !note && !validActivities.length) {
      showAlert("Thông tin thiếu", "Vui lòng nhập ít nhất tâm trạng, ghi chú hoặc hoạt động.");
      return;
    }

    // CARE DIARY NÂNG CẤP — validate client-side khớp backend Phase 2
    // để tránh round-trip 400 vô nghĩa.
    if (effectiveAssessmentType === "tutoring") {
      const err = validateTutoringAssessment(assessmentData);
      if (err) {
        showAlert("Thiếu thông tin đánh giá", err);
        return;
      }
    } else if (effectiveAssessmentType === "childcare") {
      const err = validateChildcareAssessment(assessmentData);
      if (err) {
        showAlert("Thiếu thông tin đánh giá", err);
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload: Record<string, any> = {
        mood_icon: moodIcon,
        mood_label: moodLabel,
        mood_note: moodNote,
        completion_percent: parseInt(completionPercent) || 0,
        note,
        assessment_type: effectiveAssessmentType,
        assessment_data: effectiveAssessmentType === "general" ? {} : assessmentData,
        // H2 — chỉ gửi key 'activities' khi form chung: backend coi activities
        // != null là lệnh "xóa hết rồi tạo lại", gửi mảng rỗng khi form chuyên
        // sâu ẩn timeline sẽ âm thầm xóa activities cũ của entry.
        ...(effectiveAssessmentType === "general"
          ? {
              activities: validActivities.map((a, i) => ({
                time: a.time,
                title: a.title,
                description: a.description,
                status: a.status,
                order: i,
              })),
            }
          : {}),
        // L2 — chỉ gửi cờ xác nhận khi đã qua dialog xác nhận (lượt gửi lại)
        ...(allowClear ? { confirm_clear_assessment: true } : {}),
      };

      if (isExisting) {
        await updateCareDiaryEntry(taskId as string | number, payload);
      } else {
        await createCareDiaryEntry(taskId as string | number, payload);
      }

      // Upload ảnh nếu có
      if (images.length > 0) {
        const formData = new FormData();
        images.forEach((img) => {
          formData.append("images", img.file, img.file.name || `diary_${Date.now()}.jpg`);
        });
        try {
          await uploadCareDiaryAttachments(taskId as string | number, formData);
        } catch (e) {
          console.warn("Upload ảnh thất bại (nhưng nhật ký đã lưu):", e);
        }
      }

      showAlert(
        isExisting ? "Đã cập nhật" : "Đã lưu nhật ký",
        "Nhật ký chăm sóc đã được lưu thành công."
      );
      nav.goBack();
    } catch (err: any) {
      const errData = err?.response?.data || null;
      // L2 — backend chặn hạ cấp về form chung khi entry còn dữ liệu đánh giá
      // (H1 backend). Hỏi xác nhận rõ ràng thay vì hiện lỗi chung chung;
      // người dùng đồng ý → gửi lại kèm confirm_clear_assessment=true.
      if (!allowClear && isDowngradeConfirmError(errData)) {
        if (
          window.confirm(
            "Xác nhận xoá dữ liệu đánh giá\n\n" +
              "Đổi về form chung sẽ xoá toàn bộ dữ liệu đánh giá chuyên sâu đã lưu " +
              "(điểm tiếp thu, bữa ăn, giấc ngủ...). Bạn chắc chắn chứ?"
          )
        ) {
          handleSubmit(true); // "Xoá & lưu"
        } // "Giữ nguyên" → cancel
        return;
      }
      const msg = extractApiError(errData) || "Không thể lưu nhật ký. Vui lòng thử lại.";
      showAlert("Lỗi", msg);
    } finally {
      setSubmitting(false);
    }
  };

  // === LOADING EXISTING ===
  if (loadingEntry) {
    return (
      <div style={S.loadingContainer}>
        <Spinner size={36} color={COLORS.primary} />
      </div>
    );
  }

  return (
    <div style={S.container}>
      <StatusBarSpacer />
      <style>{`.edc-diary-input::placeholder{color:${COLORS.textMuted};opacity:1}`}</style>

      {/* App bar */}
      <div style={{ ...S.appBar, paddingTop: 32 }}>
        <Touchable
          onPress={nav.goBack}
          style={S.appBarBtn}
          hitSlop={12}
          aria-role="button"
          aria-label="Quay lại"
        >
          <Icon name="arrow-back" size={22} color={COLORS.primary} />
        </Touchable>
        <div style={S.appBarTitle}>{isExisting ? "Sửa nhật ký" : "Ghi nhật ký"}</div>
        <div style={{ width: 44 }} />
      </div>

      <div style={S.scrollView}>
        <div style={S.scrollContent}>
          {/* Task info */}
          {taskTitle ? (
            <div style={S.taskInfo}>
              <Icon name="briefcase-outline" size={16} color={COLORS.primary} />
              <div style={{ ...S.taskInfoText, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {taskTitle}
              </div>
            </div>
          ) : null}

          {/* Mood */}
          <div style={S.sectionTitle}>Tâm trạng của bé</div>
          <div style={S.moodRow}>
            {MOODS.map((m) => (
              <Touchable
                key={m.icon}
                style={{ ...S.moodChip, ...(moodIcon === m.icon ? S.moodChipActive : {}) }}
                onPress={() => {
                  setMoodIcon(m.icon);
                  setMoodLabel(m.label);
                }}
                activeOpacity={0.7}
              >
                <Icon
                  name={ic(m.icon)}
                  size={20}
                  color={moodIcon === m.icon ? COLORS.textOnPrimary : COLORS.onSurfaceVariant}
                />
              </Touchable>
            ))}
          </div>
          <input
            className="edc-diary-input"
            style={S.input}
            value={moodNote}
            onChange={(e) => setMoodNote(e.target.value)}
            placeholder="Ghi chú về tâm trạng (tuỳ chọn)"
          />

          {/* Completion % */}
          <div style={S.sectionTitle}>Mức độ hoàn thành</div>
          <div style={S.sliderRow}>
            <input
              className="edc-diary-input"
              style={S.percentInput}
              value={completionPercent}
              onChange={(e) => setCompletionPercent(e.target.value)}
              inputMode="numeric"
              maxLength={3}
            />
            <div style={S.percentSymbol}>%</div>
          </div>

          {/* CARE DIARY NÂNG CẤP — form chuyên sâu theo danh mục.
              tutoring/childcare thay thế phần timeline hoạt động;
              general giữ nguyên form cơ bản. */}
          {effectiveAssessmentType === "tutoring" && (
            <div>
              <div style={S.assessmentHeader}>
                <Icon name="school" size={18} color={COLORS.primary} />
                <div style={S.assessmentHeaderText}>Đánh giá buổi học</div>
              </div>
              <TutoringAssessmentSection value={assessmentData} onChange={setAssessmentData} />
            </div>
          )}
          {effectiveAssessmentType === "childcare" && (
            <div>
              <div style={S.assessmentHeader}>
                <Icon name="heart" size={18} color={COLORS.primary} />
                <div style={S.assessmentHeaderText}>Sinh hoạt buổi đồng hành cùng trẻ</div>
              </div>
              <ChildcareAssessmentSection value={assessmentData} onChange={setAssessmentData} />
            </div>
          )}

          {/* Activities — chỉ hiện cho form chung (tutoring/childcare dùng
              form chuyên sâu thay thế timeline hoạt động) */}
          {effectiveAssessmentType === "general" && (
            <div style={S.sectionHeader}>
              <div style={S.sectionTitle}>Hoạt động</div>
              <Touchable onPress={addActivity} style={S.addBtn} activeOpacity={0.7}>
                <Icon name="add" size={18} color={COLORS.primary} />
              </Touchable>
            </div>
          )}
          {effectiveAssessmentType === "general" &&
            activities.map((act, idx) => (
              <div key={idx} style={S.activityCard}>
                <div style={S.activityRowTop}>
                  <input
                    className="edc-diary-input"
                    style={S.timeInput}
                    value={act.time}
                    onChange={(e) => updateActivity(idx, "time", e.target.value)}
                    placeholder="HH:MM"
                    maxLength={5}
                  />
                  <div style={S.statusChips}>
                    {ACTIVITY_STATUSES.map((s) => (
                      <Touchable
                        key={s.key}
                        style={{
                          ...S.statusChip,
                          ...(act.status === s.key ? S.statusChipActive : {}),
                        }}
                        onPress={() => updateActivity(idx, "status", s.key)}
                        activeOpacity={0.7}
                      >
                        <div
                          style={{
                            ...S.statusChipText,
                            ...(act.status === s.key ? S.statusChipTextActive : {}),
                          }}
                        >
                          {s.label}
                        </div>
                      </Touchable>
                    ))}
                  </div>
                  {activities.length > 1 && (
                    <Touchable onPress={() => removeActivity(idx)} hitSlop={8}>
                      <Icon name="close-circle" size={20} color={COLORS.error} />
                    </Touchable>
                  )}
                </div>
                <input
                  className="edc-diary-input"
                  style={S.actTitle}
                  value={act.title}
                  onChange={(e) => updateActivity(idx, "title", e.target.value)}
                  placeholder="Tên hoạt động"
                />
                <textarea
                  className="edc-diary-input"
                  style={S.actDesc}
                  value={act.description}
                  onChange={(e) => updateActivity(idx, "description", e.target.value)}
                  placeholder="Mô tả (tuỳ chọn)"
                  rows={2}
                />
              </div>
            ))}

          {/* Note */}
          <div style={S.sectionTitle}>Ghi chú tổng kết</div>
          <textarea
            className="edc-diary-input"
            style={{ ...S.input, ...S.noteInput }}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ghi chú cuối ca..."
            rows={4}
          />

          {/* Photos */}
          <div style={S.sectionHeader}>
            <div style={S.sectionTitle}>Ảnh đính kèm</div>
            <Touchable
              onPress={() => document.getElementById("edc-diary-image-input")?.click()}
              style={S.addBtn}
              activeOpacity={0.7}
            >
              <Icon name={ic("image-outline")} size={18} color={COLORS.primary} />
            </Touchable>
            <input
              id="edc-diary-image-input"
              type="file"
              accept="image/*"
              multiple
              style={{ display: "none" }}
              onChange={pickImages}
            />
          </div>
          {images.length > 0 && (
            <div style={S.imageRow}>
              {images.map((img, idx) => (
                <div key={idx} style={S.imageThumb}>
                  <img src={img.url} style={S.imageThumbImg} alt="" />
                  <Touchable style={S.imageRemove} onPress={() => removeImage(idx)}>
                    <Icon name="close" size={14} color="#fff" />
                  </Touchable>
                </div>
              ))}
            </div>
          )}

          <div style={{ height: 120 }} />
        </div>
      </div>

      {/* Submit button */}
      <div style={S.footer}>
        <Touchable
          style={{ ...S.submitBtn, ...(submitting ? { opacity: 0.6 } : {}) }}
          onPress={() => handleSubmit()}
          disabled={submitting}
          activeOpacity={0.85}
        >
          {submitting ? (
            <Spinner size={20} color="#fff" />
          ) : (
            <>
              <Icon name={ic("save-outline")} size={18} color="#fff" />
              <div style={S.submitBtnText}>{isExisting ? "Cập nhật nhật ký" : "Lưu nhật ký"}</div>
            </>
          )}
        </Touchable>
      </div>
    </div>
  );
};

export default CareDiaryFormScreen;
