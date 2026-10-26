/**
 * 阶段一 · 西尔普(sharpecnc.com)全站产品爬取 —— 只读,不入库。
 *
 * 目的:
 *  1) 枚举所有分类页 → 分页 → 收集全部产品(product_view_{pid}_{cid}.html);
 *  2) 每款抓一次详情,解析:中文名、面包屑分类、产品图集(/uFile/…/product/ 去重)、
 *     参数表与配置表(原样存 HTML,翻译时人工读,不指望机器解析合并单元格);
 *  3) 落 sharpecnc/raw.json(全量)+ sharpecnc/manifest.md(勾选清单)。
 *
 * 复用迁移层 http.ts 的 fetchText:自带 24h 缓存、限速、重试,重跑几乎不联网。
 */
import * as cheerio from "cheerio";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fetchText } from "../migrate/lib/http.ts";
import { ROOT } from "../migrate/lib/config.ts";

const SRC = "https://www.sharpecnc.com";
const OUT_DIR = join(ROOT, "sharpecnc");

interface RawProduct {
    url: string;
    pid: string;
    cid: string;
    nameZh: string;
    categoryZh: string;
    images: string[];
    paramTableHtml: string;
    configTableHtml: string;
    detailHtml: string;
}

async function get(url: string): Promise<string | null> {
    return fetchText(url, { kind: "sharpecnc", allow404: true });
}

/** 从首页发现所有分类页(product_N.html,排除 product_view) */
async function discoverCategories(): Promise<Set<string>> {
    const home = await get(`${SRC}/`);
    if (!home) throw new Error("首页抓取失败");
    const $h = cheerio.load(home);
    const cats = new Set<string>();
    $h("a[href]").each((_: number, el: any) => {
        const h = $h(el).attr("href") || "";
        const m = h.match(/product_(\d+)\.html$/);
        if (m) cats.add(`product_${m[1]}.html`);
    });
    return cats;
}

/** 分类页 + 分页,收集 product_view 链接 */
async function collectProductLinks(cats: Set<string>): Promise<Set<string>> {
    const links = new Set<string>();
    for (const cat of cats) {
        // 第 0 页 product_N.html,后续 product_N_1.html、_2… 直到没有新链接
        for (let page = 0; page < 20; page += 1) {
            const url = page === 0 ? `${SRC}/${cat}` : `${SRC}/${cat.replace(".html", `_${page}.html`)}`;
            const html = await get(url);
            if (!html) break;
            const $$ = cheerio.load(html);
            let found = 0;
            $$("a[href]").each((_: number, el: any) => {
                const h = $$(el).attr("href") || "";
                const m = h.match(/product_view_(\d+)_(\d+)\.html$/);
                if (m) {
                    const norm = `product_view_${m[1]}_${m[2]}.html`;
                    if (!links.has(norm)) {
                        links.add(norm);
                        found += 1;
                    }
                }
            });
            // 该分页没有任何产品链接 → 后面没有了
            if (found === 0 && page > 0) break;
        }
    }
    return links;
}

/** 解析单个产品详情 */
async function parseProduct(link: string): Promise<RawProduct | null> {
    const m = link.match(/product_view_(\d+)_(\d+)\.html$/);
    if (!m) return null;
    const [, pid, cid] = m;
    const html = await get(`${SRC}/${link}`);
    if (!html) return null;
    const $$ = cheerio.load(html);

    // 中文名:<title> 首段(站点后缀用“_”或“cnc加工中心厂家”切断)
    const rawTitle = $$("title").first().text().trim();
    const nameZh = (rawTitle.split(/_+cnc加工中心厂家|_+卧式|_+五轴数控|cnc加工中心厂家/)[0] || rawTitle)
        .replace(/\s+/g, " ")
        .trim();

    // 面包屑叶子分类:紧邻“西尔普首页/”之后、指向 product_N.html 的最后一条
    let categoryZh = "";
    $$(".crumbs a, .position a, a[href^='product_']").each((_: number, el: any) => {
        const h = $$(el).attr("href") || "";
        const t = $$(el).text().trim();
        if (/^product_\d+\.html$/.test(h) && t && !/首页/.test(t)) categoryZh = t;
    });

    // 产品图集:仅 /product/ 目录,去重,排除站点装饰
    const imgs = new Set<string>();
    $$("img").each((_: number, el: any) => {
        const s = $$(el).attr("src") || $$(el).attr("data-src") || "";
        if (/\/uFile\/\d+\/product\//.test(s)) imgs.add(s);
    });

    // 两张表:参数表(序号|名称|机型|单位|参数)、配置表(序号|类别|项目|…|标配)
    let paramTableHtml = "";
    let configTableHtml = "";
    $$("table").each((_: number, el: any) => {
        const t = $$(el).text();
        if (!paramTableHtml && /序号/.test(t) && /参数|行程|主轴/.test(t)) paramTableHtml = $$.html(el);
        else if (!configTableHtml && /标配|选配|●/.test(t)) configTableHtml = $$.html(el);
    });

    // 详情描述区:产品详情 tab 里的非表格 HTML(图片+文字),粗略取主体
    const detailHtml = html.length > 0 ? link : "";

    return {
        url: `${SRC}/${link}`,
        pid,
        cid,
        nameZh,
        categoryZh,
        images: [...imgs],
        paramTableHtml,
        configTableHtml,
        detailHtml,
    };
}

async function main(): Promise<void> {
    await mkdir(OUT_DIR, { recursive: true });

    console.log("· 发现分类页…");
    const cats = await discoverCategories();
    console.log(`  ${cats.size} 个分类`);

    console.log("· 收集产品链接…");
    const links = await collectProductLinks(cats);
    console.log(`  ${links.size} 个产品(去重后)`);

    console.log("· 逐个解析…");
    const products: RawProduct[] = [];
    let i = 0;
    for (const link of links) {
        i += 1;
        const p = await parseProduct(link);
        if (p) {
            products.push(p);
            console.log(`  [${i}/${links.size}] ${p.nameZh.slice(0, 30)} | 图${p.images.length} | ${p.paramTableHtml ? "有参数表" : "无参数表"}`);
        } else {
            console.log(`  [${i}/${links.size}] 解析失败: ${link}`);
        }
    }

    // 按分类归组写清单
    products.sort((a, b) => a.categoryZh.localeCompare(b.categoryZh, "zh") || a.nameZh.localeCompare(b.nameZh, "zh"));
    await writeFile(join(OUT_DIR, "raw.json"), JSON.stringify(products, null, 2), "utf8");

    const rows = products.map(
        (p, n) =>
            `| ${n + 1} | ${p.categoryZh || "(未知)"} | ${p.nameZh} | ${p.images.length} | ${p.paramTableHtml ? "有" : "—"} | ${p.url} |`,
    );
    const md = `# 西尔普产品清单(共 ${products.length} 款)

勾选要上架的款,回复序号即可。默认建议跳过「非标自动化 / 机械手自动化」等无固定参数款。

| # | 分类 | 中文名 | 图数 | 参数表 | 源 URL |
|---|------|--------|------|--------|--------|
${rows.join("\n")}
`;
    await writeFile(join(OUT_DIR, "manifest.md"), md, "utf8");

    console.log(`\n✓ 完成:${products.length} 款 → sharpecnc/raw.json + sharpecnc/manifest.md`);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
