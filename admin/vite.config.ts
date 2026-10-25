import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// 后台 SPA 挂在主站 /admin 路径下，构建产物直接落到前台 dist/admin，
// 由同一个 Cloudflare Pages 项目一并部署（不建第二个 Pages 项目）。

/** 仓库的 public/：Astro 原样发布的静态资源，线上就是这些 URL */
const SITE_PUBLIC = resolve(fileURLToPath(new URL('.', import.meta.url)), '../public');

/** 只代理这几类前缀，别把 vite 自己的模块请求也拦下来 */
const STATIC_PREFIXES = ['/images/', '/favicon', '/icon-', '/apple-touch-icon', '/robots.txt', '/site.webmanifest'];

const MIME: Record<string, string> = {
    '.webp': 'image/webp',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.gif': 'image/gif',
    '.avif': 'image/avif',
    '.ico': 'image/x-icon',
    '.mp4': 'video/mp4',
    '.txt': 'text/plain; charset=utf-8',
    '.webmanifest': 'application/manifest+json',
};

/**
 * 仅 dev 生效：把仓库 public/ 挂到与线上一致的路径上。
 * 媒体库里的站内图存的是 /images/… 相对地址（同源，线上直接可用），
 * 本地 vite 的根却是 admin/，不挂就整片裂图，分不清是数据问题还是环境问题。
 */
function serveSitePublic(): Plugin {
    return {
        name: 'serve-site-public',
        apply: 'serve',
        configureServer(server) {
            server.middlewares.use((req, res, next) => {
                const raw = (req.url ?? '').split('?')[0];
                if (raw.startsWith('/admin') || !STATIC_PREFIXES.some((p) => raw.startsWith(p))) return next();
                let file: string;
                try {
                    file = join(SITE_PUBLIC, decodeURIComponent(raw));
                } catch {
                    return next(); // 非法百分号编码
                }
                // 目录穿越防线 + 只回真文件
                if (!file.startsWith(SITE_PUBLIC + sep) || !existsSync(file) || !statSync(file).isFile()) return next();
                res.setHeader('Content-Type', MIME[extname(file).toLowerCase()] ?? 'application/octet-stream');
                res.setHeader('Cache-Control', 'no-cache');
                createReadStream(file).pipe(res);
            });
        },
    };
}

export default defineConfig({
    plugins: [react(), serveSitePublic()],
    base: '/admin/',
    build: {
        outDir: '../dist/admin',
        emptyOutDir: true,
    },
    server: {
        port: 5175,
    },
});
