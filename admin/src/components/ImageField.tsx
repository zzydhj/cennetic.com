/**
 * 图片选择器：点选或拖拽上传到 R2（超过 400KB/长边 1600px 自动压缩为 WebP），
 * 缩略图预览、排序、改 alt、删除；multiple 时可用 max 限制张数。
 * multiple=true → 值是 Img[]（如产品图集）；false → 值是 url 字符串（如文章主图）。
 */
import { useRef, useState } from 'react';
import { uploadImage } from '../lib/media';
import { cx } from '../lib/cx';
import { Icon } from './Icon';

interface Img {
    src: string;
    alt?: string;
    width?: number;
    height?: number;
}

function toList(value: unknown, multiple: boolean): Img[] {
    if (multiple) return Array.isArray(value) ? (value as Img[]) : [];
    if (typeof value === 'string' && value) return [{ src: value }];
    return [];
}

export function ImageField({
    multiple,
    max,
    value,
    onChange,
}: {
    multiple: boolean;
    max?: number;
    value: unknown;
    onChange: (v: unknown) => void;
}): JSX.Element {
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const [drag, setDrag] = useState(false);
    const [done, setDone] = useState(0);
    const [total, setTotal] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const list = toList(value, multiple);
    const room = multiple && max ? max - list.length : Infinity;
    const atMax = multiple && !!max && list.length >= max;

    async function handleFiles(files: FileList | File[]): Promise<void> {
        setErr(null);
        const picked = Array.from(files).filter((f) => f.type.startsWith('image/'));
        let todo = picked;
        if (multiple && max) {
            if (room <= 0) {
                setErr(`最多 ${max} 张，如需替换请先删除`);
                return;
            }
            todo = picked.slice(0, room);
            if (picked.length > room) setErr(`已达上限 ${max} 张，多余的已忽略`);
        }
        setBusy(true);
        setTotal(todo.length);
        setDone(0);
        const acc: Img[] = multiple ? [...list] : [];
        try {
            for (const [i, f] of todo.entries()) {
                const up = await uploadImage(f);
                const img: Img = { src: up.url, alt: f.name.replace(/\.[^.]+$/, ''), width: up.width, height: up.height };
                if (multiple) {
                    acc.push(img);
                    onChange(acc);
                } else {
                    onChange(img.src);
                    break;
                }
                setDone(i + 1);
            }
        } catch (e) {
            setErr(e instanceof Error ? e.message : '上传失败');
        } finally {
            setBusy(false);
            setTotal(0);
            setDone(0);
            if (inputRef.current) inputRef.current.value = '';
        }
    }

    const move = (i: number, dir: number): void => {
        const j = i + dir;
        if (j < 0 || j >= list.length) return;
        const next = [...list];
        [next[i], next[j]] = [next[j] as Img, next[i] as Img];
        onChange(next);
    };
    const setAlt = (i: number, alt: string): void => onChange(list.map((x, k) => (k === i ? { ...x, alt } : x)));
    const remove = (i: number): void => (multiple ? onChange(list.filter((_, k) => k !== i)) : onChange(''));

    /* 图集固定按 max 个格子摆：从左往右依次填，没填到的位置留空位 */
    const slots: Array<Img | null> = Array.from({ length: Math.max(max ?? 0, list.length) }, (_, i) => list[i] ?? null);

    /** 用普通函数而不是内联组件：内联组件每次渲染都是新类型，alt 输入框会掉焦点 */
    const renderTile = (img: Img | null, i: number): JSX.Element => {
        if (!img) {
            return (
                <button
                    key={`slot-${i}`}
                    type="button"
                    onClick={() => !busy && !atMax && inputRef.current?.click()}
                    disabled={busy || atMax}
                    aria-label={`上传第 ${i + 1} 张`}
                    className={cx(
                        'focus-ring flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed transition-all duration-300 ease-expo',
                        busy || atMax
                            ? 'cursor-not-allowed border-slate-200 bg-slate-50/60 text-slate-300'
                            : 'cursor-pointer border-slate-200 bg-[linear-gradient(180deg,#fcfdff,#f6f8fb)] text-slate-400 hover:border-brand-300 hover:bg-brand-50/50 hover:text-brand-600',
                    )}
                >
                    <Icon name="plus" className="h-5 w-5" />
                    <span className="text-[11px] font-semibold text-slate-500">第 {i + 1} 张</span>
                    <span className="text-[10px]">{atMax ? '已达上限' : '点击上传'}</span>
                </button>
            );
        }
        return (
            <div key={img.src + i} className="group">
                <span className="relative block aspect-square w-full overflow-hidden rounded-lg border border-slate-200/80 bg-slate-100 shadow-card transition-all duration-300 ease-expo group-hover:shadow-lift">
                    {/* 1:1 居中裁切只看版式，不改文件；前台仍按原图比例显示 */}
                    <img src={img.src} alt={img.alt || ''} loading="lazy" className="h-full w-full object-cover" />
                    <span className="absolute left-1.5 top-1.5 rounded-full bg-ink-950/60 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white backdrop-blur">
                        {i === 0 ? '封面' : `#${i + 1}`}
                    </span>
                    {img.width && img.height && (
                        <span className="absolute bottom-1.5 left-1.5 rounded bg-ink-950/55 px-1 py-0.5 text-[9px] font-semibold tabular-nums text-white backdrop-blur">
                            {img.width}×{img.height}
                        </span>
                    )}
                    <span className="absolute right-1.5 top-1.5 flex gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                        <button
                            type="button"
                            onClick={() => move(i, -1)}
                            disabled={i === 0}
                            aria-label="前移"
                            className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-white/90 text-slate-600 shadow-card transition-colors hover:text-brand-700 disabled:opacity-40"
                        >
                            <Icon name="chevronLeft" className="h-3.5 w-3.5" />
                        </button>
                        <button
                            type="button"
                            onClick={() => move(i, 1)}
                            disabled={i === list.length - 1}
                            aria-label="后移"
                            className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-white/90 text-slate-600 shadow-card transition-colors hover:text-brand-700 disabled:opacity-40"
                        >
                            <Icon name="chevronRight" className="h-3.5 w-3.5" />
                        </button>
                        <button
                            type="button"
                            onClick={() => remove(i)}
                            aria-label="删除这张"
                            className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-white/90 text-accent shadow-card transition-colors hover:bg-accent hover:text-white"
                        >
                            <Icon name="trash" className="h-3.5 w-3.5" />
                        </button>
                    </span>
                </span>
                <input
                    className="focus-ring mt-1.5 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] placeholder:text-slate-400"
                    placeholder="alt 说明"
                    title={`alt 说明（利于 SEO）：${img.alt || '未填'}`}
                    value={img.alt || ''}
                    onChange={(e) => setAlt(i, e.target.value)}
                />
            </div>
        );
    };

    return (
        <div>
            {/* 拖拽/点击区 */}
            <div
                role="button"
                tabIndex={0}
                onClick={() => !atMax && !busy && inputRef.current?.click()}
                onKeyDown={(e) => {
                    if ((e.key === 'Enter' || e.key === ' ') && !atMax && !busy) inputRef.current?.click();
                }}
                onDragOver={(e) => {
                    e.preventDefault();
                    if (!atMax) setDrag(true);
                }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => {
                    e.preventDefault();
                    setDrag(false);
                    if (!atMax && e.dataTransfer.files) void handleFiles(e.dataTransfer.files);
                }}
                className={cx(
                    'focus-ring group relative flex items-center gap-3 overflow-hidden rounded-lg border-2 border-dashed px-3.5 py-3 transition-all duration-300 ease-expo',
                    atMax
                        ? 'cursor-not-allowed border-slate-200 bg-slate-50'
                        : drag
                            ? 'cursor-pointer border-brand-400 bg-brand-50/80 shadow-glow'
                            : 'cursor-pointer border-slate-200 bg-[linear-gradient(180deg,#fcfdff,#f6f8fb)] hover:border-brand-300 hover:bg-brand-50/40',
                )}
            >
                <span
                    className={cx(
                        'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors',
                        drag ? 'bg-brand-700 text-white shadow-glow' : 'bg-white text-brand-600 ring-1 ring-inset ring-slate-200 group-hover:ring-brand-200',
                    )}
                >
                    <Icon name={busy ? 'clock' : drag ? 'download' : 'upload'} className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                    <span className="block text-[12.5px] font-semibold text-slate-700">
                        {busy
                            ? `上传中…（${done}/${total || '?'}，大图先自动压缩）`
                            : atMax
                                ? `已达上限 ${max} 张`
                                : drag
                                    ? '松手即上传'
                                    : multiple
                                        ? '点击或拖入图片上传'
                                        : '点击或拖入图片（替换现有主图）'}
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-slate-400">
                        {atMax
                            ? '如需替换，先删掉一张再上传'
                            : multiple
                                ? `第一张自动作为列表封面 · 已传 ${list.length}/${max ?? '∞'}`
                                : '超过 400KB 或长边 1600px 自动转 WebP'}
                    </span>
                </span>
                {busy && (
                    <span className="absolute inset-x-0 bottom-0 h-0.5 bg-slate-200">
                        <span
                            className="block h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-700 transition-[width] duration-300 ease-expo"
                            style={{ width: total > 0 ? `${(done / total) * 100}%` : '35%' }}
                        />
                    </span>
                )}
            </div>
            <input
                ref={inputRef}
                type="file"
                accept="image/*"
                multiple={multiple}
                hidden
                onChange={(e) => e.target.files && void handleFiles(e.target.files)}
            />

            {err && (
                <p className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-accent">
                    <Icon name="alert" className="h-3.5 w-3.5" />
                    {err}
                </p>
            )}

            {multiple ? (
                /* 产品图集：固定 5 个 1:1 格子一排，从左往右依次填 */
                <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-5">
                    {slots.map((img, i) => renderTile(img, i))}
                </div>
            ) : (
                list.length > 0 && (
                    <div className="mt-3 grid grid-cols-1 gap-3">
                        {list.map((img, i) => (
                            <div
                                key={img.src + i}
                                className="group overflow-hidden rounded-lg border border-slate-200/80 bg-white shadow-card transition-all duration-300 ease-expo hover:shadow-lift"
                            >
                                <span className="relative block h-28 w-full bg-slate-100">
                                    <img src={img.src} alt={img.alt || ''} loading="lazy" className="h-full w-full object-cover" />
                                    <span className="absolute right-1.5 top-1.5 flex gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                                        <button
                                            type="button"
                                            onClick={() => remove(i)}
                                            aria-label="删除这张"
                                            className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-white/90 text-accent shadow-card transition-colors hover:bg-accent hover:text-white"
                                        >
                                            <Icon name="trash" className="h-3.5 w-3.5" />
                                        </button>
                                    </span>
                                </span>
                                <div className="p-2">
                                    <a
                                        href={img.src}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="flex items-center gap-1 truncate text-[11px] font-medium text-brand-600 hover:text-brand-700"
                                    >
                                        <Icon name="link" className="h-3 w-3 shrink-0" />
                                        <span className="truncate">{img.src}</span>
                                    </a>
                                    {img.width && img.height && (
                                        <p className="mt-1 text-[10px] tabular-nums text-slate-400">
                                            {img.width}×{img.height}
                                        </p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )
            )}
        </div>
    );
}
