const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert/strict');
const root = path.resolve(process.argv[2]);
let pages = 0;
let scripts = 0;
for (const name of fs.readdirSync(path.join(root, 'pages'))) {
  const file = path.join(root, 'pages', name);
  const html = fs.readFileSync(file, 'utf8');
  assert(!/{%[\s\S]*?%}/.test(html), name + ': còn Django tag');
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (/\bsrc=|application\/ld\+json|application\/json/.test(match[1])) continue;
    new vm.Script(match[2], {filename: name});
    scripts++;
  }
  for (const match of html.matchAll(/(?:src|href)=["'](\.\.\/static\/[^"']+|[a-z-]+\.html(?:[?#][^"']*)?)["']/g)) {
    const target = match[1].split(/[?#]/)[0];
    assert(fs.existsSync(path.resolve(path.dirname(file), target)), name + ': thiếu ' + target);
  }
  pages++;
}
const bootstrap = fs.readFileSync(path.join(root, 'static/js/edc-bootstrap.js'), 'utf8');
const data = new Map();
const storage = {
  getItem: key => data.get(key) ?? null,
  setItem: (key, value) => data.set(key, String(value)),
  removeItem: key => data.delete(key),
  clear: () => data.clear(),
};
const calls = [];
const parent = {__edcNativeStorage: storage, postMessage() {}};
function frame() {
  const context = {
    location: {hostname: 'h5.zdn.vn', pathname: '/pages/login.html'},
    parent, Request, URL, console,
    fetch: (input, init) => { calls.push({input, init}); return Promise.resolve({ok:true}); },
    addEventListener() {},
  };
  context.window = context;
  vm.runInNewContext(bootstrap, context);
  return context;
}
const first = frame();
first.__edcStorage.setItem('token', 'test-token');
const next = frame();
assert.equal(next.__edcStorage.getItem('token'), 'test-token');
next.fetch('/api/profile/', {headers:{Authorization:'Bearer test-token'}});
assert.equal(calls[0].input, 'https://educarelink-backend.onrender.com/api/profile/');
assert.equal(calls[0].init.headers.Authorization, 'Bearer test-token');
console.log(JSON.stringify({pages, inlineScripts: scripts, localReferences:'ok', nativeStorageAcrossPages:'ok', apiRouting:'ok'}));
