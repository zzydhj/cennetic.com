/**
 * 「锁定页」解析：把 src/content/locked/*.md（代码自有、不进 CMS/快照）的
 * frontmatter + 正文解析成 PageLayout 需要的形状。
 *
 * 为什么单独一套：政策/公司这类几乎不改的页要脱离后台编辑，但正文很长，
 * 内联进 .astro 字符串既难读又易错。于是内容仍以 .md 存于 git（locked 目录
 * 不在 snapshot 的 MANAGED_DIRS 里），路由用 Vite 的 ?raw 原样读入再解析。
 */
export interface LockedPage {
    data: Record<string, string>;
    body: string;
}

export function parseLockedPage(raw: string): LockedPage {
    const norm = raw.replace(/\r\n/g, "\n");
    const m = norm.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
    if (!m) throw new Error("locked page: frontmatter 解析失败");
    const data: Record<string, string> = {};
    for (const line of m[1].split("\n")) {
        const kv = line.match(/^([A-Za-z]\w*):\s?(.*)$/);
        if (!kv) continue;
        let v = kv[2].trim();
        if (/^'.*'$/.test(v) || /^".*"$/.test(v)) v = v.slice(1, -1);
        data[kv[1]] = v;
    }
    return { data, body: m[2].trim() };
}
