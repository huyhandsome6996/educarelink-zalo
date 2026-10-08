#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Dev server cho EduCareLink Zalo Mini App (mô phỏng môi trường mini app):
- Serve tĩnh từ src/www (nơi vite build xuất ra)
- Proxy /api/* -> https://educarelink-backend.onrender.com/api/* (giống vite proxy)
Chạy: python3 scripts/dev_server.py [port]  (mặc định 3000)
"""
import http.server
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

WWW = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src", "www")
UPSTREAM = "https://educarelink-backend.onrender.com"
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 3000


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=os.path.abspath(WWW), **kw)

    def log_message(self, fmt, *args):
        sys.stderr.write("[%d] %s\n" % (PORT, fmt % args))

    # ---- proxy /api và /static (chưa có) -> Render ----
    def _proxy(self):
        length = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(length) if length else None
        url = UPSTREAM + self.path
        req = urllib.request.Request(url, data=body, method=self.command)
        for h in ("Content-Type", "Authorization", "Accept"):
            v = self.headers.get(h)
            if v:
                req.add_header(h, v)
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                data = r.read()
                self.send_response(r.status)
                for k, v in r.getheaders():
                    if k.lower() in ("content-type", "cache-control"):
                        self.send_header(k, v)
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                if self.command != "HEAD":
                    self.wfile.write(data)
        except urllib.error.HTTPError as e:
            data = e.read()
            self.send_response(e.code)
            ct = e.headers.get("Content-Type", "application/json")
            self.send_header("Content-Type", ct)
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        except Exception as e:  # noqa
            msg = str(e).encode()
            self.send_response(502)
            self.send_header("Content-Type", "text/plain")
            self.send_header("Content-Length", str(len(msg)))
            self.end_headers()
            self.wfile.write(msg)

    def do_GET(self):
        if self.path.startswith("/api/"):
            return self._proxy()
        return super().do_GET()

    def do_POST(self):
        if self.path.startswith("/api/"):
            return self._proxy()
        self.send_response(405)
        self.end_headers()

    def do_PATCH(self):
        if self.path.startswith("/api/"):
            return self._proxy()
        self.send_response(405)
        self.end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,PATCH,PUT,DELETE,OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.end_headers()

    def do_PUT(self):
        if self.path.startswith("/api/"):
            return self._proxy()
        self.send_response(405)
        self.end_headers()

    def do_DELETE(self):
        if self.path.startswith("/api/"):
            return self._proxy()
        self.send_response(405)
        self.end_headers()

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        super().end_headers()


if __name__ == "__main__":
    os.chdir(os.path.abspath(WWW))
    http.server.ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
