import type { FaqItem } from './content-schema.ts';

/**
 * 「锁定页」解析：把 src/content/locked/*.md（代码自有、不进 CMS/快照）的
 * frontmatter + 正文解析成 PageLayout 需要的形状。
 *
 * 为什么单独一套：政策/公司/联系这类页文案要脱离后台编辑（改它们要走 git 发布），
 * 但正文很长，内联进 .astro 字符串既难读又易错。于是内容仍以 .md 存于 git
 * （locked 目录不在 snapshot 的 MANAGED_DIRS 里），路由用 Vite 的 ?raw 原样读入再解析。
 *
 * 支持两类字段：顶层标量（`key: value`）与 FAQ 块（`faq:` 下面的
 * `- q: …` / `a: …` 两行一组，写法与 snapshot 的 toFrontmatter 输出一致）。
 * 其余 frontmatter 行（date/lastmod/sourceId/menuOrder/isListing）仍留在文件里
 * 作迁移期溯源，但版式不读，故不解析成类型字段。
 */
export interface LockedPageData {
    slug: string;
    title: string;
    /** 页头 H1 */
    heading: string;
    description: string;
    /** 缺省由 entryPath 按 slug 兜底 */
    canonical?: string;
    robots?: string;
    /** og:image 与 LCP 预加载；没有则回落站点默认图 */
    hero?: string;
    faq?: FaqItem[];
    /** 溯源用的其余标量行，模板不读 */
    [key: string]: string | FaqItem[] | undefined;
}

export interface LockedPage {
    data: LockedPageData;
    body: string;
}

/** faq 块：`- q:` 起一条，紧跟的 `a:` 归同一条；两条都能带续行以外的单行文本 */
function parseFaq(lines: string[]): FaqItem[] {
    const out: FaqItem[] = [];
    let cur: Partial<FaqItem> | null = null;
    for (const line of lines) {
        const item = line.match(/^\s*-\s+q:\s*(.*)$/);
        if (item) {
            if (cur?.q !== undefined) out.push(cur as FaqItem);
            cur = { q: unquote(item[1]!), a: '' };
            continue;
        }
        const ans = line.match(/^\s+a:\s*(.*)$/);
        if (ans && cur) {
            cur.a = unquote(ans[1]!);
            continue;
        }
        throw new Error(`locked page: faq 块里有无法解析的行「${line}」`);
    }
    if (cur?.q !== undefined) out.push(cur as FaqItem);
    return out;
}

function unquote(v: string): string {
    const t = v.trim();
    return /^'.*'$/.test(t) || /^".*"$/.test(t) ? t.slice(1, -1) : t;
}

export function parseLockedPage(raw: string): LockedPage {
    const norm = raw.replace(/\r\n/g, '\n');
    const m = norm.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
    if (!m) throw new Error('locked page: frontmatter 解析失败');

    const data: Record<string, string | FaqItem[]> = {};
    const lines = m[1].split('\n');
    for (let i = 0; i < lines.length; i++) {
        const kv = lines[i].match(/^([A-Za-z]\w*):\s?(.*)$/);
        if (!kv) continue;
        if (kv[1] === 'faq' && kv[2].trim() === '') {
            // 收集 faq 的缩进块，交给专门的解析器
            const block: string[] = [];
            while (i + 1 < lines.length && /^\s/.test(lines[i + 1]!)) block.push(lines[++i]!);
            data.faq = parseFaq(block);
            continue;
        }
        data[kv[1]] = unquote(kv[2]);
    }

    for (const key of ['slug', 'title', 'heading', 'description'] as const) {
        if (typeof data[key] !== 'string' || !data[key]) {
            throw new Error(`locked page: 缺必填字段 ${key}（模板与版式都要用）`);
        }
    }
    return { data: data as unknown as LockedPageData, body: m[2].trim() };
}
