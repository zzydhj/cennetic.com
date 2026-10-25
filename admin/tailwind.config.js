/** @type {import('tailwindcss').Config} */
export default {
    content: ['./index.html', './src/**/*.{ts,tsx}'],
    theme: {
        extend: {
            colors: {
                /*
                 * 主色取前台 logo 的同一支藏青（#012760），前后端视觉同源。
                 * 700 是 logo 原色，DEFAULT 与 700 同值，写 bg-brand 即品牌色。
                 */
                brand: {
                    DEFAULT: '#012760',
                    50: '#eff4fb',
                    100: '#dbe6f5',
                    200: '#b6cbe9',
                    300: '#8aa9d8',
                    400: '#5b83c2',
                    500: '#37619f',
                    600: '#234a83',
                    700: '#012760',
                    800: '#041c44',
                    900: '#07152f',
                },
                /* 深色导航栏专用的冷墨色：比 brand-900 更中性，避免整栏发蓝 */
                ink: {
                    DEFAULT: '#0b1220',
                    600: '#26355a',
                    700: '#1b2740',
                    800: '#111a2c',
                    900: '#0b1220',
                    950: '#060b16',
                },
                /* 强调红：与前台 --color-brand 同源，只用于极少数的行动点与告警 */
                accent: { DEFAULT: '#c8102e', soft: '#fdecef' },
                /* 香槟金：只用在「企业版/发布流水线」这类尊享语义上，宁缺毋滥 */
                gold: { DEFAULT: '#a1741c', soft: '#fdf6e6', 300: '#e3c98a', 500: '#c1902c', 600: '#a1741c', 700: '#7c5813' },
                canvas: '#eef1f7',
            },
            fontFamily: {
                /* 拉丁字用 Albert Sans（数字与英文标题的质感来源），中文回落系统黑体 */
                sans: ['"Albert Sans"', 'ui-sans-serif', 'system-ui', '-apple-system', '"Segoe UI"', '"PingFang SC"', '"Microsoft YaHei"', 'sans-serif'],
                mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', '"Courier New"', 'monospace'],
            },
            fontSize: {
                /* 仪表盘大数字：比 text-3xl 更收、更重，读数感 */
                stat: ['1.75rem', { lineHeight: '1.1', letterSpacing: '-0.035em', fontWeight: '700' }],
            },
            boxShadow: {
                /* 四层阴影：细边 + 近距贴合 + 远距扩散，才有「厚卡片」的分量 */
                card: '0 0 0 1px rgba(15,23,42,.04), 0 1px 2px rgba(15,23,42,.04), 0 6px 16px -8px rgba(15,23,42,.10)',
                lift: '0 0 0 1px rgba(15,23,42,.05), 0 2px 4px rgba(15,23,42,.05), 0 18px 40px -18px rgba(15,23,42,.26)',
                pop: '0 0 0 1px rgba(15,23,42,.05), 0 24px 60px -24px rgba(11,18,32,.42), 0 6px 16px -8px rgba(11,18,32,.16)',
                glow: '0 8px 28px -10px rgba(55,97,159,.55)',
                gold: '0 8px 28px -12px rgba(161,116,28,.55)',
                rail: 'inset -1px 0 0 rgba(255,255,255,.06)',
                inner: 'inset 0 1px 0 rgba(255,255,255,.75)',
            },
            backgroundImage: {
                /* 深色导航栏：左上角一处品牌蓝的辉光，其余走墨黑，比纯渐变耐看 */
                rail: 'radial-gradient(120% 55% at 0% 0%, rgba(55,97,159,.42) 0%, rgba(6,11,22,0) 58%), linear-gradient(180deg, #060b16 0%, #0b1a3a 42%, #060b16 100%)',
                /* 画布网纹：登录页/品牌板的细网格（命名避开 bg-grid 这类与 backgroundSize 冲突的键） */
                mesh: 'linear-gradient(rgba(255,255,255,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.06) 1px, transparent 1px)',
                /* 登录页品牌板：斜切光束 */
                beam: 'linear-gradient(135deg, rgba(255,255,255,.10) 0%, rgba(255,255,255,0) 42%, rgba(255,255,255,0) 58%, rgba(255,255,255,.06) 100%)',
                cardTop: 'linear-gradient(180deg, #fcfdff, #f7f9fc)',
            },
            transitionTimingFunction: {
                expo: 'cubic-bezier(.16,1,.3,1)',
                spring: 'cubic-bezier(.34,1.56,.64,1)',
            },
            keyframes: {
                'fade-up': { from: { opacity: '0', transform: 'translateY(10px)' }, to: { opacity: '1', transform: 'none' } },
                'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
                'pop-in': { from: { opacity: '0', transform: 'scale(.96) translateY(6px)' }, to: { opacity: '1', transform: 'none' } },
                'slide-in': { from: { opacity: '0', transform: 'translateX(16px)' }, to: { opacity: '1', transform: 'none' } },
                shimmer: { from: { backgroundPosition: '-150% 0' }, to: { backgroundPosition: '150% 0' } },
                'grow-x': { from: { transform: 'scaleX(0)' }, to: { transform: 'scaleX(1)' } },
                'ping-soft': { '0%': { transform: 'scale(1)', opacity: '.7' }, '70%,100%': { transform: 'scale(2.4)', opacity: '0' } },
                sweep: { from: { transform: 'translateX(-100%)' }, to: { transform: 'translateX(220%)' } },
            },
            animation: {
                /* 页面入场不能用 both：被保留的 transform 会让这层变成 fixed 的定位基准，
                   弹层/底部动作条就会跟着滚动偏位（Modal 已 portal，这里再兜一道保险） */
                'fade-up': 'fade-up .5s cubic-bezier(.16,1,.3,1)',
                'fade-in': 'fade-in .4s ease-out both',
                'pop-in': 'pop-in .28s cubic-bezier(.16,1,.3,1) both',
                'slide-in': 'slide-in .32s cubic-bezier(.16,1,.3,1) both',
                shimmer: 'shimmer 1.6s linear infinite',
                'grow-x': 'grow-x .9s cubic-bezier(.16,1,.3,1) both',
                'ping-soft': 'ping-soft 2.4s cubic-bezier(0,0,.2,1) infinite',
                sweep: 'sweep 1.1s cubic-bezier(.16,1,.3,1)',
            },
            letterSpacing: { tightest: '-0.03em' },
        },
    },
    plugins: [],
};
