/* ============================================================
 * EduCareLink Zalo Mini App — Bootstrap môi trường
 * Được compiler (scripts/port_pages.py) chèn vào <head> mọi trang.
 * Nhiệm vụ:
 *  1) Đặt API origin: dev -> proxy tương đối (vite), prod -> Render
 *  2) __edcToPage(): map path Django -> file .html (dùng cho next=…)
 *  3) Relay lỗi JS về shell để debug qua Zalo Console
 *  4) Bảo vệ localStorage (webview riêng tư)
 * ============================================================ */
(function () {
  'use strict';

  var IS_DEV = location.hostname === 'localhost' ||
    location.hostname === '127.0.0.1' || location.hostname === '';

  /* 1) API origin — giữ nguyên hành vi gốc:
     - dev: fetch('/api/..') đi qua vite proxy -> không CORS
     - prod (mini app trên Zalo): gọi trực tiếp Render */
  window.__API_ORIGIN = IS_DEV ? '' : 'https://educarelink-backend.onrender.com';
  window.API_BASE = window.__API_ORIGIN + '/api';

  /* 1b) Bọc fetch toàn cục (fix P0-2 audit 08/10/2026): các file JS dùng chung
     trong static/js (notification_sound, job_assigned_alert, worker_gps_heartbeat,
     worker_shift_heartbeat, worker_profile_tier_b4...) vẫn gọi '/api/...' tương
     đối — ở prod webview resolve theo origin trang tĩnh -> chết. Wrapper chỉ đổi
     string bắt đầu đúng bằng '/api/'; Request/URL tuyệt đối passthrough nguyên vẹn. */
  (function () {
    var rawFetch = window.fetch ? window.fetch.bind(window) : null;
    if (!rawFetch) return; // webview quá cũ — giữ hành vi cũ
    window.fetch = function (input, init) {
      try {
        if (typeof input === 'string' && input.lastIndexOf('/api/', 0) === 0) {
          input = window.API_BASE + input.slice(4); // '/api/x' -> '<origin>/api/x'
        }
      } catch (e) { /* lỗi chuẩn bị input: gọi như cũ */ }
      return rawFetch(input, init);
    };
  })();

  /* 2) Map path Django -> trang html tĩnh (đồng bộ scripts/port_pages.py) */
  var ROUTES = {
    '/': 'splash.html', '/landing/': 'landing.html',
    '/login/': 'login.html', '/register/': 'register.html',
    '/onboarding/parent/': 'onboarding-parent.html', '/onboarding/worker/': 'onboarding-worker.html',
    '/parent/': 'parent-home.html', '/parent/create-1/': 'task-create-1.html',
    '/parent/create-2/': 'task-create-2.html', '/parent/tasks/': 'parent-tasks.html',
    '/parent/task-detail/': 'parent-task-detail.html', '/parent/candidate-profile/': 'parent-candidate-profile.html',
    '/parent/browse-candidates/': 'browse-candidates.html', '/parent/chatbot/': 'chatbot.html',
    '/parent/review/': 'review.html', '/parent/profile/': 'parent-profile.html',
    '/parent/care-diary/': 'parent-care-diary-detail.html', '/parent/care-diary-history/': 'parent-care-diary-history.html',
    '/parent/tracking/': 'tracking.html', '/parent/payments/': 'parent-payments.html',
    '/worker/': 'worker-feed.html', '/worker/task-detail/': 'task-detail.html',
    '/worker/my-jobs/': 'worker-jobs.html', '/worker/profile/': 'worker-profile.html',
    '/worker/availability/': 'worker-availability.html', '/worker/chatbot/': 'worker-chatbot.html',
    '/worker/help-center/': 'help-center.html', '/worker/care-diary/': 'worker-care-diary-form.html',
    '/worker/complaints/': 'worker-complaints.html', '/worker/earnings/': 'worker-earnings.html',
    '/chat/': 'chat.html', '/notifications/': 'notifications.html',
    '/dang-viec/': 'dang-viec-select.html', '/dang-viec/gia-su/': 'dang-viec-gia-su.html',
    '/dang-viec/trong-tre/': 'dang-viec-trong-tre.html', '/dang-viec/don-tre/': 'dang-viec-don-tre.html',
    '/ung-vien/': 'ung-vien.html', '/don/': 'don.html', '/khang-cao/': 'khang-cao.html',
    '/vi-credit/': 'vi-credit.html', '/lich-ranh/': 'lich-ranh.html', '/ngay-ban/': 'ngay-ban.html',
    '/don-cua-toi/': 'don-cua-toi.html', '/admin-dashboard/': 'admin-dashboard.html',
    '/site-gate/': 'site-gate.html'
  };

  /* Route CÓ tham số THẬT (khớp frontend/urls.py: /ung-vien/<id>/, /don/<id>/,
     /khang-cao/<id>/) — dùng whitelist, KHÔNG đoán (fix P1-4 audit: bản cũ nuốt
     mọi path 2 đoạn thành id, /parent/tasks/ -> parent-home.html?id=tasks). */
  var PARAM_PAGES = {
    '/ung-vien/': 'ung-vien.html',
    '/don/': 'don.html',
    '/khang-cao/': 'khang-cao.html'
  };

  window.__edcToPage = function (url) {
    if (!url || typeof url !== 'string') return url;
    if (/^(https?:|tel:|mailto:|data:|#|\/\/)/.test(url)) return url;
    if (url.indexOf('.html') >= 0) return url;

    /* Tách hash TRƯỚC, rồi query — giữ nguyên cả hai (fix P1-4) */
    var hi = url.indexOf('#');
    var hash = hi >= 0 ? url.slice(hi) : '';
    var rest = hi >= 0 ? url.slice(0, hi) : url;
    var qi = rest.indexOf('?');
    var search = qi >= 0 ? rest.slice(qi) : ''; // luôn bắt đầu bằng '?' nếu có
    var path = qi >= 0 ? rest.slice(0, qi) : rest;
    if (path.charAt(path.length - 1) !== '/') path += '/';

    /* 1) ROUTE TĨNH ƯU TIÊN: /parent/tasks/ -> parent-tasks.html?page=2 */
    if (ROUTES[path]) return ROUTES[path] + search + hash;

    /* 2) ROUTE THAM SỐ — chỉ prefix trong whitelist; id encode; query nối '&' */
    var m = path.match(/^\/([a-z0-9-]+)\/([^/]+)\/$/);
    if (m && PARAM_PAGES['/' + m[1] + '/']) {
      var extra = search ? '&' + search.slice(1) : '';
      return PARAM_PAGES['/' + m[1] + '/'] +
        '?id=' + encodeURIComponent(m[2]) + extra + hash;
    }

    /* Không rõ — trả nguyên vẹn (không tự chế trang) */
    return url;
  };

  /* 3) Relay lỗi về shell */
  function relay(type, msg) {
    try { parent.postMessage({ type: type, page: location.pathname, msg: String(msg).slice(0, 300) }, '*'); } catch (e) { /* bỏ qua */ }
  }
  window.addEventListener('error', function (e) { relay('edc-error', (e && e.message) || e); });
  window.addEventListener('unhandledrejection', function (e) { relay('edc-error', 'Promise: ' + ((e && e.reason) || '')); });

  /* 4) localStorage an toàn: nếu webview chặn -> shim in-memory
     (tránh crash toàn trang, đăng nhập sẽ cần đăng nhập lại mỗi phiên) */
  try {
    localStorage.setItem('__edc_probe__', '1');
    localStorage.removeItem('__edc_probe__');
  } catch (e) {
    var mem = {};
    var shim = {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
      setItem: function (k, v) { mem[k] = String(v); },
      removeItem: function (k) { delete mem[k]; },
      clear: function () { mem = {}; },
      key: function (i) { return Object.keys(mem)[i] || null; }
    };
    Object.defineProperty(shim, 'length', { get: function () { return Object.keys(mem).length; } });
    try { window.localStorage = shim; } catch (e2) { /* im lặng */ }
  }
})();
