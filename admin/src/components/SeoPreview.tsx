/**
 * SEO 实时预览：Google 搜索结果条目 + 社交分享卡，边填边看。
 * 只做展示与长度计（区间与前台 zod/content-schema 的约定一致），不参与保存。
 */
import { useMemo } from 'react';
import { cx } from '../lib/cx';
import { Icon } from './Icon';
import { ProgressBar } from './ui';

interface MeterProps {
    label: string;
    value: string;
    min: number;
    max: number;
}

function Meter({ label, value, min, max }: MeterProps): JSX.Element {
    const len = value.trim().length;
    const tone = len === 0 ? 'slate' : len < min ? 'amber' : len > max ? 'red' : 'green';
    const tones = {
        slate: 'text-slate-400',
        amber: 'text-amber-600',
        red: 'text-accent',
        green: 'text-emerald-600',
    };
    return (
        <div>
            <div className="mb-1 flex items-center justify-between text-[10px]">
                <span className="font-medium uppercase tracking-wider text-slate-400">{label}</span>
                <span className={cx('font-semibold tabular-nums', tones[tone])}>
                    {len} / {min}–{max}
                </span>
            </div>
            <ProgressBar
                value={Math.min(100, (len / max) * 100)}
                tone={tone === 'green' ? 'green' : tone === 'red' ? 'red' : tone === 'amber' ? 'gold' : 'brand'}
            />
        </div>
    );
}

export function SeoPreview({
    title,
    description,
    path,
    brand,
    hero,
    heroAlt,
}: {
    title: string;
    description: string;
    path: string;
    brand: string;
    hero?: string | null;
    heroAlt?: string;
}): JSX.Element {
    const host = typeof window === 'undefined' ? '' : window.location.host;
    const crumbs = useMemo(() => {
        const seg = path.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
        return [host || 'cennetic.com', ...seg].join(' › ');
    }, [path, host]);

    return (
        <div className="space-y-4">
            {/* Google 条目 */}
            <div>
                <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    <Icon name="search" className="h-3 w-3" />
                    搜索结果条目
                </p>
                <div className="rounded-lg border border-slate-200/80 bg-white p-3 shadow-inner">
                    <p className="flex items-center gap-2 text-[11px] text-slate-500">
                        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-brand-700 text-[7px] font-bold text-white">
                            C
                        </span>
                        {brand}
                    </p>
                    <p className="mt-1 truncate text-[11px] text-slate-500">{crumbs}</p>
                    <p className="mt-1 line-clamp-2 cursor-default text-[15px] leading-snug text-[#1a0dab] hover:underline">{title || '（未填写 SEO 标题）'}</p>
                    <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-slate-600">
                        {description || '（未填写摘要，Google 会自行截取正文）'}
                    </p>
                </div>
            </div>

            {/* 分享卡 */}
            <div>
                <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    <Icon name="link" className="h-3 w-3" />
                    社交分享卡
                </p>
                <div className="overflow-hidden rounded-lg border border-slate-200/80 bg-white shadow-inner">
                    {hero ? (
                        <img src={hero} alt={heroAlt ?? ''} loading="lazy" className="h-28 w-full bg-slate-100 object-cover" />
                    ) : (
                        <div className="flex h-28 w-full items-center justify-center bg-[linear-gradient(150deg,#eff4fb,#dbe6f5)] text-[11px] font-medium text-brand-500">
                            未设置主图 · 分享时将只显示文字
                        </div>
                    )}
                    <div className="px-3 py-2">
                        <p className="truncate text-[11px] uppercase tracking-wider text-slate-400">{host || 'cennetic.com'}</p>
                        <p className="mt-0.5 truncate text-[13px] font-semibold text-slate-800">{title || '（未填写标题）'}</p>
                        <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-slate-500">{description || '（未填写摘要）'}</p>
                    </div>
                </div>
            </div>

            <div className="space-y-2.5 rounded-lg bg-slate-50/80 p-3 ring-1 ring-inset ring-slate-100">
                <Meter label="SEO 标题" value={title} min={30} max={60} />
                <Meter label="摘要" value={description} min={50} max={160} />
                <p className="flex items-start gap-1.5 text-[10px] leading-relaxed text-slate-400">
                    <Icon name="alert" className="mt-px h-3 w-3 shrink-0" />
                    区间按 content-schema 的约定校验；超出只是提示，不会阻止保存。
                </p>
            </div>
        </div>
    );
}
