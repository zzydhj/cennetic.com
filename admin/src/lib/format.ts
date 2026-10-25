/**
 * 展示层格式化：数字、字节、日期、相对时间。
 * 页面里不再各写 toFixed / slice，保证「同一个数字在任何卡片里长一样」。
 */

const NF = new Intl.NumberFormat('zh-CN');

/** 千分位整数：1234 → 1,234 */
export function num(v: number | null | undefined): string {
    return v == null ? '—' : NF.format(Math.round(v));
}

/** 字节数 → 人话：1536 → 1.5 KB */
export function bytes(n: number | null | undefined): string {
    if (n == null || n <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
    const v = n / 1024 ** i;
    return `${v >= 100 || i === 0 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}

/** 百分比（0–100 的整数），分母为 0 时给 0 而不是 NaN */
export function pct(part: number, total: number): number {
    return total > 0 ? Math.round((part / total) * 100) : 0;
}

function toDate(v: string | number | Date | null | undefined): Date | null {
    if (v == null || v === '') return null;
    const d = v instanceof Date ? v : new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
}

/** 2026-05-01T09:00:00 → 2026-05-01（不显示的日期原样回传，避免「Invalid Date」） */
export function date(v: string | Date | null | undefined): string {
    const d = toDate(v);
    if (!d) return String(v ?? '');
    const p = (n: number): string => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 带时间的读数：2026-05-01 09:04 */
export function dateTime(v: string | Date | null | undefined): string {
    const d = toDate(v);
    if (!d) return String(v ?? '');
    const p = (n: number): string => String(n).padStart(2, '0');
    return `${date(d)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 相对时间：刚刚 / 12 分钟前 / 3 小时前 / 5 天前 / 更早退回绝对日期 */
export function ago(v: string | Date | null | undefined): string {
    const d = toDate(v);
    if (!d) return '—';
    const s = Math.floor((Date.now() - d.getTime()) / 1000);
    if (s < 45) return '刚刚';
    if (s < 3600) return `${Math.floor(s / 60)} 分钟前`;
    if (s < 86400) return `${Math.floor(s / 3600)} 小时前`;
    if (s < 86400 * 7) return `${Math.floor(s / 86400)} 天前`;
    return date(d);
}

/** 最近 n 个月的桶键（含当月），升序，用作趋势图横轴 */
export function monthKeys(n: number): string[] {
    const out: string[] = [];
    const now = new Date();
    for (let i = n - 1; i >= 0; i -= 1) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return out;
}

/** 桶键 → 短标签：2026-05 → 5月（跨年时补年份） */
export function monthLabel(key: string): string {
    const [y, m] = key.split('-');
    const cur = String(new Date().getFullYear());
    return `${m?.replace(/^0/, '')}月${y === cur ? '' : `/${y?.slice(2)}`}`;
}

/** 从日期串取所属月桶 */
export function monthOf(v: string | Date | null | undefined): string | null {
    const d = toDate(v);
    if (!d) return null;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** 邮箱首字母（头像占位） */
export function initials(email: string | null | undefined): string {
    const s = (email ?? '').trim();
    if (!s) return 'CN';
    const parts = s.split(/[@._\-]+/).filter(Boolean);
    const a = parts[0]?.[0] ?? '';
    const b = parts[1]?.[0] ?? parts[0]?.[1] ?? '';
    return (a + b).toUpperCase().slice(0, 2) || 'CN';
}

/** 去掉 HTML 标签后取纯文本（摘要/字数统计用） */
export function stripHtml(html: string | null | undefined): string {
    if (!html) return '';
    return html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&[a-z]+;/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
