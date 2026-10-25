/**
 * 站点配置（site.json）编辑器：只给表单，不给 JSON 原文。
 * 与 JsonField 同契约：value 是库里的 site.json 原文（字符串），onChange 吐新的 JSON 文本，
 * 所以 ResourceEdit 的保存/校验链路一行都不用改。
 *
 * 为什么不留 JSON 输入框：只要那个框在那儿，就有人会去点、去粘，改坏了全站。
 * 表单能改值、改不了结构，语法永远合法；真要动结构（加新字段）应该在代码里做，
 * 解析失败时这里也只做「报错 + 找开发」，不再给可编辑的文本框。
 *
 * 三条硬约定：
 *  1) 只改值、不重建对象——按路径浅克隆，表单没列出的键（含 _comment）原样保留、键序不变；
 *  2) 缩进 4 空格，与仓库现有 site.json 一致，否则发布时整文件重排、diff 糊成一片；
 *  3) 中间层结构对不上（该是对象却是字符串）时拒绝写入，不覆盖已有值。
 */
import { useMemo, useState } from 'react';
import { cx } from '../lib/cx';
import { Badge, HelpDot, Input, Label, Textarea, Tooltip } from './ui';
import { Icon } from './Icon';
import { ImageField } from './ImageField';
import { SITE_SECTIONS, type SiteSection } from '../lib/resources';

/** 与 src/data/site.json 现有排版一致 */
const INDENT = 4;

type Kind = 'text' | 'textarea' | 'number' | 'image';

interface Leaf {
    /** 相对根对象的路径，如 ['address', 'city'] */
    path: string[];
    label: string;
    help?: string;
    kind?: Kind;
    placeholder?: string;
    full?: boolean;
}

interface Group {
    /** 与 SITE_SECTIONS 一一对应：路由、侧栏、表单共用同一份定义 */
    section: SiteSection;
    leaves: Leaf[];
}

/** 表单覆盖的字段。没写进来的键不会消失，只是这里改不到 */
const GROUPS: Group[] = [
    {
        section: SITE_SECTIONS[0]!,
        leaves: [
            { path: ['name'], label: '站点名称', help: '页眉与浏览器标题里的品牌名，如 Cennetic CNC Machine。' },
            { path: ['shortName'], label: '简称', help: '导航、版权行等空间小的地方用。' },
            { path: ['legalName'], label: '公司注册全称', help: '页脚、关于页与政策页署名用。' },
            {
                path: ['url'],
                label: '站点主地址',
                help: '必须带 https://、结尾不要斜杠。canonical、sitemap、OG 分享卡都拼这个值，填错会影响 SEO。',
                placeholder: 'https://www.example.com',
            },
            { path: ['language'], label: '语言代码', help: '写进 html lang 属性。本站面向海外，保持 en。', placeholder: 'en' },
            {
                path: ['description'],
                label: '站点简介',
                kind: 'textarea',
                full: true,
                help: '默认 meta description 与社交分享文案。150–160 字符最稳，长了会被搜索引擎截断。',
            },
            { path: ['hours'], label: '营业时间', help: '联系页与页脚显示。' },
            { path: ['foundingNote'], label: '一句话资历', help: '首页/关于页副文案，例如服务过多少家工厂。' },
        ],
    },
    {
        section: SITE_SECTIONS[1]!,
        leaves: [
            { path: ['email'], label: '邮箱', placeholder: 'sales@example.com' },
            { path: ['phone'], label: '电话（拨号格式）', help: '国际格式、不带空格和括号，前台用它拼 tel: 链接。', placeholder: '+8613800138000' },
            { path: ['phoneDisplay'], label: '电话（显示格式）', help: '页面上给人看的写法，可以带空格。', placeholder: '+86 138 0013 8000' },
            { path: ['whatsapp', 'number'], label: 'WhatsApp 号码', help: '不带 + 和空格，前台用它拼 wa.me 链接。', placeholder: '8613800138000' },
            { path: ['whatsapp', 'display'], label: 'WhatsApp 显示', help: '页面上给人看的写法。' },
            { path: ['address', 'street'], label: '街道/镇' },
            { path: ['address', 'city'], label: '城市' },
            { path: ['address', 'region'], label: '省/州' },
            { path: ['address', 'country'], label: '国家' },
            { path: ['address', 'countryCode'], label: '国家代码', help: '两位大写码，如 CN。结构化地址（schema.org）会用到。', placeholder: 'CN' },
        ],
    },
    {
        section: SITE_SECTIONS[2]!,
        leaves: [
            {
                path: ['inquiryEmail'],
                label: '询盘接收邮箱',
                full: true,
                placeholder: 'inquiry@example.com',
                help: '只填一个邮箱。多人接收请在这个邮箱自己的后台做转发/抄送，后台不维护名单。留空表示暂未启用。',
            },
        ],
    },
    {
        section: SITE_SECTIONS[3]!,
        leaves: [
            { path: ['logo'], label: '站点 Logo 路径', placeholder: '/images/site/logo.svg', help: '一般是个站内路径，文件在代码仓库的 public 里（SVG 不能从后台上传）。要换标请让开发把新文件放进仓库后再改这里。' },
            { path: ['ogDefaultImage'], label: '默认分享封面', kind: 'image', help: '文章/产品没配图时，社交分享卡用它。建议 1200×630。' },
            { path: ['hero', 'video'], label: '首页背景视频', help: '站内路径，如 /images/site/hero-banner.mp4。改动会直接影响首页加载，非开发建议只核对不改。' },
            { path: ['hero', 'poster'], label: '视频封面图', kind: 'image', help: '封面的 LCP 元素，务必保留，否则首页会先白一块。' },
            { path: ['hero', 'posterWidth'], label: '封面宽', kind: 'number' },
            { path: ['hero', 'posterHeight'], label: '封面高', kind: 'number' },
            { path: ['hero', 'posterAlt'], label: '封面 alt', full: true, help: '写清机器类型与场景，对图片 SEO 有用。' },
            { path: ['youtube', 'factoryVideoId'], label: '工厂视频 YouTube ID', help: '只要 ID 那一段（11 位），不要粘整条网址。留空则首页不显示视频。' },
            { path: ['youtube', 'poster'], label: '视频封面', kind: 'image' },
            { path: ['youtube', 'posterWidth'], label: '宽', kind: 'number' },
            { path: ['youtube', 'posterHeight'], label: '高', kind: 'number' },
        ],
    },
    {
        section: SITE_SECTIONS[4]!,
        leaves: [
            { path: ['analytics', 'gtagId'], label: 'Google Analytics 衡量 ID', help: '形如 G-XXXXXXX 或 GT-XXXXXXX。留空则前台不注入统计脚本。' },
            { path: ['tawk', 'propertyId'], label: 'Tawk.to Property ID', help: '在线客服。留空则不加载聊天挂件。' },
            { path: ['tawk', 'widgetId'], label: 'Tawk.to Widget ID', help: '与 Property ID 成对出现，别只填一个。' },
        ],
    },
];

/** 表单里出现过的顶层键，用来算「还有哪些没覆盖」 */
const COVERED_ROOT = new Set<string>(GROUPS.flatMap((g) => g.leaves.map((l) => l.path[0])));

/** 解析结果：拿不到对象就带上报错文案，界面只解释不给编辑口 */
function probe(v: unknown): { obj: Record<string, unknown> | null; error: string | null } {
    const text = typeof v === 'string' ? v : JSON.stringify(v ?? {});
    try {
        const parsed = JSON.parse(text) as unknown;
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return { obj: parsed as Record<string, unknown>, error: null };
        return { obj: null, error: '这段内容不是 JSON 对象（可能是数组或空值）。' };
    } catch (e) {
        return { obj: null, error: e instanceof Error ? e.message : 'JSON 解析失败。' };
    }
}

function read(obj: Record<string, unknown> | null, path: string[]): unknown {
    let cur: unknown = obj;
    for (const k of path) {
        if (!cur || typeof cur !== 'object') return undefined;
        cur = (cur as Record<string, unknown>)[k];
    }
    return cur;
}

/** 按路径浅克隆写入；中间层不是对象就放弃（返回 null），避免把已有值覆盖成对象 */
function writeAt(root: Record<string, unknown>, path: string[], v: unknown): Record<string, unknown> | null {
    const step = (node: Record<string, unknown>, i: number): Record<string, unknown> | null => {
        const key = path[i];
        if (i === path.length - 1) return { ...node, [key]: v };
        const child = node[key];
        if (child === undefined || child === null) return { ...node, [key]: step({}, i + 1)! };
        if (typeof child !== 'object' || Array.isArray(child)) return null;
        const next = step(child as Record<string, unknown>, i + 1);
        return next ? { ...node, [key]: next } : null;
    };
    return step(root, 0);
}

export function SiteConfigField({
    value,
    onChange,
    section,
}: {
    value: unknown;
    onChange: (v: string) => void;
    /** 只渲染这一个分组（路由 /site_settings/:section）；不传则渲染全部 */
    section?: string;
}): JSX.Element {
    const { obj, error } = useMemo(() => probe(value), [value]);
    const [rejected, setRejected] = useState<string | null>(null);

    /** 表单没列出的顶层键：原样保留，并在底部点名 */
    const untouched = useMemo<string[]>(() => (obj ? Object.keys(obj).filter((k) => !COVERED_ROOT.has(k) && !k.startsWith('_')) : []), [obj]);

    function edit(path: string[], v: unknown): void {
        if (!obj) return;
        const next = writeAt(obj, path, v);
        if (!next) {
            setRejected(`「${path.join('.')}」在配置里不是对象，表单不敢覆盖它——这一项请联系开发改。`);
            return;
        }
        setRejected(null);
        onChange(JSON.stringify(next, null, INDENT));
    }

    if (!obj) {
        return (
            <div className="rounded-lg border border-accent/25 bg-accent-soft/50 p-4">
                <p className="flex items-center gap-1.5 text-[13px] font-semibold text-accent">
                    <Icon name="alert" className="h-4 w-4 shrink-0" />
                    站点配置读取失败，这里不能编辑
                </p>
                <p className="mt-1.5 text-[11px] leading-relaxed text-slate-600">
                    后台只提供表单、不提供手改 JSON 的入口，所以这种情况得由开发在数据库里修好。内容库与线上暂不受影响，发布会被回归闸拦下。
                </p>
                <pre className="mt-2 max-h-28 overflow-auto rounded-md bg-ink-900 px-3 py-2 font-mono text-[10px] leading-relaxed text-slate-200">{error}</pre>
            </div>
        );
    }

    /* 一个路由只看一组；section 不认识时退化为全量，不白屏 */
    const current = SITE_SECTIONS.find((s) => s.key === section);
    const groups: Group[] = current ? GROUPS.filter((g) => g.section.key === current.key) : GROUPS;

    /** 用普通函数而不是内联组件：内联组件每次渲染都是新类型，输入框会掉焦点 */
    const renderLeaf = (leaf: Leaf): JSX.Element => {
        const raw = read(obj, leaf.path);
        const kind = leaf.kind ?? 'text';
        const control =
            kind === 'textarea' ? (
                <Textarea rows={3} value={String(raw ?? '')} onChange={(e) => edit(leaf.path, e.target.value)} />
            ) : kind === 'number' ? (
                <Input
                    type="number"
                    value={raw == null ? '' : String(raw)}
                    onChange={(e) => edit(leaf.path, e.target.value === '' ? null : Number(e.target.value))}
                />
            ) : kind === 'image' ? (
                <ImageField multiple={false} value={typeof raw === 'string' ? raw : ''} onChange={(v) => edit(leaf.path, typeof v === 'string' ? v : '')} />
            ) : (
                <Input value={String(raw ?? '')} placeholder={leaf.placeholder} onChange={(e) => edit(leaf.path, e.target.value)} />
            );
        return (
            <div key={leaf.path.join('.')} className={cx('min-w-0', (leaf.full || kind === 'image') && 'sm:col-span-2')}>
                <Label>
                    {leaf.label}
                    {leaf.help && <HelpDot text={leaf.help} />}
                </Label>
                {control}
                <p className="mt-1 truncate font-mono text-[10px] text-slate-300" title={`写入 site.json 的 ${leaf.path.join('.')} 字段`}>
                    {leaf.path.join('.')}
                </p>
            </div>
        );
    };

    return (
        <div className="overflow-hidden rounded-lg border border-slate-200/90 bg-white shadow-inner">
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-[linear-gradient(180deg,#fcfdff,#f5f7fb)] px-3 py-2">
                <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    <Icon name={current?.icon ?? 'list'} className="h-3.5 w-3.5" />
                    {current ? current.label : '站点配置'}
                </span>
                <Tooltip text={`site.json 共 ${Object.keys(obj).length} 个顶层字段，表单可改 ${Object.keys(obj).length - untouched.length} 个。没列出的字段会原样保留，不会被表单删掉。`}>
                    <Badge tone="slate" icon="layers">
                        可改 {Object.keys(obj).length - untouched.length} / {Object.keys(obj).length}
                    </Badge>
                </Tooltip>
                <Tooltip text="这里故意不给 JSON 输入框：表单只能改字段的值，改不动结构，语法也永远合法。要新增字段应该在代码里加，再回到这里填值。">
                    <Badge tone="blue" icon="lock">
                        不提供 JSON 编辑
                    </Badge>
                </Tooltip>
                <span className="ml-auto text-[10px] text-slate-400">缩进 4 空格 · 键序不变</span>
            </div>

            {rejected && (
                <p className="flex items-start gap-1.5 border-b border-slate-100 bg-accent-soft/60 px-4 py-2 text-[11px] leading-relaxed text-accent">
                    <Icon name="alert" className="mt-px h-3.5 w-3.5 shrink-0" />
                    {rejected}
                </p>
            )}

            {groups.map((g) => (
                <section key={g.section.key} className="border-b border-slate-100 last:border-b-0">
                    <header className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 bg-slate-50/60 px-4 py-2.5">
                        <h4 className="text-[12px] font-semibold text-slate-800">{g.section.label}</h4>
                        <span className="text-[11px] text-slate-500">{g.section.desc}</span>
                        <span className="ml-auto text-[10px] tabular-nums text-slate-400">{g.leaves.length} 项</span>
                    </header>
                    <div className="grid grid-cols-1 gap-x-4 gap-y-3 p-4 sm:grid-cols-2">{g.leaves.map(renderLeaf)}</div>
                </section>
            ))}

            <p className="flex flex-wrap items-center gap-1.5 bg-[linear-gradient(180deg,#fcfdff,#f5f7fb)] px-4 py-2.5 text-[11px] leading-relaxed text-slate-500">
                表单只改值、不动结构：
                {untouched.length > 0 ? (
                    <>
                        这 {untouched.length} 个字段不在表单里（
                        <span className="font-mono text-[10px] text-slate-400">{untouched.join('、')}</span>
                        ），会原样保留，需要改请联系开发。
                    </>
                ) : (
                    <>当前所有顶层字段都已覆盖（下划线开头的备注字段按原样保留）。</>
                )}
            </p>
        </div>
    );
}
