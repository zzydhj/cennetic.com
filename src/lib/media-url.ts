/**
 * 图片存储的公网前缀，单一真源。
 * 站内硬编码的少数几张图（首页/公司页/页头背景）都从这里取值，换域名只改这一处。
 * 例外：组件里 <style> 中的 CSS url() 无法做表达式插值（Astro 的限制），只能写完整地址。
 */
export const MEDIA_ORIGIN = 'https://media.cennetic.com';

/** 站内相对路径 → 桶地址；已经是绝对地址的原样返回，避免双重前缀 */
export function mediaUrl(path: string): string {
    if (!path) return path;
    if (/^https?:\/\//.test(path) || path.startsWith(MEDIA_ORIGIN)) return path;
    return `${MEDIA_ORIGIN}${path.startsWith('/') ? '' : '/'}${path}`;
}
