/**
 * 后台外壳：深色导航栏（rail）+ 浅色工作区。
 * 面包屑由路由反推（不写死），资源新增/改名会自动跟着 resources.ts 走。
 * 顶栏三件套：命令面板（⌘K）、活动通知、发布状态；侧栏读数是 dashboard 同一份缓存。
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { NAV_GROUPS, RAIL_LINKS, RESOURCES, SITE_SECTIONS } from '../lib/resources';
import { useAuth } from '../lib/auth';
import { fetchCounts, fetchFeed, invalidateReadouts, type FeedItem, type ResourceCount } from '../lib/readouts';
import { ago } from '../lib/format';
import { cx } from '../lib/cx';
import { Icon } from './Icon';
import { PublishButton } from './PublishButton';
import { Avatar, Badge, Kbd } from './ui';
import { Dropdown, MenuLabel, MenuItem } from './Overlay';
import { CommandPalette, type CommandAction } from './CommandPalette';

const linkBase =
    'group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-200 ease-expo';

function railLink({ isActive }: { isActive: boolean }): string {
    return isActive
        ? `${linkBase} bg-white/[0.09] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.06)]`
        : `${linkBase} text-slate-400 hover:bg-white/[0.05] hover:text-slate-100`;
}

/** 运行环境：由域名判定，不做成配置项，避免线上线下打架 */
function useEnv(): { label: string; tone: 'green' | 'amber' | 'blue' } {
    const host = typeof window === 'undefined' ? '' : window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') return { label: '本地开发', tone: 'amber' };
    if (host.endsWith('cennetic.com')) return { label: '生产环境', tone: 'green' };
    return { label: '预览环境', tone: 'blue' };
}

/** 由路径反推面包屑：/articles/<slug> → 内容 / 文章 / 编辑 */
function useBreadcrumb(): ReactNode[] {
    const { pathname } = useLocation();
    const [, seg, third] = pathname.split('/');
    if (!seg) return ['仪表盘'];
    if (seg === 'site_settings') {
        const s = SITE_SECTIONS.find((x) => x.key === third);
        return s ? ['系统', '站点设置', s.label] : ['站点设置'];
    }
    const site = RESOURCES.find((r) => r.key === seg);
    if (!site) return [seg === 'media' ? '媒体库' : seg];
    return site && third ? [site.group, site.label, third === 'new' ? '新建' : '编辑'] : [site.label];
}

function Brand() {
    return (
        <div className="flex items-center gap-3 px-5 pb-5 pt-6">
            <span className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[linear-gradient(150deg,#5b83c2,#012760)] text-[13px] font-bold tracking-tightest text-white shadow-glow ring-1 ring-inset ring-white/20">
                CN
                <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-gold-500 ring-2 ring-ink-950" />
            </span>
            <span className="leading-none">
                <span className="block text-[15px] font-bold tracking-tightest text-white">CENNETIC</span>
                <span className="mt-1.5 flex items-center gap-1.5 text-[9.5px] font-semibold uppercase tracking-[0.18em] text-brand-300">
                    Content Center
                    <span className="rounded border border-gold-500/40 bg-gold-500/10 px-1 py-px text-[8px] leading-none text-gold-300">ENT</span>
                </span>
            </span>
        </div>
    );
}

/** 侧栏：全一级平铺（不再分「内容 / 分类与作者 / 系统」），顺序由 RAIL_LINKS 定义 */
function Rail({
    counts,
    onNavigate,
}: {
    counts: Record<string, ResourceCount>;
    onNavigate?: () => void;
}): JSX.Element {
    return (
        <div className="flex h-full min-h-0 flex-col" onClick={onNavigate}>
            <nav className="scroll-rail min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3 pb-4 pt-1">
                {RAIL_LINKS.map((it) => (
                    <div key={it.to}>
                        <NavLink key={it.to} to={it.to} className={railLink} end={it.to === '/'}>
                            {({ isActive }) => (
                                <>
                                    <span
                                        className={cx(
                                            'absolute left-0 top-1/2 h-0 w-[3px] -translate-y-1/2 rounded-r-full transition-all duration-300 ease-expo',
                                            it.accent ? 'bg-gradient-to-b from-gold-300 to-gold-500' : 'bg-gradient-to-b from-brand-300 to-brand-500',
                                            isActive && (it.accent ? 'h-5 shadow-gold' : 'h-5 shadow-glow'),
                                        )}
                                    />
                                    <Icon name={it.icon} className="h-4 w-4 shrink-0 opacity-90" />
                                    <span className="min-w-0 flex-1 truncate">{it.label}</span>
                                    {it.key && counts[it.key] && counts[it.key].draft > 0 && (
                                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" title={`${counts[it.key].draft} 篇草稿`} />
                                    )}
                                    {it.key && counts[it.key] && (
                                        <span
                                            className={cx(
                                                'shrink-0 rounded px-1.5 text-[10px] font-semibold tabular-nums transition-colors',
                                                isActive ? 'bg-white/10 text-white' : 'bg-white/[0.04] text-slate-500 group-hover:text-slate-300',
                                            )}
                                        >
                                            {counts[it.key].total}
                                        </span>
                                    )}
                                    {it.accent && (
                                        <span className="shrink-0 rounded border border-white/10 px-1 py-px text-[9px] font-semibold uppercase tracking-wider text-slate-500">全站</span>
                                    )}
                                </>
                            )}
                        </NavLink>
                        {/* 二级目录：站点设置按分组拆出的子页，缩进 + 左侧引导线 */}
                        {it.children && (
                            <div className="mb-1 ml-[1.45rem] mt-0.5 space-y-0.5 border-l border-white/[0.08] pl-2.5">
                                {it.children.map((ch) => (
                                    <NavLink
                                        key={ch.to}
                                        to={ch.to}
                                        end
                                        /* 颜色必须在这里给全：linkBase 不带色，深色侧栏里继承亮页字色会整行看不见 */
                                        className={({ isActive }) =>
                                            cx(
                                                linkBase,
                                                'px-2 py-1.5 text-[12px]',
                                                isActive
                                                    ? 'bg-white/[0.07] text-gold-300 shadow-[inset_0_1px_0_rgba(255,255,255,.05)]'
                                                    : 'text-slate-400 hover:bg-white/[0.05] hover:text-slate-100',
                                            )
                                        }
                                    >
                                        {({ isActive }) => (
                                            <>
                                                <Icon name={ch.icon} className={cx('h-3.5 w-3.5 shrink-0', isActive ? 'text-gold-300' : 'opacity-70')} />
                                                <span className="min-w-0 flex-1 truncate">{ch.label}</span>
                                            </>
                                        )}
                                    </NavLink>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </nav>

            {/* 发布流程说明：把最容易误解的机制写死在侧栏，而不是藏在文档里 */}
            <div className="mx-3 mb-3 rounded-lg border border-white/[0.07] bg-white/[0.03] p-3">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-200">
                    <Icon name="rocket" className="h-3.5 w-3.5 text-gold-300" />
                    改动不会自动上线
                </p>
                <p className="mt-1 text-[10.5px] leading-relaxed text-slate-500">
                    保存只进内容库，点顶栏「发布上线」才会同步到前台。
                </p>
            </div>
        </div>
    );
}

function NotificationBell({ feed }: { feed: FeedItem[] }): JSX.Element {
    return (
        <Dropdown
            label="最近改动"
            width="w-[22rem]"
            trigger={(open, toggle) => (
                <button
                    type="button"
                    onClick={toggle}
                    aria-label="最近改动"
                    className={cx(
                        'focus-ring relative inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors duration-200',
                        open ? 'bg-slate-100 text-brand-700' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700',
                    )}
                >
                    <Icon name="bell" className="h-[18px] w-[18px]" />
                    {feed.length > 0 && (
                        <span className="absolute right-1.5 top-1.5 flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full rounded-full bg-accent/60 animate-ping-soft" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-accent ring-2 ring-white" />
                        </span>
                    )}
                </button>
            )}
        >
            {(close) => (
                <>
                    <MenuLabel>最近改动</MenuLabel>
                    <div className="max-h-80 overflow-y-auto">
                        {feed.length === 0 && <p className="px-2.5 py-6 text-center text-xs text-slate-400">暂无记录</p>}
                        {feed.map((f) => (
                            <Link
                                key={f.key}
                                to={`/${f.resource.key}/${encodeURIComponent(f.id)}`}
                                onClick={close}
                                className="flex items-start gap-2.5 rounded-lg px-2.5 py-2 transition-colors hover:bg-slate-50"
                            >
                                <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-100">
                                    <Icon name={f.resource.icon} className="h-[15px] w-[15px]" />
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-[13px] font-medium text-slate-700">{f.title}</span>
                                    <span className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-400">
                                        <span>{f.resource.label}</span>
                                        <span className="h-1 w-1 rounded-full bg-slate-200" />
                                        <span>{ago(f.updatedAt)}</span>
                                    </span>
                                </span>
                            </Link>
                        ))}
                    </div>
                    <div className="mt-1 border-t border-slate-100 pt-1">
                        <MenuItem icon="dashboard" onClick={close}>
                            <Link to="/" className="block">
                                返回仪表盘看全貌
                            </Link>
                        </MenuItem>
                    </div>
                </>
            )}
        </Dropdown>
    );
}

export default function Layout() {
    const { session, signOut } = useAuth();
    const nav = useNavigate();
    const loc = useLocation();
    const crumbs = useBreadcrumb();
    const env = useEnv();
    const [drawer, setDrawer] = useState(false);
    const [palette, setPalette] = useState(false);
    const [counts, setCounts] = useState<Record<string, ResourceCount>>({});
    const [feed, setFeed] = useState<FeedItem[]>([]);

    useEffect(() => {
        void fetchCounts().then(setCounts);
        void fetchFeed(8).then(setFeed);
    }, [loc.pathname]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent): void => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                setPalette((p) => !p);
            }
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, []);

    const email = session?.user.email ?? '';
    const drafts = Object.values(counts).reduce((a, c) => a + c.draft, 0);
    const total = Object.values(counts).reduce((a, c) => a + c.total, 0);

    const actions = useMemo<CommandAction[]>(() => {
        const go = (to: string): (() => void) => () => nav(to);
        const navCmds: CommandAction[] = [
            { id: 'home', group: '前往', label: '仪表盘', icon: 'dashboard', hint: '内容概览与发布状态', run: go('/') },
            { id: 'media', group: '前往', label: '媒体库', icon: 'image', hint: '图片资产与容量', run: go('/media') },
            { id: 'site', group: '前往', label: '站点设置', icon: 'settings', hint: 'site.json 全站配置', run: go('/site_settings') },
            ...SITE_SECTIONS.map((s) => ({
                id: `site-${s.key}`,
                group: '前往',
                label: `站点设置 · ${s.label}`,
                icon: s.icon,
                hint: s.desc,
                run: go(`/site_settings/${s.key}`),
            })),
            ...NAV_GROUPS.flatMap(({ group, items }) =>
                items.map((r) => ({
                    id: r.key,
                    group: '前往',
                    label: `${r.label}列表`,
                    icon: r.icon,
                    hint: group,
                    run: go(`/${r.key}`),
                })),
            ),
        ];
        const createCmds: CommandAction[] = RESOURCES.filter((r) => !r.singleton && r.key !== 'authors').map((r) => ({
            id: `new-${r.key}`,
            group: '新建',
            label: `新建${r.singular}`,
            icon: 'plus',
            hint: r.desc ?? r.group,
            run: go(`/${r.key}/new`),
        }));
        return [
            ...navCmds,
            ...createCmds,
            {
                id: 'publish',
                group: '操作',
                label: '发布上线',
                icon: 'rocket',
                hint: '快照 → 回归闸 → 线上重建',
                run: () => nav('/'),
            },
            {
                id: 'front',
                group: '操作',
                label: '打开前台首页',
                icon: 'external',
                hint: '新窗口查看线上站',
                run: () => window.open('/', '_blank', 'noopener'),
            },
            {
                id: 'reload',
                group: '操作',
                label: '刷新读数',
                icon: 'refresh',
                hint: '重取计数与最近改动',
                run: () => {
                    invalidateReadouts();
                    void fetchCounts().then(setCounts);
                    void fetchFeed(8).then(setFeed);
                },
            },
            {
                id: 'signout',
                group: '操作',
                label: '退出登录',
                icon: 'logout',
                hint: '结束当前会话',
                run: () => {
                    void (async () => {
                        await signOut();
                        nav('/login');
                    })();
                },
            },
        ];
    }, [nav, signOut, total]);

    return (
        <div className="flex min-h-screen">
            {/* 桌面：常驻深色导航栏 */}
            <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col overflow-hidden bg-rail shadow-rail lg:flex">
                <div className="pointer-events-none absolute inset-0 bg-[length:28px_28px] bg-mesh opacity-40" />
                <div className="relative flex min-h-0 flex-1 flex-col">
                    <Brand />
                    <Rail counts={counts} />
                </div>
            </aside>

            {/* 移动端：抽屉式，避免小屏下导航挤掉正文 */}
            {drawer && (
                <div className="fixed inset-0 z-50 lg:hidden">
                    <div className="absolute inset-0 bg-ink-950/50 backdrop-blur-sm animate-fade-in" onClick={() => setDrawer(false)} />
                    <aside className="absolute inset-y-0 left-0 flex w-64 flex-col overflow-hidden bg-rail shadow-pop animate-slide-in">
                        <Brand />
                        <Rail counts={counts} onNavigate={() => setDrawer(false)} />
                    </aside>
                </div>
            )}

            <div className="relative z-[1] flex min-w-0 flex-1 flex-col">
                <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200/80 bg-white/75 px-4 backdrop-blur-xl transition-shadow duration-300 sm:px-6">
                    <button
                        type="button"
                        onClick={() => setDrawer(true)}
                        className="focus-ring inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 lg:hidden"
                        aria-label="打开菜单"
                    >
                        <Icon name="list" />
                    </button>

                    <ol className="flex min-w-0 items-center gap-2 text-[13px]">
                        {crumbs.map((c, i) => (
                            <li key={String(c)} className="flex min-w-0 items-center gap-2">
                                {i > 0 && <Icon name="chevronRight" className="h-3.5 w-3.5 shrink-0 text-slate-300" />}
                                <span
                                    className={cx(
                                        'truncate',
                                        i === crumbs.length - 1 ? 'font-semibold tracking-tightest text-slate-800' : 'text-slate-400',
                                    )}
                                >
                                    {c}
                                </span>
                            </li>
                        ))}
                    </ol>

                    <span className="ml-1 hidden xl:block">
                        <Badge tone={env.tone} dot>
                            {env.label}
                        </Badge>
                    </span>

                    <div className="ml-auto flex items-center gap-1.5 sm:gap-2.5">
                        <button
                            type="button"
                            onClick={() => setPalette(true)}
                            className="focus-ring hidden h-9 items-center gap-2 rounded-lg border border-slate-200/80 bg-slate-50/80 px-2.5 text-[13px] text-slate-400 shadow-inner transition-colors hover:border-brand-200 hover:text-slate-600 md:flex"
                        >
                            <Icon name="search" className="h-4 w-4" />
                            <span className="w-24 text-left">搜索或执行…</span>
                            <span className="flex items-center gap-0.5">
                                <Kbd>⌘</Kbd>
                                <Kbd>K</Kbd>
                            </span>
                        </button>
                        <SearchTrigger onClick={() => setPalette(true)} />
                        <NotificationBell feed={feed} />
                        <Link
                            to="/"
                            target="_blank"
                            rel="noreferrer"
                            className="focus-ring hidden items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-brand-700 sm:inline-flex"
                        >
                            <Icon name="external" className="h-4 w-4" />
                            查看前台
                        </Link>
                        <span className="mx-0.5 hidden h-6 w-px bg-slate-200 sm:block" />
                        <PublishButton drafts={drafts} />
                        <span className="mx-0.5 hidden h-6 w-px bg-slate-200 sm:block" />

                        <Dropdown
                            label="账户"
                            width="w-60"
                            trigger={(open, toggle) => (
                                <button
                                    type="button"
                                    onClick={toggle}
                                    className={cx(
                                        'focus-ring flex items-center gap-2 rounded-lg py-1 pl-1 pr-1.5 transition-colors duration-200 hover:bg-slate-100',
                                        open && 'bg-slate-100',
                                    )}
                                >
                                    <Avatar email={email} />
                                    <span className="hidden min-w-0 text-left lg:block">
                                        <span className="block max-w-[11rem] truncate text-xs font-semibold text-slate-700">{email || '未登录'}</span>
                                        <span className="block text-[10px] uppercase tracking-wider text-slate-400">内容管理员</span>
                                    </span>
                                    <Icon name="chevronDown" className="hidden h-3.5 w-3.5 text-slate-400 lg:block" />
                                </button>
                            )}
                        >
                            {(close) => (
                                <>
                                    <div className="flex items-center gap-3 rounded-lg bg-[linear-gradient(160deg,#f7f9fc,#eef2f8)] px-3 py-3">
                                        <Avatar email={email} size="lg" />
                                        <div className="min-w-0">
                                            <p className="truncate text-[13px] font-bold text-slate-800">{email || '未登录'}</p>
                                            <p className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500">
                                                <Icon name="shield" className="h-3 w-3" />
                                                身份已验证 · {total} 条内容
                                            </p>
                                        </div>
                                    </div>
                                    {/* 页面入口统一走左侧栏；账号菜单只留账号相关动作 */}
                                    <div className="mt-1.5">
                                        <MenuItem icon="command" onClick={close} hint="⌘K">
                                            命令面板
                                        </MenuItem>
                                    </div>
                                    <div className="my-1.5 h-px bg-slate-100" />
                                    <MenuItem
                                        icon="logout"
                                        tone="danger"
                                        onClick={() => {
                                            void (async () => {
                                                await signOut();
                                                nav('/login');
                                            })();
                                        }}
                                    >
                                        退出登录
                                    </MenuItem>
                                </>
                            )}
                        </Dropdown>
                    </div>
                </header>

                <main className="mx-auto w-full max-w-[1360px] flex-1 px-4 py-7 sm:px-6 lg:px-8">
                    <div key={loc.pathname} className="animate-fade-up">
                        <Outlet />
                    </div>
                </main>

                <footer className="border-t border-slate-200/70 px-4 py-4 sm:px-6 lg:px-8">
                    <div className="mx-auto flex max-w-[1360px] flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-slate-400">
                        <span className="flex items-center gap-1.5 font-medium text-slate-500">
                            <Icon name="factory" className="h-3.5 w-3.5 text-brand-400" />
                            Cennetic Content Center
                        </span>
                        <span className="ml-auto flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            发布前校验闸已启用
                        </span>
                    </div>
                </footer>
            </div>

            <CommandPalette open={palette} onClose={() => setPalette(false)} actions={actions} />
        </div>
    );
}

/** 小屏下的命令面板入口（只留图标） */
function SearchTrigger({ onClick }: { onClick: () => void }): JSX.Element {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label="命令面板"
            className="focus-ring inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 md:hidden"
        >
            <Icon name="search" className="h-[18px] w-[18px]" />
        </button>
    );
}
