/**
 * 仪表盘用的读数卡原语：大数字 + 走势 + 同比气泡。
 * 数字为 number 时做 count-up（300ms 内跑到位），这是「有动效但不吵」的关键一处。
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cx } from '../lib/cx';
import { num } from '../lib/format';
import { Icon, type IconName } from './Icon';
import { Sparkline, type ChartTone } from './Charts';

const chipTone: Record<ChartTone, string> = {
    brand: 'bg-[linear-gradient(160deg,#5b83c2,#012760)] text-white shadow-glow ring-white/20',
    gold: 'bg-[linear-gradient(160deg,#e3c98a,#a1741c)] text-white shadow-gold ring-white/25',
    green: 'bg-[linear-gradient(160deg,#6ee7b7,#059669)] text-white ring-emerald-100',
    red: 'bg-[linear-gradient(160deg,#f7a3b3,#c8102e)] text-white ring-accent/15',
};

/** count-up：只在挂载时跑一次，避免父组件重渲染导致数字反复跳 */
export function CountUp({ value, decimals = 0 }: { value: number; decimals?: number }): JSX.Element {
    const [shown, setShown] = useState(0);
    const raf = useRef<number | null>(null);

    useEffect(() => {
        const start = performance.now();
        const dur = 650;
        const tick = (t: number): void => {
            const p = Math.min(1, (t - start) / dur);
            const eased = 1 - (1 - p) ** 3;
            setShown(value * eased);
            if (p < 1) raf.current = requestAnimationFrame(tick);
        };
        raf.current = requestAnimationFrame(tick);
        return () => {
            if (raf.current != null) cancelAnimationFrame(raf.current);
        };
    }, [value]);

    return <>{decimals > 0 ? shown.toFixed(decimals) : num(Math.round(shown))}</>;
}

export function TrendChip({ dir, children }: { dir: 'up' | 'down' | 'flat'; children: ReactNode }): JSX.Element {
    const map = {
        up: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
        down: 'bg-accent-soft text-accent ring-accent/15',
        flat: 'bg-slate-100 text-slate-500 ring-slate-200',
    };
    const icon: IconName = dir === 'up' ? 'trendUp' : dir === 'down' ? 'trendDown' : 'minus';
    return (
        <span className={cx('inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset', map[dir])}>
            <Icon name={icon} className="h-3 w-3" strokeWidth={2} />
            {children}
        </span>
    );
}

export function StatCard({
    label,
    value,
    suffix,
    icon,
    tone = 'brand',
    delta,
    spark,
    hint,
    loading,
    className,
}: {
    label: string;
    value: number | string;
    suffix?: string;
    icon: IconName;
    tone?: ChartTone;
    delta?: { dir: 'up' | 'down' | 'flat'; text: string };
    spark?: number[];
    hint?: string;
    loading?: boolean;
    className?: string;
}): JSX.Element {
    return (
        <div
            className={cx(
                'group relative overflow-hidden rounded-xl border border-slate-200/70 bg-white p-4 shadow-card transition-all duration-300 ease-expo hover:shadow-lift hover:-translate-y-0.5',
                className,
            )}
        >
            {/* 右上角一处品牌色光斑：hover 时才亮起来 */}
            <span className="pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full bg-brand-400/0 blur-2xl transition-colors duration-500 group-hover:bg-brand-400/15" />
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="truncate text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">{label}</p>
                    {loading ? (
                        <div className="skeleton mt-2 h-7 w-20" />
                    ) : (
                        <p className="mt-1.5 flex items-baseline gap-1 text-stat text-slate-900">
                            {typeof value === 'number' ? <CountUp value={value} /> : value}
                            {suffix && <span className="text-sm font-semibold text-slate-400">{suffix}</span>}
                        </p>
                    )}
                </div>
                <span className={cx('inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset', chipTone[tone])}>
                    <Icon name={icon} className="h-[18px] w-[18px]" strokeWidth={1.6} />
                </span>
            </div>
            <div className="mt-3 flex items-end justify-between gap-3">
                <div className="min-w-0">
                    {delta && <TrendChip dir={delta.dir}>{delta.text}</TrendChip>}
                    {hint && <p className="mt-1.5 truncate text-[11px] text-slate-400">{hint}</p>}
                </div>
                {spark && spark.length > 1 && (
                    <div className="w-20 shrink-0 opacity-80 transition-opacity duration-300 group-hover:opacity-100">
                        <Sparkline data={spark} tone={tone} />
                    </div>
                )}
            </div>
        </div>
    );
}

/** 次级读数：不带走势，用于卡内的小格子 */
export function MiniStat({
    icon,
    label,
    value,
    tone = 'slate',
}: {
    icon: IconName;
    label: string;
    value: ReactNode;
    tone?: 'slate' | 'brand' | 'gold' | 'green';
}): JSX.Element {
    const tones = {
        slate: 'text-slate-400',
        brand: 'text-brand-500',
        gold: 'text-gold-500',
        green: 'text-emerald-500',
    };
    return (
        <div className="flex items-center gap-2.5 rounded-lg bg-slate-50/80 px-3 py-2.5 ring-1 ring-inset ring-slate-100">
            <Icon name={icon} className={cx('h-4 w-4 shrink-0', tones[tone])} />
            <div className="min-w-0">
                <p className="truncate text-[10px] font-medium uppercase tracking-wider text-slate-400">{label}</p>
                <p className="truncate text-[13px] font-semibold tabular-nums text-slate-800">{value}</p>
            </div>
        </div>
    );
}
