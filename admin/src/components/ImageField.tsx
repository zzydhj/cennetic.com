import { useRef, useState } from 'react';
import { uploadMedia, imageDims } from '../lib/media';

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

/**
 * 图片选择器：点选或拖拽上传到 R2，缩略图预览、排序、改 alt、删除。
 * multiple=true → 值是 Img[]（如产品图集）；false → 值是 url 字符串（如文章主图）。
 */
export function ImageField({
    multiple,
    value,
    onChange,
}: {
    multiple: boolean;
    value: unknown;
    onChange: (v: unknown) => void;
}) {
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const list = toList(value, multiple);

    async function handleFiles(files: FileList | File[]): Promise<void> {
        setErr(null);
        setBusy(true);
        const acc: Img[] = multiple ? [...list] : [];
        try {
            for (const f of Array.from(files)) {
                if (!f.type.startsWith('image/')) continue;
                const { width, height } = await imageDims(f);
                const up = await uploadMedia(f);
                const img: Img = { src: up.url, alt: f.name.replace(/\.[^.]+$/, ''), width, height };
                if (multiple) {
                    acc.push(img);
                    onChange(acc);
                } else {
                    onChange(img.src);
                    break;
                }
            }
        } catch (e) {
            setErr(e instanceof Error ? e.message : '上传失败');
        } finally {
            setBusy(false);
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

    return (
        <div>
            <div
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer.files) void handleFiles(e.dataTransfer.files);
                }}
                className="cursor-pointer rounded-md border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500 hover:border-brand"
            >
                {busy ? '上传中…' : multiple ? '点击或拖入图片上传（可多张，第一张作列表封面）' : '点击或拖入图片上传'}
            </div>
            <input
                ref={inputRef}
                type="file"
                accept="image/*"
                multiple={multiple}
                hidden
                onChange={(e) => e.target.files && void handleFiles(e.target.files)}
            />
            {err && <p className="mt-1 text-xs text-red-600">{err}</p>}
            {list.length > 0 && (
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {list.map((img, i) => (
                        <div key={i} className="rounded-md border border-slate-200 p-2">
                            <img src={img.src} alt={img.alt || ''} className="h-28 w-full rounded object-cover" />
                            {multiple && (
                                <input
                                    className="mt-1 w-full rounded border border-slate-200 px-1.5 py-1 text-xs"
                                    placeholder="alt 说明"
                                    value={img.alt || ''}
                                    onChange={(e) => setAlt(i, e.target.value)}
                                />
                            )}
                            <div className="mt-1 flex items-center justify-between text-xs">
                                {multiple ? (
                                    <span className="flex gap-2">
                                        <button type="button" className="text-slate-500 hover:text-brand" onClick={() => move(i, -1)}>
                                            ◀
                                        </button>
                                        <button type="button" className="text-slate-500 hover:text-brand" onClick={() => move(i, 1)}>
                                            ▶
                                        </button>
                                    </span>
                                ) : (
                                    <span />
                                )}
                                <button type="button" className="text-red-500 hover:underline" onClick={() => remove(i)}>
                                    删除
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
