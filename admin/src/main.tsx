import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
// 拉丁字体只取 latin 子集的 4 个字重（中文自动回落系统黑体）
import '@fontsource/albert-sans/latin-400.css';
import '@fontsource/albert-sans/latin-500.css';
import '@fontsource/albert-sans/latin-600.css';
import '@fontsource/albert-sans/latin-700.css';
import './index.css';

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <BrowserRouter basename="/admin">
            <App />
        </BrowserRouter>
    </StrictMode>,
);
