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

  window.__edcToPage = function (url) {
    if (!url || typeof url !== 'string') return url;
    if (/^(https?:|tel:|mailto:|data:|#|\/\/)/.test(url)) return url;
    if (url.indexOf('.html') >= 0) return url;
    var q = '';
    var qi = url.indexOf('?');
    if (qi >= 0) { q = url.slice(qi); url = url.slice(0, qi); }
    if (url.charAt(url.length - 1) !== '/') url += '/';
    var m = url.match(/^(\/[a-z0-9-]+)\/([^/]+)\/$/);
    if (m && ROUTES[m[1] + '/']) {
      // path có tham số: /ung-vien/<id>/ -> ung-vien.html?id=<id>
      return ROUTES[m[1] + '/'] + '?id=' + encodeURIComponent(m[2]) + q;
    }
    if (ROUTES[url]) return ROUTES[url] + q;
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
