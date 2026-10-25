import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * 路径别名。tsconfig 的 paths 只供类型检查，Vite 运行时解析要在这里再声明一次，
 * 两边必须保持一致，否则会出现「IDE 不报错但构建找不到模块」。
 */
const alias = (p) => fileURLToPath(new URL(`./src/${p}`, import.meta.url));

/**
 * 数据里标了 noindex 的分类页不进 sitemap：页面模板与这里读同一份 JSON，不会漂移。
 * noindex 页出现在 sitemap 里等于一边说“别收录”一边递地址，信号矛盾。
 * （文章/固定页面的 robots 在 frontmatter 里；若将来出现 noindex 文章，
 *  npm run verify:site 会当场报出来，届时再把来源扩到内容集合。）
 */
const dataPath = (p) => fileURLToPath(new URL(`./src/data/${p}`, import.meta.url));

function noindexPaths() {
    const out = new Set();
    for (const f of readdirSync(dataPath('blog-categories'))) {
        const c = JSON.parse(readFileSync(dataPath(`blog-categories/${f}`), 'utf8'));
        if (/noindex/i.test(c.robots ?? '')) out.add(`/category/${c.slug}/`);
    }
    for (const c of JSON.parse(readFileSync(dataPath('product-categories.json'), 'utf8'))) {
        if (/noindex/i.test(c.robots ?? '')) out.add(c.canonical.endsWith('/') ? c.canonical : `${c.canonical}/`);
    }
    return out;
}

const NOINDEX = noindexPaths();

// https://astro.build/config
export default defineConfig({
  site: 'https://www.cennetic.com/',

  output: 'static',

  build: {
    // WordPress 全部 URL 是「目录式带尾斜杠」：/about-us/
    // directory 格式输出 about-us/index.html，天然对齐，无需任何重写规则。
    format: 'directory',
  },

  // 与 WordPress 保持一致的带尾斜杠 URL；ignore 避免出现重定向抖动。
  trailingSlash: 'ignore',

  compressHTML: true,

  integrations: [
    sitemap({
      // 后台是纯静态 HTML 页，不应进入收录范围；noindex 的分类页也不递地址
      filter: (page) => {
        const path = new URL(page).pathname;
        return !path.startsWith('/admin/') && !NOINDEX.has(path);
      },
      // 原站 Rank Math 输出的 URL 一律带尾斜杠，保持一致
      serialize: (item) => ({
        ...item,
        url: item.url.endsWith('/') ? item.url : `${item.url}/`,
      }),
    }),
  ],

  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        '@components': alias('components'),
        '@layouts': alias('layouts'),
        '@styles': alias('styles'),
        '@data': alias('data'),
        '@lib': alias('lib'),
      },
    },
  },

  // astro:assets 默认走 sharp，负责 AVIF/WebP 多尺寸与显式宽高。
  // 具体尺寸在各图片组件里声明，不在此处做全局猜测。
  image: {
    responsiveStyles: true,
  },
});
