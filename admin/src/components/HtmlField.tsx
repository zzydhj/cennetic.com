/**
 * 正文编辑器：纯文本模式（空行分段、系统自动包 <p>）与源码模式（完整 HTML）二选一，
 * 外加固定高度的渲染预览——编辑区与预览区同高，切换不跳版。
 * 存量迁移正文含表格/样式等复杂结构：这类内容锁定纯文本模式，避免段落化破坏结构。
 * 保存时仍由页面统一走 sanitizeHtml，这里的预览也先过一遍，避免「所见非所得」。
 */
import { useEffect, useMemo, useRef, useState, type ClipboardEvent as ReactClipboardEvent } from 'react';
import { uploadImage } from '../lib/media';
import { useUploadScope } from '../lib/uploadScope';
import { useToast } from './Toast';
import { sanitizeHtml } from '../lib/sanitize';
import { stripHtml } from '../lib/format';
import { cx } from '../lib/cx';
import { Icon } from './Icon';
import { Button, Switch, Textarea } from './ui';
import { MediaPicker } from './MediaPicker';

/** 编辑区与预览区共用的固定高度：切换预览、切换模式都不跳版；compact 给简介这类短字段 */
const PANE_H = 'h-[26rem]';
const PANE_H_SM = 'h-40';

/** 只允许 p / br / img（插图插入的）/ style（整段 CSS）算「简单内容」；出现其它标签（表格/标题等）即复杂结构 */
const COMPLEX_TAG = /<(?!\/?(p|br|img|style)\b)[^>]*>/i;

/** 纯文本 → HTML：空行分段包 <p>，段内换行变 <br>；以 < 开头的块与整段 <style> 原样保留 */
function textToHtml(plain: string): string {
    /* 先摘出整段 CSS：里面有空行也不能被切成段落 */
    const styles: string[] = [];
    const stripped = plain.replace(/<style[\s\S]*?<\/style>/gi, (m) => {
        styles.push(m);
        return `\u0000STYLE${styles.length - 1}\u0000`;
    });
    const html = stripped
        .split(/\n{2,}/)
        .filter((b) => b.trim() !== '')
        .map((b) => (b.trimStart().startsWith('<') ? b : `<p>${b.replace(/\n/g, '<br>')}</p>`))
        .join('\n');
    return html.replace(/(?:<p>)?\u0000STYLE(\d+)\u0000(?:<\/p>)?/g, (_, i: string) => styles[Number(i)] ?? '');
}

/** HTML → 纯文本：只拆 p/br，其余标签原样留着（复杂内容本就不该进纯文本模式） */
function htmlToText(html: string): string {
    return html
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p\s*>/gi, '\n\n')
        .replace(/<p(\s[^>]*)?>/gi, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

export function HtmlField({
    value,
    onChange,
    sample,
    help,
    compact,
}: {
    value: unknown;
    onChange: (v: string) => void;
    /** 可选的 HTML 示例模板（产品详情用） */
    sample?: string;
    /** 字段说明，展示在工具条下方一行，不再靠悬停气泡 */
    help?: string;
    /** 矮版编辑区：简介这类一两句的字段不用占一整屏 */
    compact?: boolean;
}): JSX.Element {
    const text = String(value ?? '');
    const ref = useRef<HTMLTextAreaElement>(null);
    const toast = useToast();
    /* 上传时要告诉服务端这张图属于哪篇内容，才能生成带归属的文件名 */
    const scope = useUploadScope();
    const [pasting, setPasting] = useState(0);
    const [preview, setPreview] = useState(false);
    const [pick, setPick] = useState(false);
    const [showSample, setShowSample] = useState(false);
    /* 纯文本模式自己的草稿：显示不走 value 反推，避免输入过程中的往返抖动 */
    const [plain, setPlain] = useState(() => htmlToText(text));
    const [mode, setMode] = useState<'plain' | 'html'>(() => (COMPLEX_TAG.test(text) ? 'html' : 'plain'));

    /* 外部改动（载入、放弃改动、插模板）同步进来：复杂内容强制回源码模式，简单内容刷新纯文本草稿 */
    useEffect(() => {
        if (COMPLEX_TAG.test(text)) {
            if (mode === 'plain') setMode('html');
            return;
        }
        if (mode === 'plain' && textToHtml(plain) !== text) setPlain(htmlToText(text));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [text]);

    const canPlain = !COMPLEX_TAG.test(text);
    const paneH = compact ? PANE_H_SM : PANE_H;

    const stat = useMemo(() => {
        const p = stripHtml(text);
        return {
            words: p ? p.split(/\s+/).length : 0,
            chars: p.length,
            imgs: (text.match(/<img\b/gi) ?? []).length,
            links: (text.match(/<a\b[^>]+href=["'](?!https?:\/\/)[^"']*["']/gi) ?? []).length,
            tables: (text.match(/<table\b/gi) ?? []).length,
        };
    }, [text]);

    /** 源码模式在光标处插入；纯文本模式追加成独立一段（插的是标签，不是文字） */
    function insert(snippet: string): void {
        if (mode === 'plain') {
            const next = plain ? `${plain.replace(/\n+$/, '')}\n\n${snippet}` : snippet;
            setPlain(next);
            onChange(textToHtml(next));
            return;
        }
        const el = ref.current;
        if (!el) {
            onChange(text + snippet);
            return;
        }
        const s = el.selectionStart;
        const e = el.selectionEnd;
        const next = text.slice(0, s) + snippet + text.slice(e);
        onChange(next);
        requestAnimationFrame(() => {
            el.focus();
            el.selectionStart = el.selectionEnd = s + snippet.length;
        });
    }

    /*
     * 粘贴本地图片（包括从微信/QQ/浏览器复制的截图）：直接传图并插在光标处。
     * 以前必须先切到媒体库页上传、再回编辑页用「插图」挑回来，写到一半跳走很容易丢内容。
     * 挂在容器上而不是 textarea：自定义 Textarea 不一定会转发 onPaste，而事件会冒泡到这一层。
     */
    async function onPaste(e: ReactClipboardEvent<HTMLDivElement>): Promise<void> {
        const files = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith('image/'));
        if (!files.length) return;   // 粘的是文字，不拦，走浏览器默认行为
        e.preventDefault();
        setPasting((n) => n + files.length);
        for (const f of files) {
            try {
                const up = await uploadImage(f, scope);
                const stem = f.name.replace(/\.[^.]+$/, '').trim();
                /* 截图类文件名（image1、截图、blob…）当 alt 没有意义，宁可不填也要提醒补，
                   否则正文里会攒出一堆无效 alt —— 这次刚把产品图的空 alt 清理过 */
                const generic = !stem || /^(image|blob|screenshot|screen[\s-]*shot|pasted|截图|屏幕快照|图片)\d*$/i.test(stem);
                insert(
                    `<img src="${up.url}" alt="${generic ? '' : stem.replace(/"/g, '')}"${up.width ? ` width="${up.width}"` : ''}${up.height ? ` height="${up.height}"` : ''} loading="lazy">`,
                );
                if (generic) toast.ok('图片已插入', '文件名看不出内容，alt 先留空了，请补一句描述');
            } catch (err) {
                toast.fail('粘贴的图片没传上去', err instanceof Error ? err.message : '未知错误');
            } finally {
                setPasting((n) => Math.max(0, n - 1));
            }
        }
    }

    const toPlain = (): void => {
        if (!canPlain) return;
        setPlain(htmlToText(text));
        setMode('plain');
    };
    const toHtml = (): void => {
        onChange(textToHtml(plain));
        setMode('html');
    };

    return (
        <div
            onPaste={onPaste}
            className="overflow-hidden rounded-lg border border-slate-200/90 bg-white shadow-inner transition-shadow focus-within:shadow-card focus-within:border-brand-300"
        >
            {/* 工具条 */}
            <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 bg-[linear-gradient(180deg,#fcfdff,#f5f7fb)] px-2 py-1.5">
                <span className="mr-0.5 flex items-center gap-0.5 rounded-md bg-slate-200/70 p-0.5">
                    <button
                        type="button"
                        onClick={toPlain}
                        disabled={!canPlain}
                        title={canPlain ? '像写字一样输入：空行分段，系统自动包段落标签；整段 <style> CSS 也会原样保留' : '含表格等复杂结构，只能源码模式编辑，避免改坏'}
                        className={cx(
                            'rounded px-2 py-1 text-[11px] font-medium transition-colors',
                            mode === 'plain' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700',
                            !canPlain && 'cursor-not-allowed opacity-40 hover:text-slate-500',
                        )}
                    >
                        纯文本
                    </button>
                    <button
                        type="button"
                        onClick={toHtml}
                        title="直接编辑 HTML 源码（表格、样式、图集这类复杂内容用这个）"
                        className={cx(
                            'rounded px-2 py-1 text-[11px] font-medium transition-colors',
                            mode === 'html' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700',
                        )}
                    >
                        源码
                    </button>
                </span>
                <Button size="sm" variant="secondary" icon="image" onClick={() => setPick(true)}>
                    插图
                </Button>
                {pasting > 0 && (
                    <span className="flex items-center gap-1 rounded bg-brand-50 px-2 py-1 text-[11px] font-medium text-brand-700">
                        <Icon name="image" className="h-3.5 w-3.5" />
                        图片上传中 ×{pasting}
                    </span>
                )}
                {sample && (
                    <Button size="sm" variant="secondary" icon="layers" onClick={() => setShowSample((s) => !s)}>
                        示例模板
                    </Button>
                )}
                <span className="ml-auto flex items-center gap-2">
                    <span className="hidden items-center gap-2 text-[10px] tabular-nums text-slate-400 sm:flex">
                        <span title="正文纯文本字数">{stat.words} 词</span>
                        <span className="h-2.5 w-px bg-slate-200" />
                        <span title="图片数">{stat.imgs} 图</span>
                        <span className="h-2.5 w-px bg-slate-200" />
                        <span title="内部链接数">{stat.links} 内链</span>
                        {stat.tables > 0 && (
                            <>
                                <span className="h-2.5 w-px bg-slate-200" />
                                <span title="表格数">{stat.tables} 表</span>
                            </>
                        )}
                    </span>
                    <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                        预览
                        <Switch checked={preview} onChange={setPreview} label="渲染预览" />
                    </span>
                </span>
            </div>

            {help && <p className="border-b border-slate-100 bg-white px-3 py-1.5 text-[11px] leading-relaxed text-slate-400">{help}</p>}

            {showSample && sample && (
                <div className="border-b border-slate-100 bg-gold-soft/70 p-3 animate-fade-up">
                    <div className="mb-2 flex items-center gap-2">
                        <Icon name="sparkle" className="h-3.5 w-3.5 text-gold-600" />
                        <span className="text-[11px] font-semibold text-gold-700">不知道怎么写就照这个改</span>
                        <Button
                            size="sm"
                            variant="gold"
                            className="ml-auto"
                            onClick={() => {
                                if (text.trim() && !confirm('上方已有内容，插入模板会覆盖，继续？')) return;
                                onChange(sample);
                                if (COMPLEX_TAG.test(sample)) setMode('html');
                                setShowSample(false);
                            }}
                        >
                            插入模板
                        </Button>
                        <Button size="sm" variant="ghost" icon="close" onClick={() => setShowSample(false)}>
                            收起
                        </Button>
                    </div>
                    <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-lg bg-white/80 p-2.5 font-mono text-[11px] leading-relaxed text-slate-600 ring-1 ring-inset ring-gold-300/40">
                        {sample}
                    </pre>
                </div>
            )}

            {preview ? (
                <div
                    className={cx('html-preview overflow-y-auto bg-white px-4 py-3.5', paneH)}
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(text) }}
                />
            ) : mode === 'plain' ? (
                <Textarea
                    value={plain}
                    onChange={(e) => {
                        setPlain(e.target.value);
                        onChange(textToHtml(e.target.value));
                    }}
                    placeholder="直接写字：空一行就是新段落，系统自动包段落标签；插图可点上方按钮，也可以把图复制过来直接粘贴。"
                    className={cx('resize-none rounded-none border-0 bg-white shadow-none focus:shadow-none', paneH)}
                />
            ) : (
                <Textarea
                    ref={ref}
                    mono
                    value={text}
                    onChange={(e) => onChange(e.target.value)}
                    className={cx('resize-none rounded-none border-0 bg-white shadow-none focus:shadow-none', paneH)}
                    spellCheck={false}
                />
            )}

            <MediaPicker open={pick} onClose={() => setPick(false)} onPick={(m) => insert(
                `<img src="${m.src}" alt="${m.alt}"${m.width ? ` width="${m.width}"` : ''}${m.height ? ` height="${m.height}"` : ''} loading="lazy">`,
            )} />
        </div>
    );
}
