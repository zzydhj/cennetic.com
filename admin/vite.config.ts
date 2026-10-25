import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 后台 SPA 挂在主站 /admin 路径下，构建产物直接落到前台 dist/admin，
// 由同一个 Cloudflare Pages 项目一并部署（不建第二个 Pages 项目）。
export default defineConfig({
    plugins: [react()],
    base: '/admin/',
    build: {
        outDir: '../dist/admin',
        emptyOutDir: true,
    },
    server: {
        port: 5175,
    },
});
