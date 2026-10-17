/** Shell Zalo: tải trang JSON từ CDN và render nguyên giao diện web trong srcdoc. */
import React, { useEffect, useRef, useState } from "react";
import { nativeStorage } from "zmp-sdk";

(window as any).__edcNativeStorage = nativeStorage;
const BUNDLE_BASE = import.meta.env.PROD
  ? new URL(/* @vite-ignore */ "../", import.meta.url).href
  : new URL("./", window.location.href).href;
const DEFAULT_PAGE = "pages/splash.html";

function normalizeInternal(url: string): string | null {
  const route = url.replace(/^#?\/?pages\//, "").replace(/^\/+/, "");
  return /^[a-z0-9-]+\.html(?:[?#].*)?$/.test(route) ? "pages/" + route : null;
}
function pageFromHash(): string {
  return normalizeInternal(window.location.hash.replace(/^#/, "")) || DEFAULT_PAGE;
}
function pageDocument(html: string, route: string): string {
  const url = new URL(route, BUNDLE_BASE);
  const base = new URL("pages/", BUNDLE_BASE).href;
  // JSON.stringify và escape < bảo vệ nội dung script khởi tạo.
  const boot = JSON.stringify({url:url.href,host:window.location.hostname}).replace(/</g,"\\u003c");
  const setup = `<base href="${base}"><script>var edcBoot=${boot};window.__edcPageURL=edcBoot.url;window.__edcHost=edcBoot.host;</script>`;
  return html.replace(/<head>/i, "<head>" + setup);
}

const Layout: React.FC = () => {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [src, setSrc] = useState(pageFromHash);
  const [revision, setRevision] = useState(0);
  const [page, setPage] = useState<{route:string; revision:number; html:string} | null>(null);
  const [booting, setBooting] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setBooting(true);
    setError("");
    const asset = new URL(src.split(/[?#]/)[0].replace(/\.html$/, ".json"), BUNDLE_BASE);
    fetch(asset.href, {signal:controller.signal})
      .then(response => { if (!response.ok) throw new Error("Không tải được trang"); return response.json(); })
      .then(data => {
        if (typeof data.html !== "string") throw new Error("Nội dung trang không hợp lệ");
        setPage({route:src,revision,html:pageDocument(data.html,src)});
      })
      .catch(err => { if (err.name !== "AbortError") {setError("Không tải được trang. Vui lòng thử lại.");setBooting(false);} });
    return () => controller.abort();
  }, [src, revision]);

  useEffect(() => {
    (async () => {
      try {
        const zmp = await import("zmp-sdk/apis");
        const info = await (zmp as any).getSystemInfo();
        document.documentElement.style.setProperty("--edc-status-bar", (info?.statusBarHeight ?? 0) + "px");
      } catch (_) { /* trình duyệt dùng kích thước mặc định */ }
    })();
  }, []);

  useEffect(() => {
    const onMsg = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const data = event.data;
      if (!data || typeof data !== "object") return;
      if (data.type === "edc-error") {console.warn("[EduCareLink]",data.page,data.msg);return;}
      if (data.type === "edc-navigate") {
        if (data.reload) {setRevision(value => value + 1);return;}
        const next = typeof data.url === "string" ? normalizeInternal(data.url) : null;
        if (!next) return;
        setSrc(next);
        if (data.replace) window.history.replaceState(null,"","#"+next);
        else if (window.location.hash !== "#"+next) window.location.hash = "#"+next;
        return;
      }
      if (data.type === "edc-external" && typeof data.url === "string" && /^(https?:|tel:|mailto:)/i.test(data.url)) {
        (async () => {
          try {
            const zmp: any = await import("zmp-sdk/apis");
            await zmp.openWebview({url:data.url,title:"EduCareLink"});
          } catch (_) { window.open(data.url,"_blank","noopener"); }
        })();
      }
    };
    window.addEventListener("message",onMsg);
    const onHash = () => setSrc(pageFromHash());
    window.addEventListener("hashchange",onHash);
    return () => {window.removeEventListener("message",onMsg);window.removeEventListener("hashchange",onHash);};
  }, []);

  const ready = page?.route === src && page.revision === revision;
  return <div className="edc-shell">
    <div className="edc-splash" style={{opacity:booting?1:0,pointerEvents:booting?"auto":"none"}}>
      <img src={new URL("static/images/logo.png",BUNDLE_BASE).href} alt="EduCareLink"/>
      <div className="edc-splash-bar"><div className="edc-splash-fill"/></div>
      <div className="edc-splash-text">Kết nối yêu thương, Nuôi dưỡng tương lai</div>
    </div>
    {error && <div role="alert" style={{padding:24}}>{error} <button onClick={() => setRevision(value => value+1)}>Thử lại</button></div>}
    {ready && <iframe key={src+":"+revision} ref={iframeRef} srcDoc={page.html} title="EduCareLink" className="edc-frame"
      onLoad={() => setBooting(false)} allow="geolocation; camera; microphone; clipboard-write; autoplay"/>}
  </div>;
};
export default Layout;
