/**
 * EduCareLink Zalo Mini App — Shell
 * =================================
 * Bản thân shell KHÔNG vẽ UI. Toàn bộ giao diện là bản copy y xì
 * các trang gốc (src/public/pages/*.html) chạy trong iframe full-screen,
 * giữ nguyên 100% DOM/CSS/JS như educarelink-backend-4-12-2026.
 *
 * Shell chỉ lo phần hệ thống của Mini App:
 *  - Chừa chỗ cho status bar của Zalo
 *  - Đồng bộ route (hash <-> trang iframe)
 *  - Mở link ngoài (Google OAuth / thanh toán) qua openWebview
 *  - Nhận log lỗi từ các trang để debug
 */
import React, { useCallback, useEffect, useRef, useState } from "react";

const PAGES_BASE = "pages/";
const DEFAULT_PAGE = PAGES_BASE + "splash.html";

/** hash hiện tại -> src cho iframe (vd "#pages/login.html" -> "pages/login.html") */
function pageFromHash(): string {
  const h = window.location.hash.replace(/^#\/?/, "");
  if (h.startsWith(PAGES_BASE) && h.includes(".html")) return h;
  return DEFAULT_PAGE;
}

function normalizeInternal(url: string): string {
  // '/login/' hoặc 'login.html' -> 'pages/login.html'
  if (/^https?:/i.test(url)) return url;
  const clean = url.replace(/^#?\/?pages\//, "").replace(/^\/+/, "");
  return PAGES_BASE + clean;
}

const SplashOverlay: React.FC<{ visible: boolean }> = ({ visible }) => (
  <div
    className="edc-splash"
    style={{ opacity: visible ? 1 : 0, pointerEvents: visible ? "auto" : "none" }}
  >
    <img src="static/images/logo.png" alt="EduCareLink" />
    <div className="edc-splash-bar">
      <div className="edc-splash-fill" />
    </div>
    <div className="edc-splash-text">Kết nối yêu thương, Nuôi dưỡng tương lai</div>
  </div>
);

const Layout: React.FC = () => {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [src, setSrc] = useState<string>(() => pageFromHash());
  const [booting, setBooting] = useState(true);
  const firstLoad = useRef(true);

  /* ---- Status bar: chừa đúng chiều cao thanh trạng thái Zalo ---- */
  useEffect(() => {
    (async () => {
      try {
        const zmp = await import("zmp-sdk/apis");
        const info = await (zmp as any).getSystemInfo();
        const h = info?.statusBarHeight ?? 0;
        document.documentElement.style.setProperty("--edc-status-bar", h + "px");
      } catch (e) {
        /* chạy ngoài Zalo (test web) -> bỏ qua */
      }
    })();
  }, []);

  /* ---- Đồng bộ hash khi iframe tự điều hướng giữa các trang ---- */
  const syncHashFromIframe = useCallback(() => {
    try {
      const win = iframeRef.current?.contentWindow;
      if (!win) return;
      const path = win.location.pathname; // .../pages/login.html
      const idx = path.indexOf(PAGES_BASE);
      if (idx < 0) return; // entry khác — bỏ qua
      const rel = path.slice(idx).replace(/^\/+/, "");
      const target = "#" + rel + win.location.search;
      if (window.location.hash !== target) {
        window.history.replaceState(null, "", target);
      }
    } catch (e) {
      /* cross-origin (không xảy ra cùng origin) */
    }
  }, []);

  const handleIframeLoad = useCallback(() => {
    setBooting(false);
    firstLoad.current = false;
    syncHashFromIframe();
  }, [syncHashFromIframe]);

  /* ---- Tin nhắn từ các trang con ---- */
  useEffect(() => {
    const onMsg = (ev: MessageEvent) => {
      const d: any = ev.data;
      if (!d || typeof d !== "object") return;
      if (d.type === "edc-error") {
        console.warn("[EduCareLink]", d.page, d.msg);
        return;
      }
      if (d.type === "edc-external" && typeof d.url === "string") {
        (async () => {
          try {
            const zmp: any = await import("zmp-sdk/apis");
            if (typeof zmp.openWebview === "function") {
              await zmp.openWebview({ url: d.url, title: "EduCareLink" });
              return;
            }
            if (typeof zmp.openOutApp === "function") {
              await zmp.openOutApp({ url: d.url });
              return;
            }
          } catch (e) { /* rơi xuống fallback */ }
          window.open(d.url, "_blank");
        })();
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  /* ---- Điều hướng hash của shell (nếu có code đổi hash) ---- */
  useEffect(() => {
    const onHash = () => {
      const next = pageFromHash();
      setSrc((cur) => (cur === next ? cur : next));
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  return (
    <div className="edc-shell">
      <SplashOverlay visible={booting} />
      <iframe
        ref={iframeRef}
        key={src}
        src={src}
        title="EduCareLink"
        className="edc-frame"
        onLoad={handleIframeLoad}
        allow="geolocation; camera; microphone; clipboard-write; autoplay"
      />
    </div>
  );
};

export default Layout;
