/**
 * 迁移管道入口。
 *
 *   npm run migrate                → 按顺序跑完全部阶段
 *   npm run migrate -- 01 03       → 只跑指定阶段
 *   npm run migrate -- --refresh   → 忽略缓存重新抓取
 *   npm run migrate -- 01 03 09 --soft → 单阶段失败不中断整体（供 prebuild 用）
 */
import { fetchApi } from './01-fetch-api.ts';
import { buildManifest } from './02-manifest.ts';
import { buildMedia } from './03-media.ts';
import { buildArticles } from './04-articles.ts';
import { buildTaxonomies } from './05-taxonomies.ts';
import { buildProducts } from './06-products.ts';
import { buildDeployFiles, buildHeaders } from './08-deploy-files.ts';
import { stagePublicImages } from './09-stage-public.ts';

const ALL: Record<string, { title: string; run: (refresh: boolean) => Promise<void> }> = {
    '01': { title: 'REST 数据抓取', run: fetchApi },
    '02': { title: 'URL 基线清单', run: buildManifest },
    '03': { title: '图片下载与尺寸测量', run: buildMedia },
    '04': { title: '文章迁移', run: buildArticles },
    '05': { title: '分类数据迁移', run: buildTaxonomies },
    '06': { title: '产品数据迁移', run: buildProducts },
    // 阶段 07（页面迁移）已从管道里摘除：后台不再有「页面」这一内容类型，
    // 重跑它只会往一个没人读的目录里写文件。脚本本体留在 07-pages.ts 作清洗规则溯源。
    '08': {
        title: '部署文件生成',
        // _redirects / robots.txt 与 _headers 同属“Pages 部署配置”，一起产，
        // 避免改了缓存策略却忘了改跳转这类不匹配。
        // 两者都不接受 refresh：它们只读本地基线，不访问源站。
        run: async () => {
            await buildDeployFiles();
            await buildHeaders();
        },
    },
    '09': { title: '图片同步到 public', run: stagePublicImages },
};

async function main(): Promise<void> {
    const argv = process.argv.slice(2);
    const refresh = argv.includes('--refresh');
    // soft 模式给 CI 的 prebuild 用：拉不到源站资源时降级继续，
    // 因为「缺图但站点上线」远好于「整次部署失败」。
    const soft = argv.includes('--soft');
    const picked = argv.filter((a) => ALL[a]);
    const keys = picked.length > 0 ? picked : Object.keys(ALL);

    console.log(`迁移管道：${keys.join(' → ')}${refresh ? '  (忽略缓存)' : ''}${soft ? '  (容错)' : ''}`);

    const failed: string[] = [];

    for (const key of keys) {
        try {
            await ALL[key].run(refresh);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            if (!soft) throw err;
            failed.push(key);
            console.warn(`\n⚠ 阶段 ${key}（${ALL[key].title}）失败，已跳过：${msg}`);
        }
    }

    if (failed.length > 0) {
        console.warn(`\n完成，但有 ${failed.length} 个阶段被跳过：${failed.join(', ')}`);
        return;
    }

    console.log('\n全部阶段完成。');
}

main().catch((err) => {
    console.error('\n迁移管道失败：');
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
});
