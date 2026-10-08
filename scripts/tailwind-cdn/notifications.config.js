/** Tự sinh từ notifications.html — KHÔNG sửa tay, chạy build_cdn_css.py */
var cfg = {
      theme: {
        extend: {
          colors: {
            primary: '#F26522',
            primaryDark: '#D4541E',
          }
        }
      }
    };
cfg.content = ["src/public/pages/notifications.html"];
cfg.plugins = cfg.plugins || [];
module.exports = cfg;
