import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
// 拉丁字体只取 latin 子集的 4 个字重（中文自动回落系统黑体）
import '@fontsource/albert-sans/latin-400.css';
import '@fontsource/albert-sans/latin-500.css';
import '@fontsource/albert-sans/latin-600.css';
import '@fontsource/albert-sans/latin-700.css';
import './index.css';

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        {/*
         * 用 hash 路由（地址形如 /admin/#/articles/123），不用 BrowserRouter。
         * 原因：路径式深链接要求服务端把 /admin/products 这类没有对应文件的地址
         * 回落到 index.html，而 _redirects 的 `200 重写 → 目录 index.html` 在
         * Cloudflare Pages 上实测不生效（线上 /admin/products 直接 404），
         * astro dev 也根本不读 _redirects。回落一旦失灵，刷新/收藏/新开标签
         * 全部打不开，而且只在生产暴露。hash 路由让 index.html 自己就能
         * 承载任意前端路由，开发和线上行为一致，不依赖任何部署配置。
         * 前台预览、外链都走绝对 URL（window.location.origin + 路径），不受影响。
         */}
        <HashRouter>
            <App />
        </HashRouter>
    </StrictMode>,
);
