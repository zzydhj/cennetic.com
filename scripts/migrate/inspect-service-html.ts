/**
 * 看 REST 正文为空的页面，其整页 HTML 里正文到底装在哪个容器。
 *
 *   npx tsx scripts/migrate/inspect-service-html.ts
 */
import { SRC_ORIGIN } from './lib/config.ts';
import { fetchText } from './lib/http.ts';
import * as cheerio from 'cheerio';

for (const slug of ['service', 'products']) {
    const html = await fetchText(`${SRC_ORIGIN}/${slug}/`, { kind: 'page-html' });
    if (!html) { console.log(`${slug}: 无缓存`); continue; }

    const $ = cheerio.load(html);
    console.log(`\n${'='.repeat(70)}\n${slug}  整页 ${html.length} 字节`);

    console.log('  data-elementor-type 出现：');
    $('[data-elementor-type]').each((_, el) => {
        const t = $(el).attr('data-elementor-type');
        const id = $(el).attr('data-elementor-id');
        console.log(`    <${(el as { tagName?: string }).tagName}> type=${t} id=${id} 内部 ${$(el).text().trim().length} 字`);
    });

    console.log('  主要布局容器：');
    for (const sel of ['#l-main', '.site-main', '#content', '.content-area', '.page-content', '.entry-content', 'main', '#primary']) {
        const n = $(sel);
        if (n.length) console.log(`    ${sel.padEnd(18)} x${n.length}  文本 ${n.first().text().trim().length} 字  HTML ${n.first().html()?.length ?? 0}`);
    }

    console.log('  body 下前 3 层结构（截断）：');
    $('body > div').slice(0, 4).each((_, el) => {
        const id = $(el).attr('id') ?? '';
        const cls = ($(el).attr('class') ?? '').slice(0, 50);
        console.log(`    <div id="${id}" class="${cls}">  文本 ${$(el).text().trim().length} 字`);
    });

    // 该页正文文字量（排除 header/footer）
    $('header, footer, nav').remove();
    console.log(`  去除 header/footer/nav 后全文字数：${$('body').text().replace(/\s+/g, ' ').trim().length}`);
    console.log(`  片段预览：${$('body').text().replace(/\s+/g, ' ').trim().slice(0, 240)}`);
}
