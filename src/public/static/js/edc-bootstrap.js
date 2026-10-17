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

  var hostname = window.__edcHost || location.hostname;
  var IS_DEV = hostname === 'localhost' ||
    hostname === '127.0.0.1' || hostname === '';

  /* 1) API origin — giữ nguyên hành vi gốc:
     - dev: fetch('/api/..') đi qua vite proxy -> không CORS
     - prod (mini app trên Zalo): gọi trực tiếp Render */
  window.__API_ORIGIN = IS_DEV ? '' : 'https://educarelink-backend.onrender.com';
  window.API_BASE = window.__API_ORIGIN + '/api';

  // Các script dùng chung từ web gốc cũng gọi API bằng đường dẫn tương đối.
  // Trên Zalo, giữ nguyên request nhưng chuyển đích API/media về backend thật.
  var originalFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : input && input.url;
    if (url && /^\/(api|media)\//.test(url) && window.__API_ORIGIN) {
      var target = window.__API_ORIGIN + url;
      input = typeof input === 'string' ? target : new Request(target, input);
    }
    return originalFetch(input, init);
  };

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

  // Navigation trên srcdoc được chuyển về shell, vì CDN Zalo không phục vụ HTML.
  var pageURL = new URL(window.__edcPageURL || location.href || 'https://h5.zdn.vn/');
  function navigate(url, replace) {
    url = String(url);
    if (url.charAt(0) === '#') {
      pageURL.hash = url;
      var element = document.getElementById(decodeURIComponent(url.slice(1)));
      if (element) element.scrollIntoView();
      return;
    }
    var mapped = window.__edcToPage(url);
    var resolved = new URL(mapped, pageURL);
    if (resolved.origin === pageURL.origin && /\/pages\/[a-z0-9-]+\.html$/.test(resolved.pathname)) {
      parent.postMessage({type:'edc-navigate', url:resolved.pathname.split('/pages/')[1] + resolved.search + resolved.hash, replace:!!replace}, '*');
    } else {
      parent.postMessage({type:'edc-external', url:resolved.href}, '*');
    }
  }
  var virtualLocation = {
    assign: function (url) { navigate(url, false); },
    replace: function (url) { navigate(url, true); },
    reload: function () { parent.postMessage({type:'edc-navigate', reload:true}, '*'); },
    toString: function () { return pageURL.href; }
  };
  ['href','search','pathname','hash','origin','protocol','host','hostname','port'].forEach(function (key) {
    Object.defineProperty(virtualLocation, key, {
      get: function () { return pageURL[key]; },
      set: function (value) {
        if (key === 'href') navigate(value, false);
        else if (key === 'hash') navigate(value.charAt(0) === '#' ? value : '#' + value, true);
        else { var next = new URL(pageURL.href); next[key] = value; navigate(next.href, false); }
      }
    });
  });
  window.__edcLocation = virtualLocation;
  document.addEventListener('click', function (event) {
    var link = event.target.closest && event.target.closest('a[href]');
    if (!link || event.ctrlKey || event.metaKey || event.shiftKey || event.button > 0) return;
    var href = link.getAttribute('href');
    if (!href || href === '#' || /^javascript:/i.test(href)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    navigate(href, false);
  }, true);

  /* 3) Relay lỗi về shell */
  function relay(type, msg) {
    try { parent.postMessage({ type: type, page: location.pathname, msg: String(msg).slice(0, 300) }, '*'); } catch (e) { /* bỏ qua */ }
  }
  window.addEventListener('error', function (e) { relay('edc-error', (e && e.message) || e); });
  window.addEventListener('unhandledrejection', function (e) { relay('edc-error', 'Promise: ' + ((e && e.reason) || '')); });

  /* 4) Dùng Native Storage từ shell; trình duyệt dev giữ Local Storage.
     Memory dự phòng chia sẻ qua shell để đổi trang không mất phiên. */
  try {
    var storage = !IS_DEV && parent.__edcNativeStorage
      ? parent.__edcNativeStorage : window.localStorage;
    storage.setItem('__edc_probe__', '1');
    storage.removeItem('__edc_probe__');
    window.__edcStorage = storage;
  } catch (e) {
    var mem;
    try {
      mem = parent.__edcMemory || (parent.__edcMemory = {});
    } catch (e2) { mem = {}; }
    var shim = {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
      setItem: function (k, v) { mem[k] = String(v); },
      removeItem: function (k) { delete mem[k]; },
      clear: function () { Object.keys(mem).forEach(function (k) { delete mem[k]; }); },
      key: function (i) { return Object.keys(mem)[i] || null; }
    };
    Object.defineProperty(shim, 'length', { get: function () { return Object.keys(mem).length; } });
    window.__edcStorage = shim;
  }
})();
