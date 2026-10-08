/**
 * CareDiaryHistoryScreen — port CHÍNH XÁC mobile/src/screens/Parent/CareDiaryHistoryScreen.js (202 dòng).
 * Lịch sử nhật ký chăm sóc: danh sách rút gọn các buổi đã có nhật ký, mới nhất trên đầu.
 * Bấm card → nav.navigate('CareDiaryDetail', { taskId: item.task_id, taskTitle: item.task_title }).
 *
 * Dữ liệu: getCareDiaryHistory() — /parent/care-diary-history/ (zalo api trả data trực tiếp).
 * Fetch khi mount; error → icon + nút "Thử lại"; empty → icon sách + text NGUYÊN từ RN.
 *
 * PLATFORM ADAPTATION (ghi mobile-parity-map.md):
 * - FlatList + RefreshControl (pull-to-refresh) → div scroll; web không có pull-to-refresh —
 *   giữ refetch khi mount + nút "Thử lại" khi lỗi (như RN).
 * - paddingTop app bar: RN `insets.top + 32` → StatusBarSpacer + paddingTop 32.
 * - Icon thiếu trong bộ 159 glyph → fallback gần nghĩa cục bộ (ic()): sad→sad-outline,
 *   book-outline→book.
 */
import React, { useState, useEffect, useCallback } from "react";
import Icon from "@/components/Icon";
import { Spinner, StatusBarSpacer, Touchable } from "@/components/ui";
import { COLORS, SHADOWS, TYPO } from "@/theme";
import { useNav } from "@/navigation/router";
import { getCareDiaryHistory } from "@/api/misc";

const MOOD_ICONS: Record<string, { name: string; color: string }> = {
  happy: { name: "happy", color: COLORS.success },
  sad: { name: "sad", color: COLORS.error },
  "alert-circle": { name: "alert-circle", color: COLORS.warning },
  "thumbs-up": { name: "thumbs-up", color: COLORS.primary },
  // từ vựng form WEB (backend đã chuẩn hoá nhưng giữ fallback cho dữ liệu cũ)
  neutral: { name: "thumbs-up", color: COLORS.primary },
  excited: { name: "happy", color: COLORS.success },
};

/** Glyph thiếu trong ionicons.ts 159 glyph → fallback gần nghĩa (không sửa ionicons.ts) */
const ic = (name: string) =>
  ({
    sad: "sad-outline",
    "book-outline": "book",
  } as Record<string, string>)[name] ?? name;

interface HistoryEntry {
  task_id?: number | string;
  task_title?: string;
  date?: string;
  mood?: { icon?: string; label?: string };
  completion_percent?: number;
  worker_name?: string;
}

const CareDiaryHistoryScreen: React.FC = () => {
  const nav = useNav();
  const [data, setData] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = (await getCareDiaryHistory()) as HistoryEntry[];
      setData(res || []);
    } catch (err: any) {
      if (!isRefresh) {
        setError(err.response?.data?.error || "Không thể tải lịch sử nhật ký.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const renderItem = (item: HistoryEntry) => {
    const mood = MOOD_ICONS[item.mood?.icon || ""] || MOOD_ICONS.happy;
    const pct = item.completion_percent || 0;
    const pctColor = pct >= 80 ? COLORS.success : pct >= 50 ? COLORS.primary : COLORS.warning;

    return (
      <Touchable
        style={{
          background: COLORS.surface,
          borderRadius: 20,
          padding: 16,
          border: `1px solid ${COLORS.outlineVariant}`,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          boxShadow: SHADOWS.small,
        }}
        onPress={() => nav.navigate("CareDiaryDetail", { taskId: item.task_id, taskTitle: item.task_title })}
        activeOpacity={0.85}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ flex: 1, marginRight: 12, display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
            <div
              style={{
                ...TYPO.h4,
                color: COLORS.onSurface,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {item.task_title || `Buổi #${item.task_id ?? "?"}`}
            </div>
            <div style={{ ...TYPO.caption, color: COLORS.onSurfaceVariant, marginTop: 2 }}>{item.date}</div>
          </div>
          <div style={{ padding: "4px 10px", borderRadius: 999, background: `${pctColor}18`, flexShrink: 0 }}>
            <span style={{ ...TYPO.caption, fontWeight: 800, color: pctColor }}>{pct}%</span>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              background: COLORS.surfaceContainerLow,
              borderRadius: 999,
              padding: "4px 10px",
            }}
          >
            <Icon name={ic(mood.name)} size={14} color={mood.color} />
            <span style={{ fontSize: 12, fontWeight: 600, color: mood.color }}>{item.mood?.label || "Bình thường"}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, minWidth: 0 }}>
            <Icon name="person-outline" size={13} color={COLORS.onSurfaceVariant} />
            <span
              style={{
                ...TYPO.caption,
                color: COLORS.onSurfaceVariant,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {item.worker_name}
            </span>
          </div>
        </div>
      </Touchable>
    );
  };

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
      <div style={{ ...TYPO.h2, color: COLORS.primary, flex: 1, textAlign: "center", marginRight: 44 }}>Lịch sử nhật ký</div>
      <div style={{ width: 44 }} />
    </div>
  );

  /* === LOADING (RN giữ app bar khi loading) === */
  if (loading) {
    return (
      <div style={{ minHeight: "100dvh", background: COLORS.surfaceWarm }}>
        <StatusBarSpacer />
        {appBar}
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", paddingTop: 120 }}>
          <Spinner size={30} color={COLORS.primary} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100dvh", background: COLORS.surfaceWarm, display: "flex", flexDirection: "column" }}>
      <StatusBarSpacer />
      {appBar}

      {error ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "0 40px", gap: 16 }}>
          <Icon name="cloud-offline-outline" size={48} color={COLORS.onSurfaceVariant} />
          <div style={{ ...TYPO.body, color: COLORS.onSurfaceVariant, textAlign: "center" }}>{error}</div>
          <Touchable
            onPress={() => fetchData()}
            style={{ background: COLORS.primary, borderRadius: 14, padding: "12px 24px", boxShadow: SHADOWS.large }}
          >
            <span style={{ ...TYPO.button, color: COLORS.textOnPrimary }}>Thử lại</span>
          </Touchable>
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
          {data.length === 0 ? (
            /* === EMPTY (ListEmptyComponent — RN exact) === */
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 80, gap: 12, padding: "80px 40px 0" }}>
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 36,
                  background: COLORS.primaryLight,
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  marginBottom: 4,
                  boxShadow: SHADOWS.small,
                }}
              >
                <Icon name={ic("book-outline")} size={36} color={COLORS.primary} />
              </div>
              <div style={{ ...TYPO.h4, color: COLORS.onSurface }}>Chưa có nhật ký nào</div>
              <div style={{ ...TYPO.bodySmall, color: COLORS.onSurfaceVariant, textAlign: "center" }}>
                Khi CarePartner ghi nhật ký sau buổi chăm sóc, bạn sẽ thấy các buổi ở đây để theo dõi tiến bộ của bé.
              </div>
            </div>
          ) : (
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
              {data.map((item) => (
                <React.Fragment key={String(item.task_id)}>{renderItem(item)}</React.Fragment>
              ))}
            </div>
          )}
          {refreshing && (
            /* RefreshControl → chỉ báo refetch nhỏ dưới list (web không có pull-to-refresh) */
            <div style={{ display: "flex", justifyContent: "center", padding: 12 }}>
              <Spinner size={20} color={COLORS.primary} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CareDiaryHistoryScreen;
