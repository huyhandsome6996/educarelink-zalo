// CLI cần đọc app-config.json đã build ở src/www, không phải config nguồn rỗng.
const path = require('path');
const fs = require('fs');
const {execSync} = require('child_process');
let cliRoot;
try { cliRoot = path.dirname(require.resolve('zmp-cli/package.json')); }
catch (_) { cliRoot = path.join(execSync('npm root -g',{encoding:'utf8'}).trim(),'zmp-cli'); }
const env = require(path.join(cliRoot,'utils/env.js'));
const repo = process.cwd();
process.env.APP_ID = env.getEnv('APP_ID');
process.env.ZMP_TOKEN = env.getEnv('ZMP_TOKEN');
if (process.env.APP_ID !== '187194879682905673' || !process.env.ZMP_TOKEN) {
  console.error('Chạy npm run login cho Mini App EduCare 187194879682905673 trước khi deploy.');
  process.exit(1);
}
const built = path.join(repo,'src/www');
const config = JSON.parse(fs.readFileSync(path.join(built,'app-config.json'),'utf8'));
if (!config.listSyncJS?.length) throw new Error('Cần chạy npm run build trước khi deploy.');
const deploy = require(path.join(cliRoot,'deploy/index.js'));
// CLI hiện tại đổi biến này lúc import build; bật lại xác thực chứng chỉ trước I/O.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '1';
process.chdir(built);
const args = process.argv.slice(2);
const descAt = args.indexOf('--desc');
const description = descAt >= 0 ? args[descAt+1] : 'EduCareLink - đồng bộ web mới nhất';
const logger = {
  statusStart() {}, statusText() {},
  statusDone: console.log, statusError: console.error, text: console.log,
};
deploy({cwd:built,customProject:true,outputDir:'.',versionStatus:args.includes('--testing')?2:0,
  desc:description},logger);
