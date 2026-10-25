/**
 * 保存前对富文本 HTML 做安全过滤（客户端第一道闸）。
 * 采用「黑名单剔除」而非「白名单重建」：保留用户/AI 粘贴的表格与 qf-* 组件类名，
 * 只剥掉可执行/危险的东西，避免破坏整站排版。
 * 注意：这是 defense-in-depth 的一层；发布链路的 snapshot 侧应再过滤一次（服务端为准）。
 */
const DROP_TAGS = new Set([
    'script',
    'iframe',
    'object',
    'embed',
    'applet',
    'base',
    'link',
    'meta',
    'frame',
    'frameset',
]);

const URL_ATTRS = new Set(['href', 'src', 'xlink:href', 'action', 'formaction']);

export function sanitizeHtml(html: string): string {
    if (!html || typeof window === 'undefined') return html;
    const doc = new DOMParser().parseFromString(`<!doctype html><body>${html}</body>`, 'text/html');

    const clean = (el: Element): void => {
        for (const node of Array.from(el.children)) {
            if (DROP_TAGS.has(node.tagName.toLowerCase())) {
                node.remove();
                continue;
            }
            for (const attr of Array.from(node.attributes)) {
                const name = attr.name.toLowerCase();
                const value = attr.value.replace(/\s+/g, '').toLowerCase();
                if (name.startsWith('on')) {
                    node.removeAttribute(attr.name); // 事件处理器
                } else if (URL_ATTRS.has(name) && /^(javascript:|vbscript:|data:text\/html)/.test(value)) {
                    node.removeAttribute(attr.name); // 伪协议
                }
            }
            clean(node);
        }
    };
    clean(doc.body);
    return doc.body.innerHTML;
}
