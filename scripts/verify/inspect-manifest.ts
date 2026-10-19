/**
 * 基线清单检查：按 kind 分组打印，并找出缺 canonical / robots 的条目。
 * 用于人工确认分类规则没有遗漏，是 parity 校验的前置排查。
 *
 *   npx tsx scripts/verify/inspect-manifest.ts
 */
import { readJson, join } from '../migrate/lib/fs.ts';
import { MIGRATION_DIR } from '../migrate/lib/config.ts';
import type { UrlRecord } from '../migrate/lib/types.ts';

interface Manifest { urls: UrlRecord[]; counts: Record<string, number> }

const m = await readJson<Manifest>(join(MIGRATION_DIR, 'url-manifest.json'));

const byKind = new Map<string, UrlRecord[]>();
for (const u of m.urls) {
    if (!byKind.has(u.kind)) byKind.set(u.kind, []);
    byKind.get(u.kind)!.push(u);
}

console.log(`清单共 ${m.urls.length} 条，分类统计：`);
for (const [k, v] of Object.entries(m.counts)) console.log(`  ${k.padEnd(18)} ${v}`);

// 只展开需要人工核对的分组
const FOCUS = ['other', 'page', 'archive-page', 'blog-category', 'product-category'];
for (const kind of FOCUS) {
    const list = byKind.get(kind) ?? [];
    console.log(`\n===== ${kind} (${list.length}) =====`);
    for (const u of list) {
        console.log(`  ${u.path.padEnd(60)} src=${u.source}`);
        if (u.title) console.log(`      title : ${u.title.slice(0, 72)}`);
        if (u.robots) console.log(`      robots: ${u.robots}`);
    }
}

console.log('\n===== 缺 canonical 或 robots 的条目 =====');
const missing = m.urls.filter((u) => !u.canonical || !u.robots);
if (missing.length === 0) {
    console.log('  无 —— 全部条目都抓到了 canonical 与 robots');
} else {
    for (const u of missing) {
        console.log(`  ${u.path}  canonical=${u.canonical ?? 'NONE'}  robots=${u.robots ?? 'NONE'}`);
    }
}

console.log('\n===== canonical 与自身 path 不一致的条目 =====');
const mismatched = m.urls.filter((u) => u.canonical && u.canonical !== u.path);
if (mismatched.length === 0) {
    console.log('  无 —— 全部自引用 canonical');
} else {
    for (const u of mismatched) console.log(`  ${u.path}  ->  ${u.canonical}`);
}
