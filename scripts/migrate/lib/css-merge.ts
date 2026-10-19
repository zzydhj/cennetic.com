/**
 * 极简 CSS 解析 + 投票式归并。
 *
 * 源站 106 篇文章各自内联一份手写样式，按选择器指纹归并后有 65 个互不相同的变体
 * （字号 15px/16px 混用、正文色 #333/#222 混用、字体 Arial/'Segoe UI' 混用、
 *  外层容器 .qf-article-body / .qf-body 两种写法并存）。
 *
 * 这里把它们合并成唯一一份样式表：同一选择器下的同一属性，取出现次数最多的值。
 * 用真实数据投票决定统一值，而不是凭空编一套 —— 同时输出分歧报告供人工复核。
 */

/** 属性 → (值 → 出现次数) */
type DeclVotes = Map<string, Map<string, number>>;

export interface RuleBucket {
    media: string;
    selector: string;
    decls: DeclVotes;
    /** 该规则被多少篇文章采用，用于判断是否足够通用 */
    support: number;
}

/** 归并结果 */
export interface MergeResult {
    /** 最终样式表文本 */
    css: string;
    /** 分歧记录：同一 selector+property 存在多个候选值 */
    conflicts: Array<{
        media: string;
        selector: string;
        property: string;
        chosen: string;
        candidates: Array<{ value: string; count: number }>;
    }>;
    /** 只被极少数文章使用、可能被丢弃的规则 */
    lowSupport: Array<{ media: string; selector: string; support: number }>;
    totalRules: number;
}

const CONTAINER_ALIASES: Record<string, string> = {
    '.qf-body': '.qf-article-body',
};

/** 把 .qf-body 系列选择器统一到 .qf-article-body */
function normalizeSelector(selector: string): string {
    let s = selector.trim();
    for (const [from, to] of Object.entries(CONTAINER_ALIASES)) {
        s = s.split(from).join(to);
    }
    return s.replace(/\s+/g, ' ');
}

/** 声明值归一化，让 `0 auto` 与 `0px auto` 之类能投到同一票 */
function normalizeValue(value: string): string {
    return value
        .trim()
        .replace(/;\s*$/, '')
        .replace(/\s*,\s*/g, ', ')
        .replace(/\s+/g, ' ')
        .toLowerCase();
}

/**
 * 切出顶层块：`selector { body }` 与 `@media ... { ... }`。
 * 只依赖花括号配对，足以覆盖这些手写样式块。
 */
function splitBlocks(css: string): Array<{ prelude: string; body: string; atRule: boolean }> {
    const out: Array<{ prelude: string; body: string; atRule: boolean }> = [];
    let i = 0;
    let preludeStart = 0;

    while (i < css.length) {
        const ch = css[i];

        if (ch === '/' && css[i + 1] === '*') {
            const end = css.indexOf('*/', i + 2);
            i = end === -1 ? css.length : end + 2;
            preludeStart = i;
            continue;
        }

        if (ch === '{') {
            const prelude = css.slice(preludeStart, i).trim();
            let depth = 1;
            let j = i + 1;
            while (j < css.length && depth > 0) {
                if (css[j] === '{') depth += 1;
                else if (css[j] === '}') depth -= 1;
                j += 1;
            }
            out.push({
                prelude,
                body: css.slice(i + 1, j - 1),
                atRule: prelude.startsWith('@'),
            });
            i = j;
            preludeStart = j;
            continue;
        }

        i += 1;
    }

    return out;
}

/** 把 `a, b, c { ... }` 的选择器列表拆开 */
function splitSelectors(prelude: string): string[] {
    return prelude
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
}

/** 解析顶层声明（不递归嵌套，源站样式无嵌套） */
function parseDeclarations(body: string): Array<{ prop: string; value: string }> {
    const out: Array<{ prop: string; value: string }> = [];
    let depth = 0;
    let buf = '';

    for (const ch of body) {
        if (ch === '{') depth += 1;
        if (ch === '}') depth -= 1;
        if (ch === ';' && depth === 0) {
            const idx = buf.indexOf(':');
            if (idx > 0) {
                out.push({ prop: buf.slice(0, idx).trim(), value: buf.slice(idx + 1) });
            }
            buf = '';
            continue;
        }
        buf += ch;
    }
    const idx = buf.indexOf(':');
    if (buf.trim() && idx > 0) out.push({ prop: buf.slice(0, idx).trim(), value: buf.slice(idx + 1) });

    return out;
}

/**
 * 把一篇文章的 CSS 并入累加器。
 * 同一篇内重复的选择器只计一次，避免单篇文章给自己加权。
 */
export function absorb(bucket: Map<string, RuleBucket>, css: string, media = ''): void {
    for (const block of splitBlocks(css)) {
        if (block.atRule) {
            // 只处理 @media，其他 at-rule（@keyframes/@font-face）原样按整块计入
            if (block.prelude.startsWith('@media')) {
                absorb(bucket, block.body, block.prelude.replace(/\s+/g, ' ').trim());
            } else {
                const key = `${media}|@|${block.prelude}`;
                if (!bucket.has(key)) {
                    bucket.set(key, {
                        media,
                        selector: `@RULE:${block.prelude}${block.body}`,
                        decls: new Map(),
                        support: 0,
                    });
                }
                bucket.get(key)!.support += 1;
            }
            continue;
        }

        for (const rawSel of splitSelectors(block.prelude)) {
            const selector = normalizeSelector(rawSel);
            if (!selector) continue;
            const key = `${media}|${selector}`;
            if (!bucket.has(key)) {
                bucket.set(key, { media, selector, decls: new Map(), support: 0 });
            }
            const target = bucket.get(key)!;
            target.support += 1;
            for (const { prop, value } of parseDeclarations(block.body)) {
                const votes = target.decls.get(prop) ?? new Map<string, number>();
                votes.set(value, (votes.get(value) ?? 0) + 1);
                target.decls.set(prop, votes);
            }
        }
    }
}

/** 投票并产出最终样式表与分歧报告 */
export function resolve(
    buckets: Map<string, RuleBucket>,
    opts: { minSupport?: number } = {},
): MergeResult {
    const minSupport = opts.minSupport ?? 1;
    const conflicts: MergeResult['conflicts'] = [];
    const lowSupport: MergeResult['lowSupport'] = [];

    /** media → rules[] */
    const byMedia = new Map<string, RuleBucket[]>();

    for (const b of buckets.values()) {
        if (b.selector.startsWith('@RULE:')) continue;
        if (b.support < minSupport) {
            lowSupport.push({ media: b.media, selector: b.selector, support: b.support });
        }
        if (!byMedia.has(b.media)) byMedia.set(b.media, []);
        byMedia.get(b.media)!.push(b);
    }

    const chunks: string[] = [];
    let totalRules = 0;

    // 无 @media 的顶层规则先输出，保证媒体查询能覆盖它
    const orderedMedias = [...byMedia.keys()].sort((a, b) => (a === '' ? -1 : b === '' ? 1 : a.localeCompare(b)));

    for (const media of orderedMedias) {
        const rules = byMedia.get(media)!
            // 父选择器在前，便于阅读；同级按字母序保证输出稳定可 diff
            .sort((x, y) => x.selector.localeCompare(y.selector));

        const lines: string[] = [];

        for (const r of rules) {
            const decls: string[] = [];
            for (const [prop, votes] of [...r.decls.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
                const ranked = [...votes.entries()]
                    .map(([value, count]) => ({ value: value.trim(), count }))
                    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));

                const chosen = ranked[0]!;
                if (ranked.length > 1) {
                    conflicts.push({
                        media,
                        selector: r.selector,
                        property: prop,
                        chosen: chosen.value,
                        candidates: ranked,
                    });
                }
                decls.push(`  ${prop}: ${chosen.value};`);
            }

            if (decls.length === 0) continue;
            totalRules += 1;
            lines.push(`${r.selector} {\n${decls.join('\n')}\n}`);
        }

        if (lines.length === 0) continue;

        if (media === '') {
            chunks.push(lines.join('\n\n'));
        } else {
            const indent = '  ';
            chunks.push(`${media} {\n${lines.join('\n\n').split('\n').map((l) => (l ? indent + l : l)).join('\n')}\n}`);
        }
    }

    // 原样保留的 at-rule（@keyframes / @font-face）
    const passthrough: string[] = [];
    for (const b of buckets.values()) {
        if (b.selector.startsWith('@RULE:')) passthrough.push(b.selector.slice('@RULE:'.length));
    }

    const css = [...chunks, ...passthrough].join('\n\n');

    return { css, conflicts, lowSupport, totalRules };
}
