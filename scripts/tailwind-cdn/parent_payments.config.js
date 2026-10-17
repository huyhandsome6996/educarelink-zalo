/** Tự sinh từ parent_payments.html — KHÔNG sửa tay, chạy build_cdn_css.py */
module.exports = { content: ["./src/public/pages/parent-payments.html"] };
var shared = require('../upstream-tailwind/shared-theme');
var theme = module.exports.theme = module.exports.theme || {};
var ext = theme.extend = theme.extend || {};
ext.colors = Object.assign({}, shared.colors, ext.colors || {});
ext.fontFamily = Object.assign({}, shared.fontFamily, ext.fontFamily || {});
