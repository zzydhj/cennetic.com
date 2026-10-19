/**
 * 宽容 JSON 解析。
 *
 * 源站装了 Elementor，它在 REST 响应渲染时会把 post CSS 以 <style> 形式直接 echo 到
 * 响应体最前面，导致「HTTP 200 + Content-Type: application/json + body 以 <style 开头」
 * 这种合法但不可解析的响应。已实测发生在 /wp/v2/pages（污染前缀来自首页 post id 935）。
 *
 * 处理方式：定位真正的 JSON 起始位置，把被污染的前缀单独返回并留档，
 * 既保证管道不中断，又不丢掉 Elementor 原始样式线索。
 */

export interface LenientParse<T> {
    value: T;
    /** JSON 之前被误输出的内容（Elementor <style> 等），无污染时为空串 */
    prefix: string;
}

const JSON_STARTS = ['[', '{'];

export function parseJsonLenient<T>(body: string, source: string): LenientParse<T> {
    const text = body.replace(/^\uFEFF/, '');

    // 大多数响应是干净的，先直接解析
    try {
        return { value: JSON.parse(text) as T, prefix: '' };
    } catch {
        /* 走到下面的容错 */
    }

    for (let i = 0; i < text.length; i += 1) {
        if (!JSON_STARTS.includes(text[i]!)) continue;
        try {
            return { value: JSON.parse(text.slice(i)) as T, prefix: text.slice(0, i) };
        } catch {
            // 该位置不是真正的 JSON 起点（JSON 内部字符串也含 '['），继续扫描
            continue;
        }
    }

    throw new Error(`无法从响应中恢复 JSON：${source}（长度 ${text.length}）`);
}

/**
 * 从污染前缀里提取 Elementor post CSS 的 identity，用于留档与保真参考。
 * 例如 <style id="elementor-post-935"> ... </style>
 */
export function extractElementorStyles(prefix: string): Array<{ id: string; css: string }> {
    const out: Array<{ id: string; css: string }> = [];
    for (const m of prefix.matchAll(/<style\s+id="(elementor-post-\d+)">([\s\S]*?)<\/style>/g)) {
        out.push({ id: m[1]!, css: m[2]! });
    }
    return out;
}
