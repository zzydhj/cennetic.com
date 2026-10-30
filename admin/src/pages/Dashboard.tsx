/**
 * 仪表盘：内容的「驾驶舱」。
 * 数据全部来自 lib/readouts（与侧栏读数同一份缓存），这里只做展示与月度分桶。
 * 结构：欢迎带 + 发布状态 → 核心读数 → 趋势与占比 → 最近改动与资源 → 快捷动作。
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { NAV } from '../lib/resources';
import {
    fetchCounts,
    fetchFeed,
    fetchLatestChange,
    fetchMediaStats,
    fetchTrendRows,
    type FeedItem,
    type ResourceCount,
    type TrendRow,
} from '../lib/readouts';
import { ago, bytes, initials, monthKeys, monthLabel, monthOf, num, pct } from '../lib/format';
import { cx } from '../lib/cx';
import { Icon, type IconName } from '../components/Icon';
import { Badge, Button, Card, ProgressBar, SectionCard, SegmentedControl, Skeleton, StatusBadge } from '../components/ui';
import { AreaTrend, Donut, SplitBar } from '../components/Charts';
import { MiniStat, StatCard } from '../components/Stats';

type Series = 'changes' | 'publish';

const MONTHS = 6;

/** 分类别配色：环形图与构成条共用，保证同一类型在全站一个颜色 */
const PALETTE = ['#012760', '#234a83', '#37619f', '#5b83c2', '#8aa9d8', '#c1902c'];

function greeting(): string {
    const h = new Date().getHours();
    if (h < 6) return '凌晨好';
    if (h < 11) return '早上好';
    if (h < 14) return '中午好';
    if (h < 18) return '下午好';
    return '晚上好';
}

function bucket(rows: TrendRow[], key: 'updatedAt' | 'publishDate', keys: string[]): number[] {
    const idx = new Map(keys.map((k, i) => [k, i]));
    const out = new Array<number>(keys.length).fill(0);
    rows.forEach((r) => {
        const m = key === 'updatedAt' ? monthOf(r.updatedAt) : monthOf(r.publishDate);
        if (m && idx.has(m)) out[idx.get(m)!] += 1;
    });
    return out;
}

export default function Dashboard(): JSX.Element {
    const { session } = useAuth();
    const [counts, setCounts] = useState<Record<string, ResourceCount>>({});
    const [feed, setFeed] = useState<FeedItem[]>([]);
    const [media, setMedia] = useState({ items: 0, bytes: 0 });
    const [trend, setTrend] = useState<TrendRow[]>([]);
    const [latest, setLatest] = useState<string | null>(null);
    const [series, setSeries] = useState<Series>('changes');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let alive = true;
        Promise.all([fetchCounts(), fetchFeed(8), fetchMediaStats(), fetchTrendRows(), fetchLatestChange()]).then(
            ([c, f, m, t, l]) => {
                if (!alive) return;
                setCounts(c);
                setFeed(f);
                setMedia(m);
                setTrend(t);
                setLatest(l);
                setLoading(false);
            },
        );
        return () => {
            alive = false;
        };
    }, []);

    const keys = useMemo(() => monthKeys(MONTHS), []);
    const labels = useMemo(() => keys.map(monthLabel), [keys]);

    const changes = useMemo(() => bucket(trend, 'updatedAt', keys), [trend, keys]);
    const published = useMemo(() => bucket(trend, 'publishDate', keys), [trend, keys]);
    const chart = series === 'changes' ? changes : published;

    const totalAll = NAV.reduce((a, r) => a + (counts[r.key]?.total ?? 0), 0);
    const draftAll = NAV.reduce((a, r) => a + (counts[r.key]?.draft ?? 0), 0);
    const liveAll = totalAll - draftAll;
    const thisMonth = chart[chart.length - 1] ?? 0;
    const lastMonth = chart[chart.length - 2] ?? 0;
    const delta = thisMonth - lastMonth;

    const sparkOf = (kind: string): number[] =>
        bucket(
            trend.filter((r) => r.kind === kind),
            'updatedAt',
            keys,
        );

    const compose = NAV.map((r, i) => ({
        label: r.label,
        value: counts[r.key]?.total ?? 0,
        color: PALETTE[i % PALETTE.length] as string,
    })).filter((s) => s.value > 0);

    const byStatus = [
        { label: '已发布', value: liveAll, color: '#059669' },
        { label: '草稿', value: draftAll, color: '#c1902c' },
    ];

    const quick: Array<{ to: string; label: string; hint: string; icon: IconName; tone: 'brand' | 'gold' }> = [
        { to: '/articles/new', label: '写一篇文章', hint: 'SEO 标题 / 正文 / 分类', icon: 'article', tone: 'brand' },
        { to: '/products/new', label: '新增一台设备', hint: '图集最多 5 张，自动压缩', icon: 'product', tone: 'brand' },
        { to: '/media', label: '上传到媒体库', hint: '拖拽即可，返回可复制链接', icon: 'image', tone: 'brand' },
        { to: '/site_settings', label: '站点设置', hint: '联系方式 / 公司地址 / 社交', icon: 'settings', tone: 'gold' },
    ];

    return (
        <div>
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
                <div>
                    <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-500">
                        <Icon name="sparkle" className="h-3.5 w-3.5" />
                        内容运营总览
                    </p>
                    <h2 className="text-[26px] font-bold leading-tight tracking-tightest text-slate-900">
                        {greeting()}，{initials(session?.user.email)}
                    </h2>
                    <p className="mt-1 text-[13px] text-slate-500">
                        共 {num(totalAll)} 条内容 · 最近一次改动 {ago(latest)}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <span className="hidden items-center gap-1.5 rounded-full bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-500 ring-1 ring-inset ring-slate-200 shadow-card sm:inline-flex">
                        <Icon name="clock" className="h-3.5 w-3.5 text-slate-400" />
                        读数更新于 {new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <Link to="/articles/new">
                        <Button icon="plus">新建内容</Button>
                    </Link>
                    <Link to="/" target="_blank" rel="noreferrer">
                        <Button variant="secondary" icon="external">
                            查看前台
                        </Button>
                    </Link>
                </div>
            </div>

            {/* 欢迎带 + 发布状态 */}
            <div className="mb-6 grid grid-cols-1 gap-5 lg:grid-cols-12">
                <Card gradle className="relative overflow-hidden bg-rail p-6 text-white lg:col-span-8">
                    <div className="pointer-events-none absolute inset-0 bg-[length:28px_28px] bg-mesh opacity-30" />
                    <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-brand-500/30 blur-3xl" />
                    <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
                        <div className="max-w-md">
                            <Badge tone="gold" icon="star" className="bg-white/10 text-gold-300 ring-white/15">
                                CENNETIC 内容中台
                            </Badge>
                            <h3 className="mt-3 text-[19px] font-bold leading-snug tracking-tightest">
                                一处编辑，全站生效
                            </h3>
                            <p className="mt-2 text-[13px] leading-relaxed text-slate-300">
                                文章、页面、设备与站点配置都在同一个内容库里；改动经
                                <span className="mx-1 font-semibold text-white">快照 → 回归闸 → 重建</span>
                                三段流水线后出现在前台。
                            </p>
                            <div className="mt-5 flex flex-wrap items-center gap-2.5">
                                <Link to="/articles">
                                    <Button variant="gold" icon="pencil">
                                        继续编辑内容
                                    </Button>
                                </Link>
                                <Link to="/media">
                                    <Button variant="dark" icon="image" className="bg-white/10 shadow-none ring-white/10 hover:bg-white/15">
                                        媒体库
                                    </Button>
                                </Link>
                            </div>
                        </div>
                        <dl className="grid shrink-0 grid-cols-3 gap-5 sm:gap-7">
                            {[
                                { k: '内容总量', v: totalAll },
                                { k: '已发布', v: liveAll },
                                { k: '草稿', v: draftAll },
                            ].map((s) => (
                                <div key={s.k}>
                                    <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-300">{s.k}</dt>
                                    <dd className="mt-1 text-stat text-white">{loading ? '—' : num(s.v)}</dd>
                                </div>
                            ))}
                        </dl>
                    </div>
                </Card>

                <Card className="lg:col-span-4" gradle>
                    <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4">
                        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[linear-gradient(160deg,#e3c98a,#a1741c)] text-white shadow-gold ring-1 ring-inset ring-white/25">
                            <Icon name="rocket" className="h-[18px] w-[18px]" />
                        </span>
                        <div className="min-w-0">
                            <h3 className="text-[13px] font-semibold tracking-tightest text-slate-800">发布流水线</h3>
                            <p className="mt-0.5 text-[11px] text-slate-500">顶栏「发布上线」触发</p>
                        </div>
                        <span className="ml-auto">
                            {loading ? (
                                <Badge tone="slate">读取中</Badge>
                            ) : draftAll > 0 ? (
                                <Badge tone="amber" dot>
                                    {draftAll} 篇草稿
                                </Badge>
                            ) : (
                                <Badge tone="green" dot>
                                    全部已发布
                                </Badge>
                            )}
                        </span>
                    </div>
                    <ol className="px-5 py-4">
                        {[
                            { icon: 'database', label: '内容快照归档', hint: '后台内容 → 站点数据' },
                            { icon: 'shield', label: '回归闸校验', hint: '全站构建自洽校验' },
                            { icon: 'globe', label: '站点重建上线', hint: '约 2–4 分钟' },
                        ].map((s, i) => (
                            <li key={s.label} className="relative flex gap-3 pb-4 last:pb-0">
                                {i < 2 && <span className="absolute left-[15px] top-8 h-[calc(100%-8px)] w-px bg-slate-200" />}
                                <span className="relative z-[1] inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-50 text-slate-400 ring-1 ring-inset ring-slate-200">
                                    <Icon name={s.icon as IconName} className="h-4 w-4" />
                                </span>
                                <div className="min-w-0 pt-0.5">
                                    <p className="text-[13px] font-medium text-slate-700">{s.label}</p>
                                    <p className="mt-0.5 truncate text-[11px] text-slate-400">{s.hint}</p>
                                </div>
                            </li>
                        ))}
                    </ol>
                    <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-3 text-[11px] leading-relaxed text-slate-500">
                        最近改动：<span className="font-medium text-slate-700">{ago(latest)}</span>
                        ；线上前台只展示 status=published 的内容。
                    </div>
                </Card>
            </div>

            {/* 核心读数 */}
            <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                    label="内容总量"
                    value={totalAll}
                    icon="layers"
                    tone="brand"
                    loading={loading}
                    spark={changes}
                    delta={{ dir: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat', text: `${delta >= 0 ? '+' : ''}${delta} 本月改动` }}
                    hint={`${NAV.length} 类内容 · ${num(media.items)} 张图片`}
                />
                <StatCard
                    label="文章"
                    value={counts.articles?.total ?? 0}
                    icon="article"
                    tone="green"
                    loading={loading}
                    spark={sparkOf('文章')}
                    hint={`草稿 ${counts.articles?.draft ?? 0} 篇 · 分类 ${counts.blog_categories?.total ?? 0} 个`}
                />
                <StatCard
                    label="设备（产品）"
                    value={counts.products?.total ?? 0}
                    icon="product"
                    tone="gold"
                    loading={loading}
                    spark={sparkOf('产品')}
                    hint={`草稿 ${counts.products?.draft ?? 0} 台 · 分类 ${counts.product_categories?.total ?? 0} 个`}
                />
                <StatCard
                    label="待发布草稿"
                    value={draftAll}
                    icon="pencil"
                    tone={draftAll > 0 ? 'red' : 'brand'}
                    loading={loading}
                    delta={{ dir: draftAll > 0 ? 'flat' : 'up', text: draftAll > 0 ? '需要点发布' : '内容与线上一致' }}
                    hint={`发布率 ${pct(liveAll, totalAll)}%`}
                />
            </div>

            {/* 趋势 + 占比 */}
            <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-12">
                <SectionCard
                    className="xl:col-span-8"
                    icon="trendUp"
                    title="内容产出趋势"
                    desc={`最近 ${MONTHS} 个月，按月份统计`}
                    actions={
                        <SegmentedControl<Series>
                            value={series}
                            size="sm"
                            onChange={setSeries}
                            options={[
                                { value: 'changes', label: '后台改动' },
                                { value: 'publish', label: '发布产出' },
                            ]}
                        />
                    }
                    bodyClassName="pt-4"
                >
                    {loading ? (
                        <div className="space-y-3">
                            <div className="skeleton h-[150px] w-full rounded-lg" />
                            <Skeleton rows={2} />
                        </div>
                    ) : (
                        <>
                            <div className="mb-3 flex flex-wrap items-center gap-4">
                                <span className="flex items-baseline gap-1.5">
                                    <span className="text-stat text-slate-900">{num(chart.reduce((a, b) => a + b, 0))}</span>
                                    <span className="text-[11px] text-slate-400">{MONTHS} 个月合计</span>
                                </span>
                                <span className="flex items-baseline gap-1.5">
                                    <span className="text-[15px] font-bold tabular-nums text-brand-700">{num(thisMonth)}</span>
                                    <span className="text-[11px] text-slate-400">本月</span>
                                </span>
                                <span className="ml-auto text-[11px] text-slate-400">
                                    {series === 'changes' ? '按 updated_at（保存即计入）' : '按 date 字段（前台发布日期）'}
                                </span>
                            </div>
                            <AreaTrend data={chart} labels={labels} tone="brand" height={180} />
                        </>
                    )}
                </SectionCard>

                <SectionCard className="xl:col-span-4" icon="gauge" title="发布状态占比" desc="带状态列的内容合计">
                    {loading ? (
                        <Skeleton rows={5} />
                    ) : (
                        <>
                            <Donut segments={byStatus} caption="条内容" />
                            <div className="mt-4">
                                <div className="mb-1.5 flex items-center justify-between text-[11px]">
                                    <span className="font-medium text-slate-500">发布完成度</span>
                                    <span className="font-semibold tabular-nums text-slate-700">{pct(liveAll, totalAll)}%</span>
                                </div>
                                <ProgressBar value={pct(liveAll, totalAll)} tone="green" />
                            </div>
                        </>
                    )}
                </SectionCard>
            </div>

            {/* 最近改动 + 构成/资源 */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
                <SectionCard
                    className="lg:col-span-7"
                    icon="history"
                    title="最近改动"
                    desc="各内容类型最新的一条"
                    actions={
                        <Link to="/articles" className="text-[11px] font-semibold text-brand-600 hover:text-brand-700">
                            去文章列表
                        </Link>
                    }
                    bodyClassName="p-0"
                >
                    {loading ? (
                        <div className="p-5">
                            <Skeleton rows={6} />
                        </div>
                    ) : feed.length === 0 ? (
                        <p className="px-5 py-10 text-center text-sm text-slate-400">还没有内容改动</p>
                    ) : (
                        <ul className="divide-y divide-slate-100">
                            {feed.map((f) => (
                                <li key={f.key}>
                                    <Link
                                        to={`/${f.resource.key}/${encodeURIComponent(f.id)}`}
                                        className="row-hot flex items-center gap-3 px-5 py-3"
                                    >
                                        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[linear-gradient(160deg,#eff4fb,#dbe6f5)] text-brand-600 ring-1 ring-inset ring-brand-100">
                                            <Icon name={f.resource.icon} className="h-4 w-4" />
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-[13px] font-medium text-slate-800">{f.title}</span>
                                            <span className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-400">
                                                <span>{f.resource.label}</span>
                                                <span className="h-1 w-1 rounded-full bg-slate-200" />
                                                <span className="truncate font-mono">{f.id}</span>
                                            </span>
                                        </span>
                                        {f.status && <StatusBadge status={f.status} />}
                                        <span className="hidden w-20 shrink-0 text-right text-[11px] tabular-nums text-slate-400 sm:block">
                                            {ago(f.updatedAt)}
                                        </span>
                                        <Icon name="chevronRight" className="h-4 w-4 shrink-0 text-slate-300" />
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </SectionCard>

                <div className="space-y-5 lg:col-span-5">
                    <SectionCard icon="grid" title="内容构成" desc="按类型条目数占比">
                        {loading ? <Skeleton rows={4} /> : <SplitBar segments={compose} />}
                    </SectionCard>

                    <SectionCard icon="database" title="媒体与存储" desc="图片资产">
                        <div className="grid grid-cols-1 gap-2.5">
                            <MiniStat icon="image" label="图片张数" value={`${num(media.items)} 张`} tone="brand" />
                            <MiniStat icon="download" label="总体积" value={bytes(media.bytes)} tone="gold" />
                            <MiniStat
                                icon="gauge"
                                label="平均单张"
                                value={media.items > 0 ? bytes(Math.round(media.bytes / media.items)) : '—'}
                                tone="green"
                            />
                        </div>
                        <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
                            超过 400KB 或长边超过 1600px 的图片上传时自动转 WebP，前台再按尺寸生成衍生图。
                        </p>
                    </SectionCard>
                </div>
            </div>

            {/* 快捷动作 */}
            <div className="mt-5">
                <p className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    <Icon name="bolt" className="h-3.5 w-3.5" />
                    快捷动作
                </p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {quick.map((a) => (
                        <Link key={a.to} to={a.to}>
                            <Card hover className="flex h-full items-center gap-3.5 p-4">
                                <span
                                    className={cx(
                                        'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset',
                                        a.tone === 'gold'
                                            ? 'bg-[linear-gradient(160deg,#fdf6e6,#f7ebd0)] text-gold-600 ring-gold-300/50'
                                            : 'bg-[linear-gradient(160deg,#eff4fb,#dbe6f5)] text-brand-600 ring-brand-100',
                                    )}
                                >
                                    <Icon name={a.icon} className="h-[18px] w-[18px]" />
                                </span>
                                <span className="min-w-0">
                                    <span className="block truncate text-[13px] font-semibold text-slate-800">{a.label}</span>
                                    <span className="mt-0.5 block truncate text-[11px] text-slate-400">{a.hint}</span>
                                </span>
                                <Icon name="arrowUpRight" className="ml-auto h-4 w-4 shrink-0 text-slate-300" />
                            </Card>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}
