/**
 * 一次性内容修复（数据库为唯一事实源，跑完用 `npm run snapshot` 回同步仓库）：
 *  1) news-and-media / contact-us 的 description 是迁移期乱码摘录（WP 循环标题拼接、
 *     旧域名邮箱），会进页面 lede 与 meta description → 换成干净的一句话；
 *  2) l-1060 详情正文里有一段 AI 生成残留的分区标签段
 *     `<p>  <!-- ══ Section 4: DETAIL GALLERY ══ --><br>  Product Detail</p>`，
 *     与页面自带的 "Product details" 标题重复 → 删除；
 *  3) 产品/页面正文里同形态的游离段与旧域名邮箱（gfcncmachine → cennetic）定点替换。
 * 顺带扫描其余产品/页面正文里同形态的游离标签段，只报告不改动。
 */
import { createRestClient } from './lib/rest';
import { loadEnvFile, requireEnv } from './lib/env';

loadEnvFile();
const rest = createRestClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SECRET_KEY'));

/** 按 slug 定点改几列：upsert 的部分行会撞 NOT NULL（缺列当 null 插），PATCH 语义才是「只改给的列」 */
async function patch(table: string, slug: string, cols: Record<string, unknown>): Promise<void> {
    const url = `${requireEnv('SUPABASE_URL')}/rest/v1/${table}?slug=eq.${encodeURIComponent(slug)}`;
    const key = requireEnv('SUPABASE_SECRET_KEY');
    const res = await fetch(url, {
        method: 'PATCH',
        headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
        },
        body: JSON.stringify(cols),
    });
    if (!res.ok) throw new Error(`${table}/${slug} PATCH 失败 HTTP ${res.status}: ${await res.text()}`);
    console.log(`  ✓ ${table}/${slug}: ${Object.keys(cols).join(', ')}`);
}

const DESCS: Array<{ slug: string; description: string }> = [
    {
        slug: 'news-and-media',
        description: 'Company news, product releases and media coverage from the Cennetic factory in Dongguan, China.',
    },
    {
        slug: 'contact-us',
        description: 'Reach the Cennetic factory directly by phone, email or WhatsApp — sales and engineering reply within one working day.',
    },
];

const STRAY = '<p>  <!-- ══ Section 4: DETAIL GALLERY ══ --><br>\n  Product Detail</p>\n';

/** 产品正文游离标签段：与页面自带标题重复的删除；有实际信息的升级为 h3 */
const BODY_FIXES: Array<{ slug: string; from: string; to: string }> = [
    { slug: 'l-1060-vertical-machining-center', from: STRAY, to: '' },
    {
        slug: 't-600-high-speed-drilling-and-tapping-center',
        from: '<p><!-- ══ Section 4: DETAIL GALLERY ══ --><br>\nProduct Detail</p>',
        to: '',
    },
    {
        slug: 'jr-v85p-vertical-machining-center-3-axis-linear-guideway-vmc',
        from: '<p>  <!-- ══ Section 3：规格参数对比表 ══ --><br>\n  📊 Technical Specifications — 3-Model Comparison</p>',
        to: '<h3>📊 Technical Specifications — 3-Model Comparison</h3>',
    },
];

/** 页面正文定点替换：旧域名邮箱是迁移前残留，全站仅此一处 */
const PAGE_BODY_FIXES: Array<{ slug: string; from: string; to: string }> = [
    { slug: 'contact-us', from: 'bella@gfcncmachine.com', to: 'bella@cennetic.com' },
];

async function main(): Promise<void> {
    for (const row of DESCS) await patch('pages', row.slug, { description: row.description });

    const products = await rest.list<{ slug: string; body: string }>('products', 'select=slug,body');
    for (const fix of BODY_FIXES) {
        const row = products.find((p) => p.slug === fix.slug);
        if (!row) throw new Error(`找不到产品行 ${fix.slug}`);
        if (!row.body.includes(fix.from)) {
            console.log(`  · ${fix.slug}: 目标段已不存在，跳过`);
            continue;
        }
        await patch('products', fix.slug, { body: row.body.replace(fix.from, fix.to) });
    }
    for (const fix of PAGE_BODY_FIXES) {
        const rows = await rest.list<{ slug: string; body: string }>('pages', `select=slug,body&slug=eq.${fix.slug}`);
        const row = rows[0];
        if (!row) throw new Error(`找不到页面行 ${fix.slug}`);
        if (!row.body.includes(fix.from)) {
            console.log(`  · pages/${fix.slug}: 目标串已不存在，跳过`);
            continue;
        }
        await patch('pages', fix.slug, { body: row.body.split(fix.from).join(fix.to) });
    }
    console.log('✓ 内容修复完成：2 条 description + 产品游离段');
}

main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
});
