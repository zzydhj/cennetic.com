/**
 * 阶段二 · 表结构提取:把 raw.json 里的参数表/配置表 HTML 解析成结构化行(处理 rowspan 分组)。
 * 输出 sharpecnc/parsed.json,供翻译与入库使用。
 */
import * as cheerio from "cheerio";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ROOT } from "../migrate/lib/config.ts";

const DIR = join(ROOT, "sharpecnc");

interface SpecRow {
    group: string;
    item: string;
    unit: string;
    value: string;
}
interface ConfigRow {
    category: string;
    item: string;
    spec: string;
    std: boolean; // ●标配 / 选配
}

/** rowspan 感知的通用表格解析:返回每行的单元格文本数组(已把跨行合并的组列前向填充) */
function parseTable(html: string): string[][] {
    const $$ = cheerio.load(html);
    const rows: string[][] = [];
    const grid: (string | null)[][] = [];
    const $rows = $$("tr").toArray();

    $rows.forEach((tr, r) => {
        grid[r] = grid[r] || [];
        let c = 0;
        $$("td,th", tr).toArray().forEach((cell) => {
            while (grid[r][c] !== undefined && grid[r][c] !== null) c += 1;
            const text = $$(cell).text().replace(/\s+/g, " ").trim();
            const rs = Number($$(cell).attr("rowspan") || 1);
            const cs = Number($$(cell).attr("colspan") || 1);
            for (let i = 0; i < rs; i += 1) {
                for (let j = 0; j < cs; j += 1) {
                    grid[r + i] = grid[r + i] || [];
                    grid[r + i][c + j] = i === 0 && j === 0 ? text : text; // 合并区都填同一文本
                }
            }
            c += cs;
        });
    });

    const width = Math.max(...grid.map((row) => row.length));
    grid.forEach((row) => {
        const cells: string[] = [];
        for (let i = 0; i < width; i += 1) cells.push(row[i] ?? "");
        rows.push(cells);
    });
    return rows;
}

function toSpecs(html: string): SpecRow[] {
    const all = parseTable(html);
    const width = all[0]?.length ?? 0; // 表头列数决定布局
    const rows = all.slice(1); // 去表头
    const out: SpecRow[] = [];
    for (const r of rows) {
        if (width >= 5) {
            // 期望列:序号 | 名称(组) | 机型(项目) | 单位 | 参数
            const [idx, group, item, unit, value] = r;
            if (!/^\d+$/.test(idx) && !item) continue;
            out.push({ group, item, unit, value });
        } else if (width === 4) {
            // 主机参数表:序号 | 名称(项目) | 单位 | 机型列(参数值) —— 无独立分组列
            const [idx, item, unit, value] = r;
            if (!/^\d+$/.test(idx)) continue; // 去跨行合并产生的续行(无序号)
            out.push({ group: "", item, unit, value });
        }
    }
    return out;
}

function toConfig(html: string): ConfigRow[] {
    const rows = parseTable(html).slice(1);
    const out: ConfigRow[] = [];
    for (const r of rows) {
        // 序号 | 类别 | 项目 | 名称 | 型号规格 | 标配
        if (r.length < 6) continue;
        const [, category, item, name, spec, flag] = r;
        out.push({
            category,
            item: [item, name].filter(Boolean).join(" — "),
            spec,
            std: /●|标/.test(flag) && !/选/.test(flag),
        });
    }
    return out;
}

async function main(): Promise<void> {
    const raw = JSON.parse(await readFile(join(DIR, "raw.json"), "utf8")) as Array<{
        url: string;
        nameZh: string;
        images: string[];
        paramTableHtml: string;
        configTableHtml: string;
    }>;

    const parsed = raw.map((p) => ({
        url: p.url,
        nameZh: p.nameZh.replace(/\s+/g, " ").trim(),
        images: p.images,
        specs: p.paramTableHtml ? toSpecs(p.paramTableHtml) : [],
        config: p.configTableHtml ? toConfig(p.configTableHtml) : [],
    }));

    await writeFile(join(DIR, "parsed.json"), JSON.stringify(parsed, null, 2), "utf8");
    const withSpecs = parsed.filter((p) => p.specs.length > 0);
    console.log(`✓ 解析 ${parsed.length} 条,含参数表 ${withSpecs.length} 条 → sharpecnc/parsed.json`);
    // 打印一款样例核对
    const c600 = parsed.find((p) => /C600/.test(p.nameZh));
    if (c600) {
        console.log("\n样例 C600 specs 前 6 行:");
        c600.specs.slice(0, 6).forEach((s) => console.log(`  [${s.group}] ${s.item} | ${s.unit} | ${s.value}`));
        console.log("样例 C600 config 前 4 行:");
        c600.config.slice(0, 4).forEach((c) => console.log(`  [${c.category}] ${c.item} | ${c.spec} | ${c.std ? "标配" : "选配"}`));
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
