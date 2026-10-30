/**
 * 通用编辑页：配置驱动的分区表单 + 右侧常驻「发布 / SEO 预览 / 校验 / 危险区」。
 * 保存只写内容库，上线仍统一走顶栏的发布流水线。
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { sanitizeHtml } from '../lib/sanitize';
import { invalidateReadouts } from '../lib/readouts';
import { ago, dateTime, stripHtml } from '../lib/format';
import { cx } from '../lib/cx';
import type { Field, Resource } from '../lib/resources';
import { SITE_SECTIONS } from '../lib/resources';
import { Icon, type IconName } from '../components/Icon';
import {
    Badge,
    Button,
    Card,
    PageHeader,
    SectionCard,
    SegmentedControl,
    Skeleton,
    StatusBadge,
    Tooltip,
} from '../components/ui';
import { ConfirmDialog } from '../components/Overlay';
import { FieldControl, type RefOption } from '../components/FieldControl';
import { SeoPreview } from '../components/SeoPreview';
import { useToast } from '../components/Toast';

type Row = Record<string, unknown>;
type Section = 'base' | 'media' | 'taxo' | 'body' | 'faq' | 'seo' | 'adv' | 'config';

/** 分区归属：按字段名与类型集中判定，页面只负责渲染顺序 */
const MEDIA_NAMES = new Set(['hero', 'hero_alt', 'hero_width', 'hero_height', 'images', 'avatar']);
const ADV_NAMES = new Set(['status', 'robots', 'canonical', 'date', 'lastmod', 'menu_order', 'is_listing', 'count']);
const TAXO_NAMES = new Set(['categories', 'author', 'parent', 'trail']);

function sectionOf(f: Field): Section {
    if (f.formMode) return 'config';
    if (f.type === 'image' || f.type === 'gallery' || MEDIA_NAMES.has(f.name)) return 'media';
    if (f.type === 'html') return 'body';
    if (f.type === 'faq' || f.name === 'faq') return 'faq';
    if (f.name === 'robots') return 'seo';
    if (f.type === 'ref' || TAXO_NAMES.has(f.name)) return 'taxo';
    if (f.type === 'json' || ADV_NAMES.has(f.name)) return 'adv';
    return 'base';
}

const SECTION_META: Record<Section, { title: string; icon: IconName; desc: string }> = {
    base: { title: '基础信息', icon: 'article', desc: '标题、地址与时间，决定这条内容「是什么」' },
    media: { title: '图片与媒体', icon: 'image', desc: '主图 / 图集：上传即自动压缩为 WebP' },
    taxo: { title: '归类与关联', icon: 'folder', desc: '决定这条内容出现在哪些分类页与作者页' },
    body: { title: '正文内容', icon: 'code', desc: '访客点进页面后看到的内容：简介 / 正文 / 详情 HTML，保存时自动过滤不安全内容' },
    faq: { title: 'FAQ 问答', icon: 'help', desc: '逐条填问答；可能以问答下拉出现在 Google 搜索结果下方' },
    seo: { title: '搜索结果表现', icon: 'search', desc: '这条页面在 Google 结果里的样子：蓝标题、两行描述、是否收录' },
    adv: { title: '高级设置', icon: 'settings', desc: '发布状态与排序，一般保持默认' },
    config: { title: '站点配置', icon: 'globe', desc: '全站共用的一份配置；表单只改值，没列出的字段原样保留' },
};

function defaults(resource: Resource): Row {
    const r: Row = {};
    for (const f of resource.fields) {
        if (f.type === 'boolean') r[f.name] = false;
        else if (f.type === 'tags') r[f.name] = [];
        else if (f.type === 'json') r[f.name] = f.name === 'data' ? '{}' : '[]';
        else if (f.type === 'faq') r[f.name] = [];
        else if (f.type === 'gallery') r[f.name] = [];
        else if (f.type === 'image') r[f.name] = '';
        else if (f.type === 'ref' && f.multiple) r[f.name] = [];
        else if (f.type === 'select') r[f.name] = f.options?.[0] ?? '';
        else r[f.name] = '';
    }
    return r;
}

export default function ResourceEdit({ resource }: { resource: Resource }): JSX.Element {
    const toast = useToast();
    const params = useParams();
    const nav = useNavigate();
    const id = resource.singleton ? undefined : params.id;
    const isNew = !resource.singleton && !id;
    /** 站点设置的二级页：/site_settings/:section；不认识的段下面会重定向到第一组 */
    const siteSection = resource.singleton ? SITE_SECTIONS.find((s) => s.key === params.section) : undefined;

    const [form, setForm] = useState<Row>({});
    const [baseline, setBaseline] = useState('{}');
    const [loading, setLoading] = useState(!isNew);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [refs, setRefs] = useState<Record<string, RefOption[]>>({});
    const [askDel, setAskDel] = useState(false);

    const refFields = useMemo(() => resource.fields.filter((f) => f.type === 'ref'), [resource]);

    useEffect(() => {
        refFields.forEach(async (f) => {
            const { data } = await supabase.from(f.refTable!).select(`${f.refValue},${f.refLabel}`);
            const opts = ((data as unknown as Row[]) ?? []).map((r) => ({
                value: String(r[f.refValue!]),
                label: String(r[f.refLabel!] ?? r[f.refValue!]),
            }));
            setRefs((prev) => ({ ...prev, [f.name]: opts }));
        });
    }, [refFields]);

    useEffect(() => {
        if (isNew) {
            const d = defaults(resource);
            setForm(d);
            setBaseline(JSON.stringify(d));
            setLoading(false);
            return;
        }
        setLoading(true);
        const query = resource.singleton
            ? supabase.from(resource.table).select('*').limit(1)
            : supabase.from(resource.table).select('*').eq(resource.idField, decodeURIComponent(id!)).limit(1);
        query.then(({ data, error: e }) => {
            if (e) setError(e.message);
            const row = (data as Row[])?.[0] ?? defaults(resource);
            setForm(row);
            setBaseline(JSON.stringify(row));
            setLoading(false);
        });
    }, [resource, id, isNew]);

    const dirty = useMemo(() => JSON.stringify(form) !== baseline, [form, baseline]);

    /* 有未保存改动时拦一下浏览器关闭/刷新 */
    useEffect(() => {
        if (!dirty) return;
        const onBeforeUnload = (e: BeforeUnloadEvent): void => {
            e.preventDefault();
            e.returnValue = '';
        };
        window.addEventListener('beforeunload', onBeforeUnload);
        return () => window.removeEventListener('beforeunload', onBeforeUnload);
    }, [dirty]);

    const setVal = (name: string, v: unknown): void => setForm((f) => ({ ...f, [name]: v }));

    async function save(): Promise<void> {
        setSaving(true);
        setError(null);
        const payload: Row = {};
        for (const f of resource.fields) {
            let v = form[f.name];
            if (f.type === 'json' && typeof v === 'string') {
                const trimmed = v.trim();
                if (trimmed) {
                    try {
                        JSON.parse(trimmed);
                    } catch {
                        setSaving(false);
                        setError(`「${f.label}」不是合法 JSON`);
                        toast.fail('未保存', `「${f.label}」不是合法 JSON`);
                        return;
                    }
                }
                // data 列是 text（存 site.json 原文）；其余 json 列存解析后的对象/数组
                v = f.name === 'data' ? trimmed : trimmed ? JSON.parse(trimmed) : [];
            }
            if (f.type === 'faq' && Array.isArray(v)) {
                /* 只保留问答两全的条目：编辑器里的半成品行不进库，避免前台/结构化数据出现空壳 */
                v = (v as Array<Record<string, unknown>>).filter(
                    (x) => x && typeof x.q === 'string' && x.q.trim() && typeof x.a === 'string' && x.a.trim(),
                );
            }
            if (f.type === 'number') v = v === '' || v == null ? null : Number(v);
            if (f.type === 'html' && typeof v === 'string') v = sanitizeHtml(v);
            payload[f.name] = v ?? null;
        }
        if (resource.singleton) payload.id = true;
        const { error: e } = await supabase.from(resource.table).upsert(payload, { onConflict: resource.idField });
        setSaving(false);
        if (e) {
            setError(e.message);
            toast.fail('保存失败', e.message);
            return;
        }
        invalidateReadouts();
        toast.ok(isNew ? `已新建${resource.singular}` : `已保存${resource.singular}`, '点顶栏「发布上线」后才会出现在前台');
        nav(`/${resource.key}`);
    }

    async function remove(): Promise<void> {
        if (resource.singleton || !id) return;
        const { error: e } = await supabase.from(resource.table).delete().eq(resource.idField, decodeURIComponent(id));
        setAskDel(false);
        if (e) {
            setError(e.message);
            toast.fail('删除失败', e.message);
            return;
        }
        invalidateReadouts();
        toast.ok('已删除该记录', '不可撤销');
        nav(`/${resource.key}`);
    }

    const statusField = resource.fields.find((f) => f.name === 'status');
    const seoTitle = String(form.title ?? form.name ?? '');
    const seoDesc = stripHtml(String(form.description ?? form.summary ?? ''));
    const seoPath = String(form.canonical ?? '') || (resource.key === 'products' ? `/product/${String(form.slug ?? '')}/` : `/${String(form.slug ?? '')}/`);
    const hasSeo = !resource.singleton && (resource.fields.some((f) => f.name === 'title') || resource.fields.some((f) => f.name === 'name'));

    const sections = useMemo(() => {
        const order: Section[] = ['config', 'base', 'media', 'taxo', 'body', 'faq', 'seo', 'adv'];
        return order
            .map((s) => ({ key: s, fields: resource.fields.filter((f) => sectionOf(f) === s) }))
            /* 搜索结果表现组承载 Google 实时预览：没有 robots 字段的类型（产品/分类）也保留这一组 */
            .filter((g) => g.fields.length > 0 || (g.key === 'seo' && hasSeo));
    }, [resource, hasSeo]);

    const required = resource.fields.filter((f) => f.required);
    const missing = required.filter((f) => !String(form[f.name] ?? '').trim());
    const bodyChars = stripHtml(String(form.body ?? '')).length;
    const heroSrc = typeof form.hero === 'string' ? form.hero : (Array.isArray(form.images) ? String((form.images as Array<{ src?: string }>)[0]?.src ?? '') : '');
    /* 自检读数只展示该类型真实存在的字段：否则站点设置这类配置页会摆出「正文 0 字 / 未设置主图」的误导读数 */
    const hasBodyField = resource.fields.some((f) => f.name === 'body');
    const hasHeroField = resource.fields.some((f) => f.name === 'hero' || f.name === 'images');

    /* 站点设置只认已知的二级段，乱输地址就回到第一组（放在所有 hook 之后） */
    if (resource.singleton && !siteSection) return <Navigate to={`/${resource.key}/${SITE_SECTIONS[0]!.key}`} replace />;

    if (loading) {
        return (
            <Card className="p-6">
                <div className="flex items-center gap-3">
                    <Skeleton rows={1} className="w-40" />
                </div>
                <div className="mt-6 space-y-4">
                    <Skeleton rows={3} />
                    <Skeleton rows={2} />
                </div>
            </Card>
        );
    }

    return (
        <div className="pb-20">
            <PageHeader
                kicker={`${resource.group} · ${isNew ? '新建' : siteSection ? siteSection.label : '编辑'}`}
                title={
                    <span className="flex flex-wrap items-center gap-2.5">
                        {isNew ? `新建${resource.singular}` : resource.displayName ?? String(form[resource.titleField] ?? resource.singular)}
                        {siteSection && (
                            <Badge tone="gold" icon={siteSection.icon}>
                                {siteSection.label}
                            </Badge>
                        )}
                        {!isNew && statusField && <StatusBadge status={form.status as string | undefined} />}
                    </span>
                }
                desc={resource.desc ?? `维护${resource.singular}；带 * 的字段是前台生成的必需项。`}
                meta={
                    <>
                        {resource.singleton ? (
                            <Tooltip text="站点设置全站只有这一行，改完所有页面都会用它；所以默认只读，要改需显式解锁。">
                                <Badge tone="amber" icon="lock">
                                    全站唯一 · 影响所有页面
                                </Badge>
                            </Tooltip>
                        ) : (
                            <Badge tone="slate" icon="link">
                                <span className="font-mono">{String(form[resource.idField] ?? '（保存后生成地址）')}</span>
                            </Badge>
                        )}
                        {!isNew && form.updated_at != null && (
                            <Badge tone="slate" icon="history">
                                更新于 {dateTime(form.updated_at as string)}（{ago(form.updated_at as string)}）
                            </Badge>
                        )}
                        {dirty && (
                            <Badge tone="amber" dot>
                                有未保存改动
                            </Badge>
                        )}
                    </>
                }
                actions={
                    <>
                        <Link to={`/${resource.key}`}>
                            <Button variant="secondary" icon="chevronLeft">
                                返回{resource.label}
                            </Button>
                        </Link>
                        {dirty && (
                            <Button variant="ghost" icon="refresh" onClick={() => setForm(JSON.parse(baseline) as Row)}>
                                放弃改动
                            </Button>
                        )}
                        <Button icon="check" loading={saving} onClick={() => void save()}>
                            {isNew ? '创建' : '保存'}
                        </Button>
                    </>
                }
            />

            {error && (
                <div className="mb-4 flex items-start gap-2.5 rounded-lg bg-accent-soft px-3.5 py-2.5 text-xs font-medium text-accent ring-1 ring-inset ring-accent/20">
                    <Icon name="alert" className="mt-px h-4 w-4 shrink-0" />
                    <span className="min-w-0 flex-1">{error}</span>
                    <button type="button" onClick={() => setError(null)} className="shrink-0 underline">
                        知道了
                    </button>
                </div>
            )}

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
                {/* 左：分区表单 */}
                <div className="space-y-5 xl:col-span-8">
                    {sections.map((g, gi) => (
                        <SectionCard
                            key={g.key}
                            id={g.key}
                            className="scroll-mt-24"
                            icon={SECTION_META[g.key].icon}
                            title={SECTION_META[g.key].title}
                            desc={SECTION_META[g.key].desc}
                            tone={g.key === 'adv' ? 'slate' : g.key === 'body' ? 'green' : 'brand'}
                            actions={
                                g.key === 'seo' ? (
                                    <span className="hidden items-center gap-1.5 text-[11px] text-slate-400 sm:flex">
                                        <Icon name="eye" className="h-3.5 w-3.5" />
                                        Google 结果实时预览
                                    </span>
                                ) : (
                                    <span className="hidden items-center gap-1.5 text-[11px] text-slate-400 sm:flex">
                                        <Icon name="list" className="h-3.5 w-3.5" />
                                        {g.fields.length} 个字段
                                    </span>
                                )
                            }
                            bodyClassName={g.key === 'body' ? 'p-4' : 'p-5'}
                        >
                            <div className={cx('grid grid-cols-1 gap-4', g.key === 'body' ? '' : 'md:grid-cols-2')}>
                                {g.fields.map((f) => (
                                    <FieldControl
                                        key={f.name}
                                        field={f}
                                        value={form[f.name]}
                                        options={refs[f.name] ?? []}
                                        section={siteSection?.key}
                                        onChange={(v) => setVal(f.name, v)}
                                    />
                                ))}
                            </div>
                            {g.key === 'seo' && hasSeo && (
                                <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
                                    <p className="text-[11px] leading-relaxed text-slate-500">
                                        下面是这条页面目前在 Google 结果里的样子，随输入实时变：蓝标题来自「SEO 标题 / 标题」字段，灰两行来自「摘要 / 描述」字段，结果下方的问答下拉来自「FAQ 问答」组。
                                    </p>
                                    <SeoPreview
                                        title={seoTitle}
                                        description={seoDesc}
                                        path={seoPath}
                                        brand="CENNETIC"
                                        hero={heroSrc || null}
                                        heroAlt={String(form.hero_alt ?? '')}
                                    />
                                </div>
                            )}
                            {gi === 0 && !resource.singleton && (
                                <p className="mt-4 flex items-start gap-1.5 rounded-lg bg-brand-50/70 px-3 py-2 text-[11px] leading-relaxed text-brand-700 ring-1 ring-inset ring-brand-100">
                                    <Icon name="alert" className="mt-px h-3.5 w-3.5 shrink-0" />
                                    Slug 是前台网址的一部分，改动后旧链接不会自动跳转，需要额外做 301。
                                </p>
                            )}
                        </SectionCard>
                    ))}

                    {!resource.preview && !resource.singleton && (
                        <Card className="flex items-center gap-3 p-4">
                            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                                <Icon name="eye" className="h-4 w-4" />
                            </span>
                            <p className="text-[11px] leading-relaxed text-slate-500">
                                该类型没有独立前台页面（只做数据/分类），因此不提供预览链接；发布后会被引用它的页面读取。
                            </p>
                        </Card>
                    )}
                </div>

                {/* 右：常驻决策栏 */}
                <aside className="space-y-5 xl:col-span-4">
                    <div className="sticky top-[88px] space-y-5">
                        {resource.singleton ? (
                            /* 单例配置没有状态/草稿概念，保存只放顶栏一处：这里再摆一个保存按钮会让人以为要点两次 */
                            <SectionCard
                                icon="rocket"
                                tone="gold"
                                title="改动如何生效"
                                desc="保存只是存进后台，上线仍需点顶栏发布"
                            >
                                <p className="text-[11px] leading-relaxed text-slate-500">
                                    站点设置全站唯一，没有草稿/状态概念：表单改的就是这一份配置本身。保存后点顶栏「发布上线」才会同步到前台。本页保存入口只有右上角一个。
                                </p>
                            </SectionCard>
                        ) : (
                            <SectionCard
                                icon="rocket"
                                tone="gold"
                                title="发布这条内容"
                                desc="状态决定是否上前台，改动仍需点顶栏发布"
                            >
                                {statusField ? (
                                    <>
                                        <SegmentedControl<'draft' | 'published'>
                                            value={form.status === 'published' ? 'published' : 'draft'}
                                            onChange={(v) => setVal('status', v)}
                                            options={[
                                                { value: 'draft', label: '草稿', icon: 'pencil' },
                                                { value: 'published', label: '已发布', icon: 'globe' },
                                            ]}
                                        />
                                        <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
                                            {form.status === 'published'
                                                ? '已发布：下次发布后，网站首页、列表页与搜索收录都会带上它。'
                                                : '草稿：只存在于后台，网站上不会出现，也不会被搜索收录，可放心反复编辑。'}
                                        </p>
                                    </>
                                ) : (
                                    <p className="text-[11px] leading-relaxed text-slate-500">
                                        该类型没有草稿概念，保存后下次发布即生效。
                                    </p>
                                )}
                                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
                                    <Button icon="check" loading={saving} onClick={() => void save()}>
                                        {isNew ? '创建立即返回' : '保存'}
                                    </Button>
                                    {resource.preview && !isNew && (
                                        <Button
                                            variant="secondary"
                                            icon="external"
                                            onClick={() => window.open(window.location.origin + seoPath, '_blank', 'noopener')}
                                        >
                                            前台预览
                                        </Button>
                                    )}
                                </div>
                            </SectionCard>
                        )}

                        {/* 没有必填项、也没有正文/主图可读时（如站点设置），整张自检卡只是噪音，不渲染 */}
                        {(required.length > 0 || hasBodyField || hasHeroField) && (
                            <SectionCard
                                icon="shield"
                                title="保存前自检"
                                desc={`${required.length} 个必填项 · ${sections.length} 个分区`}
                                actions={
                                    missing.length === 0 ? (
                                        <Badge tone="green" icon="checkCircle">
                                            可保存
                                        </Badge>
                                    ) : (
                                        <Badge tone="red" icon="alert">
                                            缺 {missing.length} 项
                                        </Badge>
                                    )
                                }
                                bodyClassName="p-4"
                            >
                                <ul className="space-y-1.5">
                                    {required.map((f) => {
                                        const ok = !!String(form[f.name] ?? '').trim();
                                        return (
                                            <li key={f.name} className="flex items-center gap-2 text-[12px]">
                                                <Icon
                                                    name={ok ? 'checkCircle' : 'dot'}
                                                    className={cx('h-3.5 w-3.5 shrink-0', ok ? 'text-emerald-500' : 'text-slate-300')}
                                                />
                                                <span className={cx('min-w-0 flex-1 truncate', ok ? 'text-slate-600' : 'font-medium text-slate-800')}>
                                                    {f.label}
                                                </span>
                                                {!ok && <span className="shrink-0 text-[10px] font-semibold uppercase text-accent">必填</span>}
                                            </li>
                                        );
                                    })}
                                    {required.length === 0 && <li className="text-[12px] text-slate-400">该类型没有强制必填项</li>}
                                </ul>
                                {(hasBodyField || hasHeroField) && (
                                    <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 text-[11px]">
                                        {hasBodyField && (
                                            <span className="flex items-center gap-1.5 text-slate-500">
                                                <Icon name="code" className="h-3.5 w-3.5 text-slate-400" />
                                                正文 {bodyChars} 字
                                            </span>
                                        )}
                                        {hasHeroField && (
                                            <span className="flex items-center gap-1.5 text-slate-500">
                                                <Icon name="image" className="h-3.5 w-3.5 text-slate-400" />
                                                {heroSrc ? '已设置主图' : '未设置主图'}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </SectionCard>
                        )}

                        {!isNew && !resource.singleton && (
                            <Card className="border-accent/20 p-4">
                                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-accent">
                                    <Icon name="alert" className="h-3.5 w-3.5" />
                                    危险区
                                </p>
                                <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
                                    删除会把这条记录从后台移除，下次发布后网站上不再有该页面。
                                </p>
                                <Button variant="danger" icon="trash" className="mt-3" onClick={() => setAskDel(true)}>
                                    删除这条{resource.singular}
                                </Button>
                            </Card>
                        )}

                        {sections.length > 1 && (
                            <Card className="p-4">
                                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">分区跳转</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {sections.map((g) => (
                                        <a
                                            key={g.key}
                                            href={`#${g.key}`}
                                            className="rounded-md bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-600 ring-1 ring-inset ring-slate-100 transition-colors hover:bg-brand-50 hover:text-brand-700"
                                        >
                                            {SECTION_META[g.key].title}
                                        </a>
                                    ))}
                                </div>
                            </Card>
                        )}
                    </div>
                </aside>
            </div>

            {/* 底部常驻动作条：只在有未保存改动时出现 */}
            <div
                className={cx(
                    'fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200/80 bg-white/85 px-4 py-3 backdrop-blur-xl transition-all duration-300 ease-expo sm:px-6 lg:pl-[264px]',
                    dirty ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-full opacity-0',
                )}
            >
                <div className="mx-auto flex max-w-[1360px] flex-wrap items-center gap-3">
                    <span className="flex items-center gap-2 text-[12px] font-medium text-amber-700">
                        <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-60 animate-ping-soft" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
                        </span>
                        有未保存改动
                    </span>
                    <span className="hidden text-[11px] text-slate-400 sm:block">离开本页前请先保存，否则改动只留在浏览器里。</span>
                    <div className="ml-auto flex items-center gap-2">
                        <Button variant="ghost" icon="close" onClick={() => setForm(JSON.parse(baseline) as Row)}>
                            放弃
                        </Button>
                        <Button icon="check" loading={saving} onClick={() => void save()}>
                            {isNew ? '创建' : '保存'}
                        </Button>
                    </div>
                </div>
            </div>

            <ConfirmDialog
                open={askDel}
                onClose={() => setAskDel(false)}
                onConfirm={() => void remove()}
                title={`删除「${String(form[resource.titleField] ?? id ?? '')}」？`}
                desc="将从后台永久删除，网站在下次发布后不再有该页面。此操作不可撤销。"
                confirmLabel="永久删除"
            />
        </div>
    );
}
