/**
 * 通用列表页：由 resources.ts 的配置驱动（加一类内容＝加配置，不写新页面）。
 * 这一版把「表格」做成数据表：搜索 + 状态分段 + 排序 + 缩略图 + 批量操作 + 分页 + 骨架屏，
 * 就地快改用模态框，反馈一律走 Toast。
 */
import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { sanitizeHtml } from '../lib/sanitize';
import { invalidateReadouts } from '../lib/readouts';
import { ago, date, num } from '../lib/format';
import { cx } from '../lib/cx';
import type { Field, Resource } from '../lib/resources';
import { Icon, type IconName } from '../components/Icon';
import {
    Badge,
    Button,
    Card,
    EmptyState,
    Field as FormField,
    IconInput,
    IconButton,
    Input,
    PageHeader,
    SegmentedControl,
    Select,
    StatusBadge,
    Textarea,
} from '../components/ui';
import { ConfirmDialog, Dropdown, MenuLabel, MenuItem, Modal } from '../components/Overlay';
import { useToast } from '../components/Toast';

type Row = Record<string, unknown>;
type StatusFilter = 'all' | 'published' | 'draft';
type Sort = { col: string; dir: 'asc' | 'desc' };

const PAGE_SIZE = 20;

/** 列渲染：数组拼成一行、布尔说人话，再按 ListCol.alias 把哨位值换成可读文本 */
function renderCell(v: unknown, alias?: Record<string, string>): string {
    if (v == null) return '';
    const s = Array.isArray(v) ? v.join(', ') : typeof v === 'boolean' ? (v ? '是' : '否') : String(v);
    return alias && Object.prototype.hasOwnProperty.call(alias, s) ? alias[s]! : s;
}

/**
 * 像图片地址的字符串才当缩略图。作者表的 avatar 存的是**字母头像**（前台渲染成圆形字块，
 * 如 "B"），当 URL 用会得到 src="B" → 请求 /admin/B 404。
 */
const IMG_SRC_SHAPE = /^(https?:)?\/\/|^\.?\.?\/|^data:|\.(png|jpe?g|gif|svg|webp|avif)(\?|#|$)/i;
function imgSrc(v: unknown): string | null {
    const s = typeof v === 'string' ? v.trim() : '';
    return s && IMG_SRC_SHAPE.test(s) ? s : null;
}

/** 列表缩略图：主图 → 图集首张 → 头像，都没有就不显示 */
function thumbOf(row: Row): string | null {
    const imgs = Array.isArray(row.images) ? (row.images as Array<{ src?: string }>) : null;
    return imgSrc(row.hero) ?? imgSrc(imgs?.[0]?.src) ?? imgSrc(row.avatar);
}

function previewHref(resource: Resource, row: Row): string {
    const origin = window.location.origin;
    const canon = row.canonical;
    if (typeof canon === 'string' && canon) return origin + canon;
    const slug = String(row[resource.idField] ?? '');
    return origin + (resource.key === 'products' ? `/product/${slug}/` : `/${slug}/`);
}

export default function ResourceList({ resource }: { resource: Resource }): JSX.Element {
    const toast = useToast();
    const [rows, setRows] = useState<Row[]>([]);
    const [loading, setLoading] = useState(true);
    const [q, setQ] = useState('');
    const [status, setStatus] = useState<StatusFilter>('all');
    const [sort, setSort] = useState<Sort>({ col: resource.orderBy, dir: resource.ascending === false ? 'desc' : 'asc' });
    const [page, setPage] = useState(1);
    const [picked, setPicked] = useState<string[]>([]);
    const [quick, setQuick] = useState<Row | null>(null);
    const [saving, setSaving] = useState(false);
    const [askDel, setAskDel] = useState<string[] | null>(null);

    const quickFields = useMemo(() => resource.fields.filter((f) => f.quick), [resource]);
    const hasStatus = resource.fields.some((f) => f.name === 'status');
    // 分类/作者这类参照表没有 updated_at，表头与单元格用同一个开关，不留空列
    const hasUpdatedCol = !!resource.hasUpdatedAt;

    const load = (): void => {
        setLoading(true);
        supabase
            .from(resource.table)
            .select('*')
            .then(({ data, error }) => {
                if (error) toast.fail('读取失败', error.message);
                setRows((data as Row[]) ?? []);
                setLoading(false);
            });
    };
    useEffect(load, [resource]); // eslint-disable-line react-hooks/exhaustive-deps

    const filtered = useMemo(() => {
        const s = q.trim().toLowerCase();
        let out = rows;
        if (s) {
            out = out.filter((r) =>
                [r[resource.titleField], r[resource.idField], ...(Array.isArray(r.categories) ? (r.categories as string[]) : [])]
                    .filter(Boolean)
                    .some((v) => String(v).toLowerCase().includes(s)),
            );
        }
        if (hasStatus && status !== 'all') out = out.filter((r) => (status === 'draft' ? r.status !== 'published' : r.status === 'published'));
        const { col, dir } = sort;
        return [...out].sort((a, b) => {
            const x = a[col];
            const y = b[col];
            if (x == null) return 1;
            if (y == null) return -1;
            const cmp = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'zh-CN', { numeric: true });
            return dir === 'asc' ? cmp : -cmp;
        });
    }, [rows, q, status, sort, resource, hasStatus]);

    const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const safePage = Math.min(page, pages);
    const view = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

    const counts = useMemo(
        () => ({
            all: rows.length,
            published: rows.filter((r) => r.status === 'published').length,
            draft: rows.filter((r) => r.status !== 'published').length,
        }),
        [rows],
    );

    const togglePick = (id: string): void =>
        setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
    const allPicked = view.length > 0 && view.every((r) => picked.includes(String(r[resource.idField])));

    async function setStatusBatch(next: 'draft' | 'published'): Promise<void> {
        const { error } = await supabase
            .from(resource.table)
            .update({ status: next })
            .in(resource.idField, picked);
        if (error) {
            toast.fail('批量改状态失败', error.message);
            return;
        }
        setRows((rs) => rs.map((r) => (picked.includes(String(r[resource.idField])) ? { ...r, status: next } : r)));
        toast.ok(`已将 ${picked.length} 项设为${next === 'published' ? '已发布' : '草稿'}`, '记得点顶栏「发布上线」才生效');
        setPicked([]);
        invalidateReadouts();
    }

    async function removeBatch(ids: string[]): Promise<void> {
        const { error } = await supabase.from(resource.table).delete().in(resource.idField, ids);
        setAskDel(null);
        if (error) {
            toast.fail('删除失败', error.message);
            return;
        }
        setRows((rs) => rs.filter((r) => !ids.includes(String(r[resource.idField]))));
        setPicked([]);
        toast.ok(`已删除 ${ids.length} 条记录`, '此操作不可撤销，如需找回要重新录入');
        invalidateReadouts();
    }

    async function saveQuick(): Promise<void> {
        if (!quick) return;
        setSaving(true);
        const payload: Row = { [resource.idField]: quick[resource.idField] };
        for (const f of quickFields) {
            let v = quick[f.name];
            if (f.type === 'number') v = v === '' || v == null ? null : Number(v);
            if (f.type === 'html' && typeof v === 'string') v = sanitizeHtml(v);
            payload[f.name] = v ?? null;
        }
        const { error } = await supabase.from(resource.table).upsert(payload, { onConflict: resource.idField });
        setSaving(false);
        if (error) {
            toast.fail('快改未保存', error.message);
            return;
        }
        setRows((rs) => rs.map((r) => (String(r[resource.idField]) === String(payload[resource.idField]) ? { ...r, ...payload } : r)));
        setQuick(null);
        invalidateReadouts();
        toast.ok('已保存快改', '改动只存在后台，需点发布才上网站');
    }

    const cols = resource.listCols;

    return (
        <div>
            <PageHeader
                kicker={`${resource.group}管理`}
                title={resource.label}
                desc={resource.desc ?? `维护${resource.label}的全部条目；保存后需点顶栏「发布上线」才会进入前台。`}
                meta={
                    <>
                        <Badge tone="blue">{num(counts.all)} 条记录</Badge>
                        {hasStatus && (
                            <>
                                <Badge tone="green">{num(counts.published)} 已发布</Badge>
                                <Badge tone="amber">{num(counts.draft)} 草稿</Badge>
                            </>
                        )}
                        <Badge tone="slate" icon="refresh">
                            排序：{cols.find((c) => c.name === sort.col)?.label ?? sort.col} {sort.dir === 'asc' ? '升' : '降'}
                        </Badge>
                    </>
                }
                actions={
                    <>
                        <IconButton icon="refresh" label="重新读取" onClick={load} />
                        {quickFields.length > 0 && <Badge tone="gold" icon="bolt">{`${quickFields.length} 个字段可就地快改`}</Badge>}
                        <Link to={`/${resource.key}/new`}>
                            <Button icon="plus">新建{resource.singular}</Button>
                        </Link>
                    </>
                }
            />

            <Card className="mb-4 flex flex-wrap items-center gap-3 p-3">
                <IconInput
                    icon="search"
                    value={q}
                    onChange={(e) => {
                        setQ(e.target.value);
                        setPage(1);
                    }}
                    placeholder={`搜索${resource.label}…`}
                    className="w-full sm:w-72"
                />
                {hasStatus && (
                    <SegmentedControl<StatusFilter>
                        value={status}
                        onChange={setStatus}
                        options={[
                            { value: 'all', label: '全部', count: counts.all },
                            { value: 'published', label: '已发布', count: counts.published },
                            { value: 'draft', label: '草稿', count: counts.draft },
                        ]}
                    />
                )}
                <span className="ml-auto flex items-center gap-2 text-[11px] text-slate-400">
                    显示第 {filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1}–
                    {Math.min(safePage * PAGE_SIZE, filtered.length)} 条，共 {filtered.length} 条
                </span>
            </Card>

            {picked.length > 0 && (
                <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-brand-100 bg-[linear-gradient(180deg,#f5f8fd,#eef3fb)] px-4 py-3 shadow-card animate-fade-up">
                    <span className="flex items-center gap-2 text-[13px] font-semibold text-brand-800">
                        <Icon name="checkCircle" className="h-4 w-4" />
                        已选 {picked.length} 项
                    </span>
                    <span className="h-4 w-px bg-brand-200" />
                    <div className="flex flex-wrap items-center gap-2">
                        <Button size="sm" variant="secondary" icon="check" onClick={() => void setStatusBatch('published')}>
                            设为已发布
                        </Button>
                        <Button size="sm" variant="secondary" icon="pencil" onClick={() => void setStatusBatch('draft')}>
                            转为草稿
                        </Button>
                        <Button size="sm" variant="danger" icon="trash" onClick={() => setAskDel(picked)}>
                            删除
                        </Button>
                    </div>
                    <button type="button" onClick={() => setPicked([])} className="ml-auto text-[11px] font-medium text-slate-500 hover:text-slate-700">
                        取消选择
                    </button>
                </div>
            )}

            <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="border-b border-slate-200/80 bg-[linear-gradient(180deg,#fbfcfe,#f5f7fb)]">
                            <tr>
                                <th className="w-10 px-4 py-2.5">
                                    <input
                                        type="checkbox"
                                        aria-label="全选本页"
                                        checked={allPicked}
                                        onChange={() => setPicked(allPicked ? [] : view.map((r) => String(r[resource.idField])))}
                                        className="focus-ring h-4 w-4 rounded border-slate-300 text-brand-700 accent-[#012760]"
                                    />
                                </th>
                                {cols.map((c) => {
                                    const active = sort.col === c.name;
                                    return (
                                        <th key={c.name} className="th">
                                            <button
                                                type="button"
                                                onClick={() => setSort((s) => ({ col: c.name, dir: s.col === c.name && s.dir === 'asc' ? 'desc' : 'asc' }))}
                                                className={cx(
                                                    'inline-flex items-center gap-1 transition-colors hover:text-brand-600',
                                                    active && 'text-brand-700',
                                                )}
                                            >
                                                {c.label}
                                                <Icon
                                                    name={active ? (sort.dir === 'asc' ? 'chevronUp' : 'chevronDown') : 'sort'}
                                                    className={cx('h-3 w-3', active ? 'opacity-80' : 'opacity-30')}
                                                />
                                            </button>
                                        </th>
                                    );
                                })}
                                {hasStatus && <th className="th">状态</th>}
                                {hasUpdatedCol && <th className="th">更新</th>}
                                <th className="th text-right">操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading &&
                                Array.from({ length: 6 }, (_, i) => (
                                    <tr key={i} className="border-t border-slate-100">
                                        <td className="px-4 py-3.5">
                                            <div className="skeleton h-4 w-4 rounded" />
                                        </td>
                                        {Array.from({ length: cols.length + (hasStatus ? 2 : 1) }, (__, k) => (
                                            <td key={k} className="px-4 py-3.5">
                                                <div className="skeleton h-4" style={{ width: `${60 + ((k * 13) % 30)}%` }} />
                                            </td>
                                        ))}
                                    </tr>
                                ))}

                            {!loading &&
                                view.map((r) => {
                                    const key = String(r[resource.idField]);
                                    const isPicked = picked.includes(key);
                                    const thumb = thumbOf(r);
                                    return (
                                        <Fragment key={key}>
                                            <tr className={cx('row-hot border-t border-slate-100', isPicked && 'bg-brand-50/60')}>
                                                <td className="px-4 py-3">
                                                    <input
                                                        type="checkbox"
                                                        aria-label={`选择 ${key}`}
                                                        checked={isPicked}
                                                        onChange={() => togglePick(key)}
                                                        className="focus-ring h-4 w-4 rounded border-slate-300 accent-[#012760]"
                                                    />
                                                </td>
                                                {cols.map((c, ci) => (
                                                    <td key={c.name} className="td">
                                                        {ci === 0 ? (
                                                            <div className="flex items-center gap-3">
                                                                {thumb ? (
                                                                    <img
                                                                        src={thumb}
                                                                        alt=""
                                                                        loading="lazy"
                                                                        className="h-9 w-12 shrink-0 rounded-md bg-slate-100 object-cover ring-1 ring-inset ring-slate-200"
                                                                    />
                                                                ) : (
                                                                    <span className="inline-flex h-9 w-12 shrink-0 items-center justify-center rounded-md bg-slate-50 text-slate-300 ring-1 ring-inset ring-slate-100">
                                                                        <Icon name={resource.icon} className="h-4 w-4" />
                                                                    </span>
                                                                )}
                                                                <span className="min-w-0">
                                                                    <Link
                                                                        to={`/${resource.key}/${encodeURIComponent(key)}`}
                                                                        className="block max-w-[26rem] truncate font-medium text-slate-800 transition-colors hover:text-brand-700"
                                                                    >
                                                                        {renderCell(r[c.name], c.alias) || '（未命名）'}
                                                                    </Link>
                                                                    {c.name !== resource.idField && (
                                                                        <span className="mt-0.5 block max-w-[26rem] truncate font-mono text-[11px] text-slate-400">{key}</span>
                                                                    )}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <span className={cx('block max-w-[18rem] truncate', /date|updated|menu_order/.test(c.name) ? 'tabular-nums text-slate-500' : 'text-slate-600')}>
                                                                {c.name === 'date' ? date(r[c.name] as string) : renderCell(r[c.name], c.alias)}
                                                            </span>
                                                        )}
                                                    </td>
                                                ))}
                                                {hasStatus && (
                                                    <td className="td whitespace-nowrap">
                                                        <StatusBadge status={r.status as string | undefined} />
                                                    </td>
                                                )}
                                                {hasUpdatedCol && (
                                                    <td className="td whitespace-nowrap text-[11px] tabular-nums text-slate-400">
                                                        {ago(r.updated_at as string | undefined)}
                                                    </td>
                                                )}
                                                <td className="td">
                                                    <div className="flex items-center justify-end gap-0.5">
                                                        {quickFields.length > 0 && (
                                                            <IconButton icon="bolt" label="就地快改" onClick={() => setQuick({ ...r })} />
                                                        )}
                                                        {resource.preview && (
                                                            <IconButton
                                                                icon="eye"
                                                                label="前台预览"
                                                                onClick={() => window.open(previewHref(resource, r), '_blank', 'noopener')}
                                                            />
                                                        )}
                                                        <Link to={`/${resource.key}/${encodeURIComponent(key)}`}>
                                                            <IconButton icon="pencil" label="编辑" />
                                                        </Link>
                                                        <Dropdown
                                                            label="更多操作"
                                                            width="w-52"
                                                            trigger={(open, toggle) => (
                                                                <IconButton icon="dots" label="更多" onClick={toggle} className={open ? 'bg-slate-100 text-brand-700' : ''} />
                                                            )}
                                                        >
                                                            {(close) => (
                                                                <>
                                                                    <MenuLabel>这条{resource.singular}</MenuLabel>
                                                                    <MenuItem icon="copy" hint="Slug" onClick={close}>
                                                                        <button
                                                                            type="button"
                                                                            className="block w-full text-left"
                                                                            onClick={() => {
                                                                                void navigator.clipboard
                                                                                    ?.writeText(key)
                                                                                    .then(() => toast.ok('已复制 Slug', key))
                                                                                    .catch(() => toast.fail('复制失败', '浏览器未授权剪贴板'));
                                                                            }}
                                                                        >
                                                                            {key}
                                                                        </button>
                                                                    </MenuItem>
                                                                    <MenuItem icon="trash" tone="danger" onClick={close}>
                                                                        <button type="button" className="block w-full text-left" onClick={() => setAskDel([key])}>
                                                                            删除这条
                                                                        </button>
                                                                    </MenuItem>
                                                                </>
                                                            )}
                                                        </Dropdown>
                                                    </div>
                                                </td>
                                            </tr>
                                        </Fragment>
                                    );
                                })}

                            {!loading && filtered.length === 0 && (
                                <tr>
                                    <td colSpan={cols.length + (hasStatus ? 4 : 3)}>
                                        <EmptyState
                                            icon={resource.icon as IconName}
                                            title={q ? '没有匹配的结果' : `还没有${resource.label}`}
                                            desc={q ? '换个关键词，或清空搜索看全部记录。' : resource.desc ?? '新建第一条记录后即可在此维护。'}
                                            action={
                                                q ? (
                                                    <Button variant="secondary" icon="close" onClick={() => setQ('')}>
                                                        清空搜索
                                                    </Button>
                                                ) : (
                                                    <Link to={`/${resource.key}/new`}>
                                                        <Button icon="plus">新建{resource.singular}</Button>
                                                    </Link>
                                                )
                                            }
                                        />
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* 分页条 */}
                <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 bg-[linear-gradient(180deg,#fcfdff,#f7f9fc)] px-4 py-3">
                    <span className="text-[11px] text-slate-400">
                        每页 {PAGE_SIZE} 条 · 第 {safePage}/{pages} 页
                    </span>
                    <div className="ml-auto flex items-center gap-1">
                        <IconButton icon="chevronLeft" label="上一页" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)} />
                        {Array.from({ length: pages }, (_, i) => i + 1)
                            .filter((p) => p === 1 || p === pages || Math.abs(p - safePage) <= 1)
                            .map((p, i, arr) => (
                                <Fragment key={p}>
                                    {i > 0 && p - (arr[i - 1] as number) > 1 && <span className="px-1 text-xs text-slate-300">…</span>}
                                    <button
                                        type="button"
                                        onClick={() => setPage(p)}
                                        className={cx(
                                            'focus-ring h-8 min-w-8 rounded-lg px-2 text-xs font-semibold tabular-nums transition-all duration-200',
                                            p === safePage
                                                ? 'bg-[linear-gradient(180deg,#37619f,#012760)] text-white shadow-glow'
                                                : 'text-slate-500 hover:bg-slate-100',
                                        )}
                                    >
                                        {p}
                                    </button>
                                </Fragment>
                            ))}
                        <IconButton icon="chevronRight" label="下一页" disabled={safePage >= pages} onClick={() => setPage(safePage + 1)} />
                    </div>
                </div>
            </Card>

            {/* 就地快改 */}
            <Modal
                open={!!quick}
                onClose={() => setQuick(null)}
                title={`快改：${String(quick?.[resource.titleField] ?? quick?.[resource.idField] ?? '')}`}
                desc={`只提交下列 ${quickFields.length} 个字段，其它内容不动。`}
                icon="bolt"
                footer={
                    <>
                        <Button variant="ghost" onClick={() => setQuick(null)}>
                            取消
                        </Button>
                        <Button icon="check" loading={saving} onClick={() => void saveQuick()}>
                            保存快改
                        </Button>
                    </>
                }
            >
                {quick && (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        {quickFields.map((f) => (
                            <FormField key={f.name} label={f.label} help={f.help} className={f.full ? 'md:col-span-2' : ''}>
                                <QuickInput field={f} value={quick[f.name]} onChange={(v) => setQuick((r) => ({ ...(r ?? {}), [f.name]: v }))} />
                            </FormField>
                        ))}
                    </div>
                )}
            </Modal>

            <ConfirmDialog
                open={!!askDel}
                onClose={() => setAskDel(null)}
                onConfirm={() => void removeBatch(askDel ?? [])}
                title={`删除 ${askDel?.length ?? 0} 条${resource.singular}？`}
                desc={`将从后台永久删除${askDel && askDel.length === 1 ? `「${askDel[0]}」` : `这 ${askDel?.length ?? 0} 条记录`}，网站在下次发布后不再出现。此操作不可撤销。`}
                confirmLabel="永久删除"
            />
        </div>
    );
}

function QuickInput({ field, value, onChange }: { field: Field; value: unknown; onChange: (v: unknown) => void }): JSX.Element {
    if (field.type === 'select') {
        return (
            <Select value={String(value ?? '')} onChange={(e) => onChange(e.target.value)}>
                {(field.options ?? []).map((o) => (
                    <option key={o} value={o}>
                        {o === 'draft' ? 'draft（草稿）' : o === 'published' ? 'published（已发布）' : o}
                    </option>
                ))}
            </Select>
        );
    }
    if (field.type === 'html' || field.type === 'textarea') {
        return <Textarea rows={3} mono={field.type === 'html'} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />;
    }
    if (field.type === 'number') {
        return <Input type="number" value={value == null ? '' : String(value)} onChange={(e) => onChange(e.target.value)} />;
    }
    return <Input value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />;
}
