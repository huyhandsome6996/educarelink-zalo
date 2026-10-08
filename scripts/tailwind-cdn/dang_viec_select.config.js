/** Tự sinh từ dang_viec_select.html — KHÔNG sửa tay, chạy build_cdn_css.py */
var cfg = {
      theme: {
        extend: {
          fontFamily: {
            manrope: ['Manrope', 'sans-serif'],
            sans: ['"Plus Jakarta Sans"', 'sans-serif'],
          },
          colors: {
            brand: '#F26522',
            surface: '#FFFFFF',
            border: '#E5E7EB',
            tutoring: {
              DEFAULT: '#F26522',
              hover: '#EA580C',
              bg: '#FFF4ED',
              border: '#FED7AA',
              dark: '#9A3412',
            },
            childcare: {
              DEFAULT: '#0E9F6E',
              hover: '#047857',
              bg: '#ECFDF5',
              border: '#A7F3D0',
              dark: '#065F46',
            },
            pickup: {
              DEFAULT: '#2563EB',
              hover: '#1D4ED8',
              bg: '#EFF6FF',
              border: '#BFDBFE',
              dark: '#1E40AF',
            }
          }
        }
      }
    };
cfg.content = ["src/public/pages/dang-viec-select.html"];
cfg.plugins = cfg.plugins || [];
module.exports = cfg;
