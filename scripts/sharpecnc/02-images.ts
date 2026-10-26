/**
 * 阶段二 · 图片:下载源站产品图 → 转 webp(宽 ≤1600,q80)→ 落 public/images/products/<slug>/,
 * 回写 products.json 的 images 字段为 {src,alt,width,height}(真实宽高防 CLS)。
 *
 * 目录名用中性的 products(不用合作方域名 sharpecnc,避免品牌泄漏到图片 URL)。
 *
 * 每款上限 8 张(源详情图常有十几张,够展示即可,控制仓库体积)。
 * 下载用 http.ts 的 downloadTo(目标文件即缓存,重跑跳过);已存在且 products.json 已回填则整款跳过。
 */
import sharp from "sharp";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ROOT } from "../migrate/lib/config.ts";
import { downloadTo } from "../migrate/lib/http.ts";

const SRC = "https://www.sharpecnc.com";
const DIR = join(ROOT, "sharpecnc");
const IMG_ROOT = join(ROOT, "public", "images", "products");
const MAX_IMGS = 8;
const WEBP_MAX_W = 1600;

interface Product {
    slug: string;
    name: string;
    sourceImages: string[];
    images?: Array<{ src: string; alt: string; width: number; height: number }>;
}

async function main(): Promise<void> {
    const products = JSON.parse(await readFile(join(DIR, "products.json"), "utf8")) as Product[];

    for (const p of products) {
        if (p.images?.length) {
            console.log(`  · ${p.slug}: 已回填,跳过`);
            continue;
        }
        const dir = join(IMG_ROOT, p.slug);
        await mkdir(dir, { recursive: true });
        const urls = p.sourceImages.slice(0, MAX_IMGS);
        const out: Product["images"] = [];

        for (let i = 0; i < urls.length; i += 1) {
            const rawUrl = urls[i].startsWith("http") ? urls[i] : `${SRC}/${urls[i].replace(/^\//, "")}`;
            const tmpFile = join(dir, `src-${i}.bin`);
            const { bytes } = await downloadTo(rawUrl, tmpFile);
            if (!bytes) {
                console.log(`    ! 图 ${i + 1} 下载失败: ${rawUrl}`);
                continue;
            }
            const webpName = `${String(i + 1).padStart(2, "0")}.webp`;
            const webpFile = join(dir, webpName);
            const info = await sharp(bytes)
                .resize({ width: WEBP_MAX_W, withoutEnlargement: true })
                .webp({ quality: 80 })
                .toFile(webpFile);
            out.push({
                src: `/images/products/${p.slug}/${webpName}`,
                alt: `${p.name} — view ${i + 1}`,
                width: info.width,
                height: info.height,
            });
        }

        p.images = out;
        console.log(`  ✓ ${p.slug}: ${out.length} 张`);
    }

    await writeFile(join(DIR, "products.json"), JSON.stringify(products, null, 2), "utf8");
    console.log("\n✓ 图片处理完成,products.json 已回填 images");
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
