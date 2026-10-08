/**
 * ImagePreviewScreen — port CHÍNH XÁC mobile/src/screens/ImagePreviewScreen.js (107 dòng).
 * Full-screen image viewer (modal — presentation:'modal'): nền đen, ảnh contain,
 * header mờ nút đóng + title. Dùng cho certificate photo, ID card, evidence…
 * Navigation params: { uri, title, headers? } (RN) + mở rộng web: { images, index }
 * để vuốt qua nhiều ảnh (scroll-snap).
 *
 * B5: param `headers` (optional) — ảnh cần auth (vd: GET /api/tracking/verification-checks/<id>/photo/
 * phải kèm Authorization: Bearer <token>). RN dùng expo-image headers trong source;
 * web KHÔNG hỗ trợ header cho <img> → fetch blob URL (cùng cách fetchVerificationPhotoUrl
 * trong @/api/tracking) rồi gắn vào src. Backward compat: { uri, title } vẫn hoạt động.
 *
 * Khác biệt platform (ghi mobile-parity-map.md):
 * - expo-image resizeMode="contain" + onLoadStart/onLoad/onError → <img> objectFit
 *   contain + onLoad/onError.
 * - Dimensions.get('window') → 100% / calc(100dvh - 100px).
 * - Swipe nhiều ảnh: scroll-snap ngang (web) — RN chỉ xem 1 ảnh/lần mở.
 * - Nút đóng: RN navigation.goBack() → nav.closeModal() khi đang là modal
 *   (fallback goBack nếu render trong stack).
 * - Icon thiếu glyph (image-outline) → images-outline gần nhất (ic()).
 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import Icon from "@/components/Icon";
import { Touchable, Spinner, Screen } from "@/components/ui";
import { COLORS, TYPO } from "@/theme";
import { useNav } from "@/navigation/router";
import { RENDER_ORIGIN } from "@/api/client";
import storage from "@/utils/storage";

const ic = (name: string) =>
  (
    {
      "image-outline": "images-outline",
    } as Record<string, string>
  )[name] ?? name;

/** URL tuyệt đối cho ảnh (RN truyền URL đầy đủ; hỗ trợ thêm path tương đối) */
const resolveSrc = (u: string): string => {
  if (!u) return "";
  if (u.startsWith("blob:") || u.startsWith("data:") || u.startsWith("http://") || u.startsWith("https://")) return u;
  return `${RENDER_ORIGIN}${u.startsWith("/") ? "" : "/"}${u}`;
};

/** GET ảnh cần Bearer → blob URL (tham khảo fetchVerificationPhotoUrl @/api/tracking) */
async function fetchAuthBlobUrl(u: string): Promise<string> {
  const token = await storage.getItem("access_token");
  const res = await fetch(resolveSrc(u), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

interface ImagePreviewScreenProps {
  uri?: string;
  title?: string;
  headers?: Record<string, string>;
  /** Web mở rộng: danh sách ảnh để vuốt qua (scroll-snap) */
  images?: string[];
  /** Index ảnh khởi tạo khi truyền `images` */
  index?: number;
}

const ImagePreviewScreen: React.FC<ImagePreviewScreenProps> = ({ uri, title, headers, images, index = 0 }) => {
  const nav = useNav();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [blobSources, setBlobSources] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Danh sách ảnh nguồn: ưu tiên `images`, fallback [uri]
  const rawSources: string[] = (images && images.length > 0 ? images : uri ? [uri] : []).filter(Boolean);

  // Ảnh cần auth (headers param của RN, hoặc ảnh /api cần Bearer) → fetch blob
  const needsAuth = !!headers && rawSources.length > 0;

  useEffect(() => {
    if (rawSources.length === 0) {
      setIsLoading(false);
      return undefined;
    }
    if (!needsAuth) {
      setBlobSources([]);
      setIsLoading(true);
      setError(false);
      return undefined;
    }
    let cancelled = false;
    const created: string[] = [];
    (async () => {
      setIsLoading(true);
      setError(false);
      try {
        const urls = await Promise.all(rawSources.map((u) => fetchAuthBlobUrl(u)));
        if (cancelled) {
          urls.forEach((u) => URL.revokeObjectURL(u));
          return;
        }
        created.push(...urls);
        setBlobSources(urls);
        setIsLoading(false);
      } catch (e) {
        if (!cancelled) {
          setError(true);
          setIsLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
      created.forEach((u) => URL.revokeObjectURL(u));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsAuth, rawSources.join("|")]);

  // Bắt đầu ở ảnh `index` (khi truyền images + index)
  useEffect(() => {
    if (rawSources.length > 1 && scrollRef.current && index > 0) {
      const w = scrollRef.current.clientWidth || window.innerWidth;
      scrollRef.current.scrollTo({ left: index * w, behavior: "auto" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blobSources.length, rawSources.length]);

  const sources = needsAuth ? blobSources : rawSources.map((u) => resolveSrc(u));

  const close = useCallback(() => {
    if (nav.state.modal?.name === "ImagePreview") nav.closeModal();
    else nav.goBack();
  }, [nav]);

  // Không có ảnh để hiển thị (RN: !uri branch)
  if (rawSources.length === 0) {
    return (
      <Screen bg="#000000" scroll={false}>
        <div style={S.header}>
          <Touchable onPress={close} style={S.backBtn}>
            <Icon name="close" size={24} color="#fff" />
          </Touchable>
          <span style={{ ...S.headerTitle, color: "#fff" }}>{title || "Ảnh"}</span>
        </div>
        <div style={S.emptyState}>
          <Icon name={ic("image-outline")} size={48} color={COLORS.textMuted} />
          <span style={{ ...S.emptyText, color: COLORS.textMuted }}>Không có ảnh để hiển thị</span>
        </div>
      </Screen>
    );
  }

  return (
    <Screen bg="#000000" scroll={false}>
      <div style={S.header}>
        <Touchable onPress={close} style={S.backBtn}>
          <Icon name="close" size={24} color="#fff" />
        </Touchable>
        <span style={{ ...S.headerTitle, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {title || "Xem ảnh"}
        </span>
      </div>

      <div style={S.imageWrap}>
        {isLoading && !error && (
          <span style={S.loader}>
            <Spinner size={36} color={COLORS.primary} />
          </span>
        )}
        {error ? (
          <div style={S.errorState}>
            <Icon name="alert-circle" size={48} color={COLORS.error} />
            <span style={{ ...S.errorText, color: COLORS.error }}>Không tải được ảnh</span>
            <span
              style={{
                ...TYPO.caption,
                color: COLORS.textMuted,
                textAlign: "center",
                wordBreak: "break-all",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {uri || rawSources.join(", ")}
            </span>
          </div>
        ) : (
          <div
            ref={scrollRef}
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              flexDirection: "row",
              overflowX: sources.length > 1 ? "auto" : "hidden",
              overflowY: "hidden",
              scrollSnapType: sources.length > 1 ? "x mandatory" : undefined,
              scrollbarWidth: "none",
            }}
          >
            {sources.map((src, i) => (
              <div
                key={`${src}-${i}`}
                style={{
                  flex: "0 0 100%",
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  scrollSnapAlign: "center",
                }}
              >
                <img
                  src={src}
                  alt={title || `Ảnh ${i + 1}`}
                  style={S.image}
                  onLoad={() => setIsLoading(false)}
                  onError={() => {
                    setError(true);
                    setIsLoading(false);
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </Screen>
  );
};

const S: Record<string, React.CSSProperties> = {
  header: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: "12px 16px 12px",
    background: "rgba(0,0,0,0.8)",
    position: "relative",
    zIndex: 2,
  },
  backBtn: { padding: 4, flexShrink: 0 },
  headerTitle: { ...TYPO.h5, fontWeight: 700, flex: 1 },
  imageWrap: {
    flex: 1,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    minHeight: 0,
  },
  image: {
    width: "100%",
    height: "calc(100dvh - 100px)",
    objectFit: "contain",
  },
  loader: { position: "absolute", zIndex: 1 },
  emptyState: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  emptyText: { ...TYPO.body },
  errorState: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    padding: 20,
  },
  errorText: { ...TYPO.h5 },
};

export default ImagePreviewScreen;
