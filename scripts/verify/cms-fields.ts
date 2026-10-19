/**
 * 校验 Decap CMS 配置的字段覆盖度。
 *
 * 动机：Decap 保存条目时只写 config.yml 里声明过的字段，**没声明的会被静默删除**。
 * 对本站这是数据损失级的风险 —— 文章有 12 个 frontmatter 键、产品有嵌套结构，
 * 漏配一个就等于编辑随手保存一次就把 canonical / sourceId / 规格表抹掉。
 *
 * 本脚本把真实内容文件里的键集合与配置声明的键集合做双向差集：
 *   内容有、配置没有 → 会被删（必须修）
 *   配置有、内容没有 → 新字段或冗余（提示，不一定错）
 *
 *   npx tsx scripts/verify/cms-fields.ts
 */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { load } from 'js-yaml';
import { ROOT } from '../migrate/lib/config.ts';

interface Node {
    name: string;
    widget?: string;
    fields?: Node[];
    types?: Array<{ value?: Node[] }>;
}

/**
 * 拆 frontmatter。
 * 这里就地解析而不是复用 lib/frontmatter.ts：那个模块只负责写（迁移输出），
 * 读取只有本校验需要，不值得为它扩充共享库的 API 面。
 */
function frontmatterKeys(text: string): string[] {
    const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
    if (!m) return [];
    const data = load(m[1]);
    if (!data || typeof data !== 'object') return [];
    return Object.keys(data as Record<string, unknown>);
}

/** 递归收集一个集合里所有会被写入的顶层键（含 object / list 的嵌套键） */
function topLevelKeys(fields: Node[] | undefined): Set<string> {
    return new Set((fields ?? []).map((f) => f.name));
}

const configText = await readFile(join(ROOT, 'public/admin/config.yml'), 'utf8');
const config = load(configText) as {
    collections: Array<{
        name: string;
        folder?: string;
        extension?: string;
        format?: string;
        fields?: Node[];
        files?: Array<{ file: string; fields?: Node[] }>;
    }>;
};

const declared = new Map<string, Set<string>>();
for (const c of config.collections) {
    if (c.folder) declared.set(c.folder, topLevelKeys(c.fields));
    for (const f of c.files ?? []) {
        // files 型集合按具体文件路径登记
        declared.set(f.file, topLevelKeys(f.fields));
    }
}

const problems: string[] = [];
const notes: string[] = [];

/** 取一个内容文件的实际键 */
async function keysOf(path: string, format: 'md' | 'json'): Promise<string[]> {
    const text = await readFile(path, 'utf8');
    if (format === 'json') return Object.keys(JSON.parse(text) as Record<string, unknown>);
    // 正文在 Markdown 文件里叫 body，不在 frontmatter 中
    return [...frontmatterKeys(text), 'body'];
}

async function check(label: string, dir: string, format: 'md' | 'json', fileGlob: string) {
    const fieldSet = declared.get(dir);
    if (!fieldSet) {
        problems.push(`${label}: 配置里没有声明目录 ${dir}`);
        return;
    }
    const abs = join(ROOT, dir);
    const names = (await readdir(abs)).filter((n) => n.endsWith(fileGlob));
    const missingUnion = new Map<string, string[]>(); // 未声明的键 → 出现在哪些文件
    const allKeys = new Set<string>();

    // 一次读文件就把两个差集算完，避免为了“多余字段”再扫一遍 123 个文件
    for (const n of names) {
        const keys = await keysOf(join(abs, n), format);
        for (const k of keys) {
            allKeys.add(k);
            if (!fieldSet.has(k)) {
                if (!missingUnion.has(k)) missingUnion.set(k, []);
                missingUnion.get(k)!.push(n);
            }
        }
    }

    for (const [k, where] of missingUnion) {
        problems.push(
            `${label}: 字段 "${k}" 存在于 ${where.length} 个文件但未在 config.yml 声明 —— 后台保存会被删除（例：${where[0]}）`,
        );
    }

    const unused = [...fieldSet].filter((k) => !allKeys.has(k));
    if (unused.length > 0) {
        notes.push(`${label}: 配置声明但现有内容里没出现的键（新增字段？）：${unused.join(', ')}`);
    }

    console.log(`✓ ${label}：${names.length} 个文件，配置声明 ${fieldSet.size} 个字段`);
}

await check('文章', 'src/content/articles', 'md', '.md');
await check('页面', 'src/content/pages', 'md', '.md');
await check('产品', 'src/data/products', 'json', '.json');
await check('博客分类', 'src/data/blog-categories', 'json', '.json');

// site.json 走 files 型集合，键名带 _comment 这类必须保住的文档字段
const siteFields = declared.get('src/data/site.json');
if (!siteFields) {
    problems.push('站点信息: 配置里没有声明 src/data/site.json');
} else {
    const siteKeys = Object.keys(JSON.parse(await readFile(join(ROOT, 'src/data/site.json'), 'utf8')) as Record<string, unknown>);
    const missing = siteKeys.filter((k) => !siteFields.has(k));
    if (missing.length > 0) {
        problems.push(`站点信息: 未声明会被删除的键 → ${missing.join(', ')}`);
    } else {
        console.log(`✓ 站点信息：${siteKeys.length} 个顶层键全部已声明`);
    }
}

console.log('');
if (notes.length > 0) {
    for (const n of notes) console.log(`提示  ${n}`);
    console.log('');
}
if (problems.length > 0) {
    for (const p of problems) console.log(`✗ ${p}`);
    console.log(`\n共 ${problems.length} 个问题：这些字段一进后台保存就会被静默删除。`);
    process.exit(1);
}
console.log('✓ 字段覆盖度通过：内容文件里的每个键都在 config.yml 中有对应声明。');
