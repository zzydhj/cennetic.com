/**
 * 正文 HTML 编辑器：工具条 + 等宽文本域 + 可选渲染预览。
 * 保存时仍由页面统一走 sanitizeHtml，这里的预览也先过一遍，避免「所见非所得」。
 */
import { useMemo, useRef, useState } from 'react';
import { sanitizeHtml } from '../lib/sanitize';
import { stripHtml } from '../lib/format';
import { cx } from '../lib/cx';
import { Icon } from './Icon';
import { Button, Switch, Textarea } from './ui';
import { MediaPicker } from './MediaPicker';

export function HtmlField({
    value,
    onChange,
    rows = 16,
    sample,
    help,
}: {
    value: unknown;
    onChange: (v: string) => void;
    rows?: number;
    /** 可选的 HTML 示例模板（产品详情用） */
    sample?: string;
    /** 字段说明，展示在工具条下方一行，不再靠悬停气泡 */
    help?: string;
}): JSX.Element {
    const text = String(value ?? '');
    const ref = useRef<HTMLTextAreaElement>(null);
    const [preview, setPreview] = useState(false);
    const [pick, setPick] = useState(false);
    const [showSample, setShowSample] = useState(false);

    const stat = useMemo(() => {
        const plain = stripHtml(text);
        return {
            words: plain ? plain.split(/\s+/).length : 0,
            chars: plain.length,
            imgs: (text.match(/<img\b/gi) ?? []).length,
            links: (text.match(/<a\b[^>]+href=["'](?!https?:\/\/)[^"']*["']/gi) ?? []).length,
            tables: (text.match(/<table\b/gi) ?? []).length,
        };
    }, [text]);

    /** 在光标处插入，插完把光标落到插入内容之后 */
    function insert(snippet: string): void {
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

    return (
        <div className="overflow-hidden rounded-lg border border-slate-200/90 bg-white shadow-inner transition-shadow focus-within:shadow-card focus-within:border-brand-300">
            {/* 工具条 */}
            <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 bg-[linear-gradient(180deg,#fcfdff,#f5f7fb)] px-2 py-1.5">
                <span className="mr-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    <Icon name="code" className="h-3.5 w-3.5" />
                    HTML
                </span>
                <Button size="sm" variant="secondary" icon="image" onClick={() => setPick(true)}>
                    插图
                </Button>
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
                    className={cx('html-preview max-h-[560px] overflow-y-auto bg-white px-4 py-3.5')}
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(text) }}
                />
            ) : (
                <Textarea
                    ref={ref}
                    mono
                    rows={rows}
                    value={text}
                    onChange={(e) => onChange(e.target.value)}
                    className="resize-y rounded-none border-0 bg-white shadow-none focus:shadow-none"
                    spellCheck={false}
                />
            )}

            <MediaPicker open={pick} onClose={() => setPick(false)} onPick={(m) => insert(
                `<img src="${m.src}" alt="${m.alt}"${m.width ? ` width="${m.width}"` : ''}${m.height ? ` height="${m.height}"` : ''} loading="lazy">`,
            )} />
        </div>
    );
}
