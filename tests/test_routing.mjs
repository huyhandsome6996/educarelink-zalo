#!/usr/bin/env node
/* Regression tests P0-2 + P1-4 (audit QA 08/10/2026)
 * Chạy:  node tests/test_routing.mjs
 * Kiểm tra __edcToPage (route tĩnh ưu tiên, whitelist tham số, query '&',
 * fragment) và fetch wrapper '/api/...' -> API_BASE của edc-bootstrap.js. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FILE = join(ROOT, 'src/public/static/js/edc-bootstrap.js');

let fails = 0;
function ok(actual, expected, label) {
  const pass = actual === expected;
  if (!pass) fails++;
  console.log((pass ? 'PASS' : 'FAIL') + ' | ' + label +
    (pass ? '' : ' | expected=' + JSON.stringify(expected) + ' actual=' + JSON.stringify(actual)));
}

function loadBootstrap(prod, rawFetch) {
  const listeners = {};
  const storage = new Map();
  const sandbox = {
    location: { hostname: prod ? 'h5.zdn.vn' : 'localhost', pathname: '/x.html' },
    parent: { postMessage() {} },
    localStorage: {
      getItem: (k) => (storage.has(k) ? storage.get(k) : null),
      setItem: (k, v) => storage.set(k, String(v)),
      removeItem: (k) => storage.delete(k),
    },
    addEventListener: (t, fn) => { listeners[t] = fn; },
  };
  if (rawFetch) sandbox.fetch = rawFetch; // fetch gốc tồn tại TRƯỚC bootstrap
  sandbox.window = sandbox;
  const fn = new Function('window', 'location', 'parent', 'localStorage',
    'addEventListener', readFileSync(FILE, 'utf8'));
  fn(sandbox.window, sandbox.location, sandbox.parent, sandbox.localStorage,
    sandbox.addEventListener);
  return sandbox;
}

/* ---------- 1) __edcToPage ở PROD ---------- */
const win = loadBootstrap(true);
const to = (u) => win.window.__edcToPage(u);

ok(to('/parent/tasks/'), 'parent-tasks.html', 'P1-4: /parent/tasks/ -> parent-tasks.html');
ok(to('/worker/my-jobs/'), 'worker-jobs.html', 'P1-4: /worker/my-jobs/ -> worker-jobs.html');
ok(to('/parent/review/'), 'review.html', 'P1-4: /parent/review/ -> review.html');
ok(to('/parent/create-1/'), 'task-create-1.html', 'route tĩnh 2 đoạn: create-1');
ok(to('/parent/candidate-profile/'), 'parent-candidate-profile.html', 'route tĩnh 2 đoạn: candidate-profile');
ok(to('/worker/chatbot/'), 'worker-chatbot.html', 'route tĩnh 2 đoạn: worker chatbot');
ok(to('/dang-viec/gia-su/'), 'dang-viec-gia-su.html', 'route tĩnh 2 đoạn: dang-viec');
ok(to('/don/abc/?mode=preview'), 'don.html?id=abc&mode=preview', 'P1-4: query nối bằng &');
ok(to('/khang-cao/77?tab=2'), 'khang-cao.html?id=77&tab=2', 'tham số + query không dấu / cuối');
ok(to('/ung-vien/abc-123/'), 'ung-vien.html?id=abc-123', 'tham số whitelist: ung-vien');
ok(to('/ung-vien/a b/'), 'ung-vien.html?id=a%20b', 'id được encode');
ok(to('/parent/tasks/?page=2#top'), 'parent-tasks.html?page=2#top', 'giữ query + fragment route tĩnh');
ok(to('/don/abc/?m=1#h'), 'don.html?id=abc&m=1#h', 'giữ query + fragment route tham số');
ok(to('/parent/'), 'parent-home.html', 'route 1 đoạn: parent');
ok(to('/'), 'splash.html', 'route gốc: /');
ok(to('/login/?next=/parent/tasks/'), 'login.html?next=/parent/tasks/', 'next= giữ nguyên chuỗi');
ok(to('/chatbot/'), '/chatbot/', 'route mơ hồ -> passthrough (không tự chế)');
ok(to('/khong-biet/xyz/'), '/khong-biet/xyz/', 'path lạ -> passthrough');
ok(to('https://a.com/x'), 'https://a.com/x', 'URL tuyệt đối passthrough');
ok(to('tel:0987'), 'tel:0987', 'tel: passthrough');
ok(to('#top'), '#top', 'hash passthrough');
ok(to('chat.html'), 'chat.html', '.html passthrough');
ok(to(''), '', 'rỗng passthrough');
ok(to(null), null, 'null passthrough');

/* ---------- 2) fetch wrapper ---------- */
const captured = [];
const win2 = loadBootstrap(true, (input, init) => {
  captured.push({ input, init });
  return Promise.resolve({ ok: true });
});
// win2.window.fetch giờ là wrapper bọc quanh rawFetch capture ở trên
await win2.window.fetch('/api/notifications/', { headers: { Authorization: 'Bearer x' } });
ok(captured[0].input, 'https://educarelink-backend.onrender.com/api/notifications/',
  'P0-2: fetch tương đối /api/... -> Render origin ở prod');
await win2.window.fetch('https://other.com/api/x');
ok(captured[1].input, 'https://other.com/api/x', 'URL tuyệt đối passthrough nguyên vẹn');
await win2.window.fetch({ url: 'https://req-object/' });
ok(captured[2].input.url, 'https://req-object/', 'Request-like object passthrough');

/* dev: giữ contract cũ (proxy tương đối) */
const cap3 = [];
const win3 = loadBootstrap(false, (input) => { cap3.push(input); return Promise.resolve({}); });
await win3.window.fetch('/api/notifications/');
ok(cap3[0], '/api/notifications/', 'dev: /api/... vẫn tương đối (proxy)');

console.log(fails === 0 ? '\nOK: toàn bộ routing/fetch tests PASS' : '\n' + fails + ' test FAIL');
process.exit(fails === 0 ? 0 : 1);
