/**
 * 阶段二 · 入库:products.json → Supabase(products + 新分类),之后 `npm run snapshot` 回写仓库。
 *
 * 列口径对齐 seed-supabase:products.categories 存 slug 数组(canonical 由 snapshot 展开),
 * canonical=/product/<slug>/,status=published。5 轴是本站新分类,补一行 product_categories。
 * 幂等:按 slug upsert(merge-duplicates),整行给全字段,重跑覆盖同值。
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createRestClient } from "../cms/lib/rest.ts";
import { loadEnvFile, requireEnv } from "../cms/lib/env.ts";
import { ROOT } from "../migrate/lib/config.ts";

loadEnvFile();
const rest = createRestClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SECRET_KEY"));

interface Product {
    slug: string;
    name: string;
    summary: string;
    body: string;
    specs: Array<{ name: string; values: string[] }>;
    categories: Array<{ slug: string }>;
    images: Array<{ src: string; alt: string; width: number; height: number }>;
    faq: unknown[];
}

async function main(): Promise<void> {
    const products = JSON.parse(
        await readFile(join(ROOT, "sharpecnc", "products.json"), "utf8"),
    ) as Product[];

    // 新分类:5 轴(仅当 products 里用到才建)
    const needs5Axis = products.some((p) =>
        p.categories.some((c) => c.slug === "5-axis-machining-centers"),
    );
    if (needs5Axis) {
        await rest.upsert(
            "product_categories",
            [
                {
                    slug: "5-axis-machining-centers",
                    name: "5-Axis Machining Centers",
                    description:
                        "Trunnion, gantry and compact 5-axis machining centers for simultaneous multi-face and complex-contour machining.",
                    parent: "0",
                    canonical: "/product-category/5-axis-machining-centers/",
                    trail: ["5-axis-machining-centers"],
                    robots: "follow, index, max-snippet:-1, max-video-preview:-1, max-image-preview:large",
                    title: "5-Axis Machining Centers",
                    count: 0,
                },
            ],
            "slug",
        );
    }

    const rows = products.map((p) => ({
        slug: p.slug,
        name: p.name,
        canonical: `/product/${p.slug}/`,
        summary: p.summary,
        body: p.body,
        images: p.images ?? [],
        categories: p.categories.map((c) => c.slug),
        specs: p.specs ?? [],
        faq: p.faq ?? [],
        status: "published",
    }));

    await rest.upsert("products", rows, "slug");
    console.log(`\n✓ 已入库 ${rows.length} 款产品${needs5Axis ? " + 新分类 5-axis-machining-centers" : ""}`);
    console.log("  下一步:npm run snapshot → snapshot:check → 本地预览 → build → 提交");
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
