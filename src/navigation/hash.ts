/** Hash utilities — thuần JS (không React) để unit-test trực tiếp bằng esbuild transform. */

export interface ParsedHash {
  tab?: string;
  route?: string;
  params: Record<string, any>;
}

/** parse "#/ParentHome/CandidatesList?jobId=3" -> {tab, route, params} */
export function parseHash(hash: string): ParsedHash {
  const raw = hash.replace(/^#\/?/, "");
  if (!raw) return { params: {} };
  const [pathPart, queryPart] = raw.split("?");
  const params: Record<string, any> = {};
  if (queryPart) {
    for (const pair of queryPart.split("&")) {
      const [k, v] = pair.split("=");
      if (k) params[decodeURIComponent(k)] = v !== undefined ? decodeURIComponent(v) : "";
    }
  }
  const segs = pathPart.split("/").filter(Boolean);
  if (segs.length === 0) return { params };
  if (segs.length === 1) return { route: segs[0], params };
  return { tab: segs[0], route: segs[1], params };
}

export function buildHash(tab: string, route: string, params?: Record<string, any>): string {
  let h = `#/${tab}/${route}`;
  if (params && Object.keys(params).length) {
    const qs = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join("&");
    if (qs) h += `?${qs}`;
  }
  return h;
}
