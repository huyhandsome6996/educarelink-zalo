/** Tự sinh từ dang_viec_gia_su.html — KHÔNG sửa tay, chạy build_cdn_css.py */
var cfg = {
      theme: {
        extend: {
          fontFamily: {
            manrope: ['Manrope', 'sans-serif'],
            sans: ['Plus Jakarta Sans', 'sans-serif'],
          },
          colors: {
            brand: {
              50: '#FFF7ED',
              100: '#FFEDD5',
              500: '#F26522',
              600: '#E05315',
              700: '#C2410C',
              tint: 'rgba(242, 101, 34, 0.08)',
              subtle: 'rgba(242, 101, 34, 0.12)'
            },
            obsidian: {
              900: '#1A1A2E',
              800: '#232338',
              700: '#334155'
            }
          },
          boxShadow: {
            'subtle': '0 2px 10px rgba(0, 0, 0, 0.04), 0 1px 3px rgba(0, 0, 0, 0.02)',
            'card': '0 8px 30px rgba(0,0,0,0.04)',
            'elevated': '0 16px 40px -12px rgba(242, 101, 34, 0.2)'
          },
          animation: {
            'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            'ping-slow': 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite',
            'ripple': 'ripple 2s linear infinite',
          },
          keyframes: {
            ripple: {
              '0%': { transform: 'scale(0.8)', opacity: '0.9' },
              '100%': { transform: 'scale(2.4)', opacity: '0' },
            }
          }
        }
      }
    };
cfg.content = ["/home/z/my-project/work/educarelink-zalo/src/public/pages/dang-viec-gia-su.html"];
cfg.plugins = cfg.plugins || [];
module.exports = cfg;
