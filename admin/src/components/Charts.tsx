/**
 * 纯手写 SVG/CSS 图表：不引图表库（体积与依赖成本换不来对应的价值）。
 * 约定：数值区用 viewBox 0 0 100 100 + non-scaling-stroke 拉伸填满容器；
 * 文字一律用 HTML 排，避免 SVG 文字被 scale 拉糊。
 */
import { useId } from 'react';
import { cx } from '../lib/cx';

export type ChartTone = 'brand' | 'gold' | 'green' | 'red';

const strokeOf: Record<ChartTone, string> = {
    brand: '#37619f',
    gold: '#c1902c',
    green: '#059669',
    red: '#c8102e',
};

/** 把 0..100 折线变成圆滑曲线（Catmull-Rom 近似三次贝塞尔） */
function smooth(points: Array<{ x: number; y: number }>): string {
    if (points.length === 0) return '';
    if (points.length < 3) return points.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ');
    let d = `M${points[0]!.x},${points[0]!.y}`;
    for (let i = 0; i < points.length - 1; i += 1) {
        const p0 = points[i - 1] ?? points[i]!;
        const p1 = points[i]!;
        const p2 = points[i + 1]!;
        const p3 = points[i + 2] ?? p2;
        const c1x = p1.x + (p2.x - p0.x) / 6;
        const c1y = p1.y + (p2.y - p0.y) / 6;
        const c2x = p2.x - (p3.x - p1.x) / 6;
        const c2y = p2.y - (p3.y - p1.y) / 6;
        d += ` C${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`;
    }
    return d;
}

function toPoints(data: number[]): Array<{ x: number; y: number }> {
    const max = Math.max(...data, 1);
    const n = Math.max(data.length - 1, 1);
    return data.map((v, i) => ({ x: (i / n) * 100, y: 96 - (v / max) * 82 }));
}

/* ── 迷你走势线（KPI 卡右下角那种） ───────────────────────────────────── */

export function Sparkline({ data, tone = 'brand', className }: { data: number[]; tone?: ChartTone; className?: string }): JSX.Element {
    const id = useId().replace(/:/g, '');
    const pts = toPoints(data);
    const line = smooth(pts);
    const area = pts.length ? `${line} L100,100 L0,100 Z` : '';
    return (
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className={cx('h-8 w-full', className)} aria-hidden="true">
            <defs>
                <linearGradient id={`sp-${id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={strokeOf[tone]} stopOpacity="0.30" />
                    <stop offset="100%" stopColor={strokeOf[tone]} stopOpacity="0" />
                </linearGradient>
            </defs>
            <path d={area} fill={`url(#sp-${id})`} />
            <path
                d={line}
                fill="none"
                stroke={strokeOf[tone]}
                strokeWidth="2"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
            />
        </svg>
    );
}

/* ── 面积趋势图（含 4 条网格 + 末点强调 + 底部月份轴） ─────────────────── */

export function AreaTrend({
    data,
    labels,
    tone = 'brand',
    height = 190,
}: {
    data: number[];
    labels: string[];
    tone?: ChartTone;
    height?: number;
}): JSX.Element {
    const id = useId().replace(/:/g, '');
    const pts = toPoints(data);
    const line = smooth(pts);
    const area = pts.length ? `${line} L100,100 L0,100 Z` : '';
    const last = pts[pts.length - 1];
    const color = strokeOf[tone];

    return (
        <div>
            <div className="relative" style={{ height }}>
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
                    <defs>
                        <linearGradient id={`ar-${id}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={color} stopOpacity="0.26" />
                            <stop offset="70%" stopColor={color} stopOpacity="0.06" />
                            <stop offset="100%" stopColor={color} stopOpacity="0" />
                        </linearGradient>
                    </defs>
                    {[24, 46, 68, 90].map((y) => (
                        <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="#e2e8f0" strokeWidth="1" vectorEffect="non-scaling-stroke" strokeDasharray="3 4" />
                    ))}
                    <path d={area} fill={`url(#ar-${id})`} className="animate-fade-in" />
                    <path d={line} fill="none" stroke={color} strokeWidth="2.25" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                </svg>
                {last && (
                    /* 末点用 HTML 定位，才能保持正圆不被 non-scaling 拉伸 */
                    <span
                        className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
                        style={{ left: `${last.x}%`, top: `${last.y}%` }}
                    >
                        <span className="absolute -inset-1.5 rounded-full opacity-30 animate-ping-soft" style={{ background: color }} />
                        <span className="relative block h-2.5 w-2.5 rounded-full ring-2 ring-white" style={{ background: color }} />
                    </span>
                )}
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2">
                {labels.map((l) => (
                    <span key={l} className="text-[10px] font-medium tabular-nums text-slate-400">
                        {l}
                    </span>
                ))}
            </div>
        </div>
    );
}

/* ── 柱状（纯 HTML，hover 出血泡读数） ───────────────────────────────── */

export function BarSeries({
    data,
    tone = 'brand',
    height = 150,
}: {
    data: Array<{ label: string; value: number }>;
    tone?: ChartTone;
    height?: number;
}): JSX.Element {
    const max = Math.max(...data.map((d) => d.value), 1);
    const fills: Record<ChartTone, string> = {
        brand: 'from-brand-300 to-brand-600',
        gold: 'from-gold-300 to-gold-600',
        green: 'from-emerald-300 to-emerald-600',
        red: 'from-accent/70 to-accent',
    };
    return (
        <div className="flex items-end gap-2" style={{ height }}>
            {data.map((d, i) => (
                <div key={d.label} className="group relative flex h-full flex-1 flex-col justify-end">
                    <span className="pointer-events-none absolute inset-x-0 bottom-full mb-1 hidden justify-center group-hover:flex">
                        <span className="rounded-md bg-ink-900 px-1.5 py-1 text-[10px] font-semibold tabular-nums text-white shadow-pop">
                            {d.value}
                        </span>
                    </span>
                    <div
                        className={cx(
                            'w-full rounded-t-md bg-gradient-to-t transition-all duration-500 ease-expo group-hover:brightness-110',
                            fills[tone],
                            d.value === 0 && 'from-slate-100 to-slate-200',
                        )}
                        style={{ height: `${Math.max(2, (d.value / max) * 100)}%`, animationDelay: `${i * 45}ms` }}
                    />
                    <span className="mt-1.5 truncate text-center text-[10px] font-medium tabular-nums text-slate-400">{d.label}</span>
                </div>
            ))}
        </div>
    );
}

/* ── 环形占比（中心放总数） ──────────────────────────────────────────── */

export function Donut({
    segments,
    total,
    caption,
    size = 132,
}: {
    segments: Array<{ label: string; value: number; color: string }>;
    total?: number;
    caption?: string;
    size?: number;
}): JSX.Element {
    const sum = total ?? segments.reduce((a, s) => a + s.value, 0);
    const r = 42;
    const c = 2 * Math.PI * r;
    let acc = 0;

    return (
        <div className="flex items-center gap-5">
            <div className="relative shrink-0" style={{ width: size, height: size }}>
                <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden="true">
                    <circle cx="50" cy="50" r={r} fill="none" stroke="#eef2f7" strokeWidth="10" />
                    {sum > 0 &&
                        segments.map((s) => {
                            const len = (s.value / sum) * c;
                            const el = (
                                <circle
                                    key={s.label}
                                    cx="50"
                                    cy="50"
                                    r={r}
                                    fill="none"
                                    stroke={s.color}
                                    strokeWidth="10"
                                    strokeLinecap="round"
                                    strokeDasharray={`${Math.max(len - 1.5, 0)} ${c - Math.max(len - 1.5, 0)}`}
                                    strokeDashoffset={-acc}
                                />
                            );
                            acc += len;
                            return el;
                        })}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-stat text-slate-900">{sum}</span>
                    {caption && <span className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-400">{caption}</span>}
                </div>
            </div>
            <ul className="min-w-0 flex-1 space-y-2">
                {segments.map((s) => (
                    <li key={s.label} className="flex items-center gap-2 text-xs">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} />
                        <span className="min-w-0 flex-1 truncate text-slate-600">{s.label}</span>
                        <span className="font-semibold tabular-nums text-slate-800">{s.value}</span>
                        <span className="w-9 text-right tabular-nums text-slate-400">{sum > 0 ? Math.round((s.value / sum) * 100) : 0}%</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

/* ── 堆叠分布条（内容构成，图例在下） ───────────────────────────────── */

export function SplitBar({ segments }: { segments: Array<{ label: string; value: number; color: string }> }): JSX.Element {
    const sum = segments.reduce((a, s) => a + s.value, 0) || 1;
    return (
        <div>
            <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100 shadow-inner">
                {segments.map((s) => (
                    <div
                        key={s.label}
                        title={`${s.label} ${s.value}`}
                        className="h-full first:rounded-l-full last:rounded-r-full transition-all duration-500 ease-expo"
                        style={{ width: `${(s.value / sum) * 100}%`, background: s.color }}
                    />
                ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
                {segments.map((s) => (
                    <div key={s.label} className="flex items-center gap-2 text-[11px]">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: s.color }} />
                        <span className="truncate text-slate-500">{s.label}</span>
                        <span className="ml-auto font-semibold tabular-nums text-slate-700">{s.value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
