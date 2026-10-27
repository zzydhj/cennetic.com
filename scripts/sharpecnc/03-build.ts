/**
 * 阶段二 · 组装:parsed.json + 术语表 + 目录 → sharpecnc/products.json。
 *
 * 每款输出:slug / name / summary / body(英文 HTML:概述 + 技术参数表 + 标准/选配表 + 制造商说明)
 * / specs(精简关键规格)/ categories / images(源 URL 暂存,02-images 下载后替换成本地路径)/ faq。
 *
 * 翻译残留中文会汇总打印,便于回 glossary.ts 补录 —— 目标:残留为 0。
 */
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ROOT } from "../migrate/lib/config.ts";
import { EXACT, PHRASES, UNIT_RULES } from "./glossary.ts";
import { CATALOG, CATEGORY_BY_TYPE, TYPE_LABEL } from "./catalog.ts";

const DIR = join(ROOT, "sharpecnc");

interface SpecRow { group: string; item: string; unit: string; value: string }
interface ConfigRow { category: string; item: string; spec: string; std: boolean }
interface Parsed { url: string; nameZh: string; images: string[]; specs: SpecRow[]; config: ConfigRow[] }

// 子串替换用所有多字键(EXACT + PHRASES),按长度降序做最长匹配。
// 单字单位(台/个/套/把/度/支)排除,避免污染「台湾/转台/主机」。
const ALL_KEYS = [
    ...new Set([...Object.keys(EXACT), ...PHRASES.map((p) => p[0])]),
]
    .filter((k) => k.length >= 2)
    .sort((a, b) => b.length - a.length);
const MAP: Record<string, string> = { ...EXACT };
for (const [k, v] of PHRASES) if (!(k in MAP)) MAP[k] = v;

const residual = new Set<string>();

function normalize(s: string): string {
    return (s || "").replace(/\s+/g, " ").trim();
}

/** 术语表翻译:先整串精确,再最长短语替换,最后单位正则收尾 */
function tr(raw: string): string {
    let s = normalize(raw);
    if (!s) return "";
    if (MAP[s]) return MAP[s];
    // 最长短语替换
    for (const k of ALL_KEYS) {
        if (s.includes(k)) s = s.split(k).join(MAP[k]);
    }
    // 单位正则
    for (const [re, rep] of UNIT_RULES) s = s.replace(re, rep);
    // 残留中文记录
    if (/[\u4e00-\u9fff]/.test(s)) residual.add(normalize(raw) + "  ==>  " + s);
    return s.replace(/\s{2,}/g, " ").trim();
}

function esc(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** 参数表 → 分组 HTML 表:同名连续 group 合并 rowspan */
function specTable(specs: SpecRow[]): string {
    const rows = specs
        .map((s) => ({ g: tr(s.group), i: tr(s.item), u: tr(s.unit), v: tr(s.value) }))
        .filter((r) => r.i || r.v);
    // 计算 group rowspan
    const out: string[] = [];
    let gi = 0;
    while (gi < rows.length) {
        let span = 1;
        while (gi + span < rows.length && rows[gi + span].g === rows[gi].g && rows[gi].g) span += 1;
        rows.slice(gi, gi + span).forEach((r, idx) => {
            const gcell = idx === 0 && r.g ? `<td rowspan="${span}">${esc(r.g)}</td>` : "";
            out.push(
                `<tr>${gcell}<td>${esc(r.i)}</td>${r.u ? `<td>${esc(r.u)}</td>` : ""}<td>${esc(r.v)}</td></tr>`,
            );
        });
        gi += span;
    }
    return `<table><thead><tr><th>Item</th><th>Unit</th><th>Spec</th></tr></thead><tbody>${out.join("")}</tbody></table>`;
}

/** 配置表 → 标准/选配两栏清单 */
function configTable(config: ConfigRow[]): string {
    const std = config.filter((c) => c.std);
    const opt = config.filter((c) => !c.std);
    const li = (c: ConfigRow) => `<li><strong>${tr(c.category)}</strong> — ${tr(c.item)}${c.spec ? ` (${tr(c.spec)})` : ""}</li>`;
    let h = "";
    if (std.length) h += `<h3>Standard equipment</h3><ul>${std.map(li).join("")}</ul>`;
    if (opt.length) h += `<h3>Optional equipment</h3><ul>${opt.map(li).join("")}</ul>`;
    return h;
}

/** 从 specs 里挑几项做精简规格卡(SpecTable 用) */
function keySpecs(specs: SpecRow[]): Array<{ name: string; values: string[] }> {
    const pick = (re: RegExp) => {
        const r = specs.find((s) => re.test(tr(s.item)) || re.test(s.item));
        return r ? tr(r.value) : "";
    };
    const out: Array<{ name: string; values: string[] }> = [];
    const add = (name: string, v: string) => { if (v) out.push({ name, values: [v] }); };
    add("X-axis travel", pick(/^X-axis travel$/i));
    add("Y-axis travel", pick(/^Y-axis travel$/i));
    add("Z-axis travel", pick(/^Z-axis travel$/i));
    add("Spindle speed", pick(/spindle speed|rpm/i));
    add("Spindle power", pick(/spindle (motor )?power|kW/i));
    add("Tool magazine", pick(/magazine capacity|tools/i));
    add("Positioning accuracy", pick(/positioning accuracy/i));
    add("Repeatability", pick(/repeatability/i));
    return out.slice(0, 8);
}

function body(entry: (typeof CATALOG)[number], p: Parsed): string {
    const parts: string[] = [entry.summary];
    if (p.specs.length) parts.push(`<h2>Technical specifications</h2>`, specTable(p.specs));
    if (p.config.length) parts.push(`<h2>Equipment</h2>`, configTable(p.config));
    parts.push(
        `<h2>About this model</h2><p>This ${TYPE_LABEL[entry.type]} is manufactured by our partner factory in Dongguan, China, and supplied direct by CENNETIC with factory-direct pricing, a standard warranty and remote setup support. Specifications are representative and can be confirmed against your machining requirements before order.</p>`,
    );
    return parts.join("\n");
}

async function main(): Promise<void> {
    const parsed = JSON.parse(await readFile(join(DIR, "parsed.json"), "utf8")) as Parsed[];
    const byPid = new Map(parsed.map((p) => [p.url.match(/view_(\d+)_/)![1], p]));

    // 保留上一轮 02-images 已回填的 images(按 slug),重跑 build 不丢图、不触发重下
    let prevImages: Record<string, unknown> = {};
    try {
        const prev = JSON.parse(await readFile(join(DIR, "products.json"), "utf8")) as Array<{
            slug: string;
            images?: unknown[];
        }>;
        for (const p of prev) if (p.images?.length) prevImages[p.slug] = p.images;
    } catch {
        /* 首轮无 products.json */
    }

    const products = [];
    for (const entry of CATALOG) {
        const p = byPid.get(entry.pid);
        if (!p) { console.log(`! 缺数据 pid=${entry.pid} (${entry.model})`); continue; }
        const cat = CATEGORY_BY_TYPE[entry.type];
        products.push({
            slug: entry.slug,
            name: entry.name,
            model: entry.model,
            type: entry.type,
            summary: entry.summary,
            body: body(entry, p),
            specs: keySpecs(p.specs),
            categories: [{ slug: cat.slug, name: cat.name, canonical: `/product-category/${cat.slug}/` }],
            images: prevImages[entry.slug] ?? [],
            sourceImages: p.images,
            url: p.url,
            faq: [],
        });
    }

    await writeFile(join(DIR, "products.json"), JSON.stringify(products, null, 2), "utf8");
    console.log(`✓ 组装 ${products.length} 款 → sharpecnc/products.json`);

    if (residual.size) {
        console.log(`\n⚠ 残留中文 ${residual.size} 处(需补 glossary.ts):`);
        [...residual].slice(0, 80).forEach((r) => console.log("   " + r));
    } else {
        console.log("✓ 无残留中文,翻译全覆盖");
    }
}

main().catch((e) => { console.error(e); process.exit(1); });
