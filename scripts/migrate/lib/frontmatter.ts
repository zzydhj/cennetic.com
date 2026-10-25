/**
 * YAML frontmatter 序列化。
 *
 * 这里直接用 js-yaml（已在依赖树内，gray-matter 亦依赖它）而不是自己手写序列化：
 * 上一版手写实现对「数组元素是对象」这种结构产出过非法 YAML —— 序列项写成
 * `  -     q: ...`（键在第 7 列）而兄弟键 `a:` 在第 5 列，缩进不一致，
 * Astro 内容层解析直接失败。与其继续修补一个自制序列化器，不如用经过
 * 大量测试的实现，这类边界情况由它负责。
 */
import { dump } from 'js-yaml';

export type Frontmatter = Record<string, unknown>;

/** 生成 `---\n…\n---\n\n` 形式的头部 */
export function toFrontmatter(obj: Frontmatter): string {
    const clean: Frontmatter = {};
    for (const [k, v] of Object.entries(obj)) {
        if (v === undefined || v === null || v === '') continue;
        clean[k] = v;
    }

    const body = dump(clean, {
        // 与 Decap CMS 与 GitHub 网页预览的习惯保持一致
        indent: 2,
        // -1 才是「不折行」；填 0 会被 js-yaml 当成宽度上限而把标题碎成多行
        lineWidth: -1,
        noRefs: true,
        sortKeys: false,
        // 单引号：仓库里现有 113+10 个 .md 是 js-yaml 3.x（默认单引号）产出的，
        // 升到 4.x 后 quotingType='"' 会把每个需转义的标量改成双引号，
        // 快照与文件的字节比对就会全文飘红。语义完全等价，这里钉住单引号。
        quotingType: "'",
        forceQuotes: false,
    });

    return `---\n${body}---\n\n`;
}
