/** Tự sinh từ parent_home.html — KHÔNG sửa tay, chạy build_cdn_css.py */
var cfg = {
            theme: {
                extend: {
                    colors: {
                        primary: '#F26522',
                        primaryDark: '#D4541E',
                        primaryLight: '#FFF4ED',
                        primarySoft: '#FED7AA',
                        secondary: '#0E9F6E',
                        secondaryDark: '#047857',
                        secondaryLight: '#ECFDF5',
                        info: '#2563EB',
                        infoLight: '#EFF6FF',
                        warning: '#F59E0B',
                        error: '#EF4444',
                        errorBg: '#FEF2F2',
                        textPrimary: '#1A1A2E',
                        textSecondary: '#6B7280',
                        textMuted: '#9CA3AF',
                        surface: '#FFFFFF',
                        background: '#F8F9FB',
                        border: '#E5E7EB',
                        divider: '#F3F4F6'
                    },
                    fontFamily: {
                        headline: ['Manrope', 'sans-serif'],
                        sans: ['"Plus Jakarta Sans"', 'sans-serif']
                    },
                    boxShadow: {
                        'card-rest': '0 2px 14px rgba(26, 26, 46, 0.04)',
                        'card-hover': '0 12px 28px rgba(26, 26, 46, 0.08)',
                        'cta-glow': '0 10px 25px -5px rgba(242, 101, 34, 0.3)'
                    }
                }
            }
        };
cfg.content = ["src/public/pages/parent-home.html"];
cfg.plugins = cfg.plugins || [];
module.exports = cfg;
