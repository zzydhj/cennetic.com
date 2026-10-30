/**
 * 询盘：前台表单投递进来的业务数据。
 *
 * 它和内容类的文章/产品不是一回事，所以走独立页面而不是通用 CRUD：
 *   · 不进快照、不参与发布 —— 「谁留了邮箱电话」属于个人信息，不该永久留在 git 历史里
 *   · 没有「新建」按钮是刻意的 —— 这张表只接受来自站外的投递，后台负责看/标记/备注/删
 *   · 主键是 uuid 而非 slug，通用编辑页会逼着人填一个看不懂的 UUID
 * 写入端在 functions/api/inquiry.ts（以 anon 身份，靠库上 RLS 约束），
 * 这里以登录用户身份读写，RLS 给 authenticated 的是全权。
 */
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { ago, dateTime } from '../lib/format';
import { cx } from '../lib/cx';
import { Icon, type IconName } from '../components/Icon';
import {
    Badge,
    Button,
    Card,
    EmptyState,
    IconButton,
    PageHeader,
    SegmentedControl,
    Skeleton,
    Textarea,
    Tooltip,
} from '../components/ui';
import { ConfirmDialog } from '../components/Overlay';
import { useToast } from '../components/Toast';

type State = 'new' | 'reading' | 'done' | 'junk';

interface InquiryRow {
    id: string;
    name: string;
    email: string;
    phone: string;
    country: string;
    message: string;
    page: string;
    product: string;
    state: State;
    note: string;
    created_at: string | null;
}

const STATE_META: Record<State, { label: string; tone: 'blue' | 'amber' | 'green' | 'slate'; icon: IconName }> = {
    new: { label: '未读', tone: 'blue', icon: 'mail' },
    reading: { label: '跟进中', tone: 'amber', icon: 'clock' },
    done: { label: '已处理', tone: 'green', icon: 'checkCircle' },
    junk: { label: '垃圾', tone: 'slate', icon: 'close' },
};

const STATE_ORDER: State[] = ['new', 'reading', 'done', 'junk'];

type Filter = 'all' | State;

export default function Inquiries() {
    const toast = useToast();
    const [rows, setRows] = useState<InquiryRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [q, setQ] = useState('');
    const [filter, setFilter] = useState<Filter>('all');
    const [open, setOpen] = useState<string | null>(null);
    const [askDel, setAskDel] = useState<InquiryRow | null>(null);
    const [draftNote, setDraftNote] = useState('');

    const load = (): void => {
        setLoading(true);
        supabase
            .from('inquiries')
            .select('*')
            .order('created_at', { ascending: false })
            .then(({ data, error }) => {
                if (error) toast.fail('读取询盘失败', error.message);
                setRows((data as InquiryRow[]) ?? []);
                setLoading(false);
            });
    };
    useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

    const counts = useMemo(() => {
        const c: Record<Filter, number> = { all: rows.length, new: 0, reading: 0, done: 0, junk: 0 };
        for (const r of rows) c[r.state] += 1;
        return c;
    }, [rows]);

    const list = useMemo(() => {
        const s = q.trim().toLowerCase();
        let out = rows;
        if (filter !== 'all') out = out.filter((r) => r.state === filter);
        if (s) out = out.filter((r) => `${r.name} ${r.email} ${r.message} ${r.country} ${r.product}`.toLowerCase().includes(s));
        return out;
    }, [rows, q, filter]);

    async function setState(row: InquiryRow, next: State): Promise<void> {
        const { error } = await supabase.from('inquiries').update({ state: next }).eq('id', row.id);
        if (error) {
            toast.fail('改状态失败', error.message);
            return;
        }
        setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, state: next } : r)));
        toast.ok(`已标记为「${STATE_META[next].label}」`, '只改后台标记，不影响前台与发布');
    }

    async function saveNote(row: InquiryRow): Promise<void> {
        const { error } = await supabase.from('inquiries').update({ note: draftNote }).eq('id', row.id);
        if (error) {
            toast.fail('备注未保存', error.message);
            return;
        }
        setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, note: draftNote } : r)));
        toast.ok('备注已保存', '只有登录后台的人看得到');
    }

    async function remove(row: InquiryRow): Promise<void> {
        setAskDel(null);
        const { error } = await supabase.from('inquiries').delete().eq('id', row.id);
        if (error) {
            toast.fail('删除失败', error.message);
            return;
        }
        setRows((rs) => rs.filter((r) => r.id !== row.id));
        toast.ok('已删除这条询盘', '该操作不可撤销');
    }

    /** 回复走访客自己的邮件客户端：不引入发信依赖，也不碰第三方 */
    function replyUrl(row: InquiryRow): string {
        const subject = `Re: Inquiry from cennetic.com${row.product ? ` — ${row.product}` : ''}`;
        return `mailto:${row.email}?subject=${encodeURIComponent(subject)}`;
    }

    async function copyEmail(row: InquiryRow): Promise<void> {
        try {
            await navigator.clipboard.writeText(row.email);
            toast.ok('邮箱已复制', row.email);
        } catch {
            toast.fail('复制失败', '浏览器拒绝了剪贴板权限，请手动选中复制');
        }
    }

    return (
        <div className="pb-20">
            <PageHeader
                kicker="系统 · 询盘"
                title="询盘"
                desc="前台联系页表单投递进来的原始记录，不经任何第三方服务。数据只存在自己的库里，不参与内容发布。"
                meta={
                    <>
                        <Badge tone={counts.new > 0 ? 'blue' : 'slate'} icon="inbox">
                            {counts.new} 条未读
                        </Badge>
                        <Tooltip text="访客提交时走的是数据库给 anon 的唯一一条插入策略：只能投递、只能标成未读，读不到任何历史行。">
                            <Badge tone="green" icon="shield">
                                共 {rows.length} 条 · 写入受 RLS 约束
                            </Badge>
                        </Tooltip>
                    </>
                }
                actions={<IconButton icon="refresh" label="重新读取" onClick={load} />}
            />

            <Card className="mb-4 flex flex-wrap items-center gap-3 p-3">
                <span className="relative block w-full sm:w-80">
                    <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="按姓名、邮箱、国家或留言内容筛选…"
                        className="focus-ring h-[38px] w-full rounded-lg border border-slate-200/90 bg-white pl-9 pr-3 text-sm shadow-inner transition-colors placeholder:text-slate-400 hover:border-slate-300 focus:border-brand-400"
                    />
                </span>
                <SegmentedControl<Filter>
                    value={filter}
                    onChange={setFilter}
                    size="sm"
                    options={[
                        { value: 'all', label: '全部', count: counts.all },
                        ...STATE_ORDER.map((s) => ({ value: s as Filter, label: STATE_META[s].label, count: counts[s] })),
                    ]}
                />
                <span className="ml-auto text-[11px] text-slate-400">
                    显示 {list.length} / {rows.length} 条
                </span>
            </Card>

            {loading ? (
                <Card className="p-5">
                    <Skeleton rows={6} />
                </Card>
            ) : list.length === 0 ? (
                <Card>
                    <EmptyState
                        icon="inbox"
                        title={rows.length === 0 ? '还没有收到询盘' : '这个筛选条件下没有记录'}
                        desc={
                            rows.length === 0
                                ? '前台联系页的表单提交后会出现在这里。若迟迟没有，先确认已部署带 /api/inquiry 的版本。'
                                : '换个关键词或切回「全部」看看。'
                        }
                    />
                </Card>
            ) : (
                <Card className="overflow-hidden p-0">
                    <ul className="divide-y divide-slate-100">
                        {list.map((r) => {
                            const isOpen = open === r.id;
                            const meta = STATE_META[r.state];
                            return (
                                <li key={r.id}>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setOpen(isOpen ? null : r.id);
                                            setDraftNote(r.note);
                                        }}
                                        className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-slate-50"
                                    >
                                        <Icon
                                            name={isOpen ? 'chevronDown' : 'chevronRight'}
                                            className="mt-1 h-4 w-4 shrink-0 text-slate-400"
                                        />
                                        <span className="min-w-0 flex-1">
                                            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                                <span className="truncate text-sm font-semibold text-slate-800">{r.name}</span>
                                                <span className="truncate font-mono text-[11px] text-slate-500">{r.email}</span>
                                                {r.country && <span className="text-[11px] text-slate-400">{r.country}</span>}
                                            </span>
                                            <span className={cx('mt-1 block text-[12px] text-slate-600', isOpen ? 'whitespace-pre-wrap' : 'truncate')}>
                                                {r.message}
                                            </span>
                                        </span>
                                        <span className="flex shrink-0 flex-col items-end gap-1.5">
                                            <Badge tone={meta.tone} icon={meta.icon}>
                                                {meta.label}
                                            </Badge>
                                            <span className="text-[11px] tabular-nums text-slate-400" title={r.created_at ? dateTime(r.created_at) : ''}>
                                                {r.created_at ? ago(r.created_at) : ''}
                                            </span>
                                        </span>
                                    </button>

                                    {isOpen && (
                                        <div className="space-y-4 bg-slate-50/70 px-4 pb-5 pt-1 sm:pl-11">
                                            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[12px] sm:grid-cols-4">
                                                <div>
                                                    <dt className="text-slate-400">电话 / WhatsApp</dt>
                                                    <dd className="mt-0.5 font-medium text-slate-700">{r.phone || '—'}</dd>
                                                </div>
                                                <div>
                                                    <dt className="text-slate-400">国家</dt>
                                                    <dd className="mt-0.5 font-medium text-slate-700">{r.country || '—'}</dd>
                                                </div>
                                                <div>
                                                    <dt className="text-slate-400">来源页</dt>
                                                    <dd className="mt-0.5 truncate font-mono text-[11px] text-slate-700" title={r.page}>
                                                        {r.page || '—'}
                                                    </dd>
                                                </div>
                                                <div>
                                                    <dt className="text-slate-400">收到时间</dt>
                                                    <dd className="mt-0.5 font-medium tabular-nums text-slate-700">{r.created_at ? dateTime(r.created_at) : '—'}</dd>
                                                </div>
                                            </dl>

                                            <div className="flex flex-wrap items-center gap-2">
                                                {STATE_ORDER.map((s) => (
                                                    <Button
                                                        key={s}
                                                        variant={r.state === s ? 'primary' : 'secondary'}
                                                        size="sm"
                                                        icon={STATE_META[s].icon}
                                                        onClick={() => void setState(r, s)}
                                                    >
                                                        {STATE_META[s].label}
                                                    </Button>
                                                ))}
                                                <span className="mx-1 h-5 w-px bg-slate-200" />
                                                <a href={replyUrl(r)}>
                                                    <Button variant="secondary" size="sm" icon="mail">
                                                        回复邮件
                                                    </Button>
                                                </a>
                                                <IconButton icon="copy" label="复制邮箱" onClick={() => void copyEmail(r)} />
                                                <IconButton icon="trash" label="删除这条询盘" onClick={() => setAskDel(r)} />
                                            </div>

                                            <div>
                                                <label htmlFor={`note-${r.id}`} className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                                    内部备注（不会发给客户）
                                                </label>
                                                <Textarea
                                                    id={`note-${r.id}`}
                                                    value={draftNote}
                                                    onChange={(e) => setDraftNote(e.target.value)}
                                                    rows={2}
                                                    placeholder="例如：已报价，等对方确认电压规格"
                                                />
                                                <div className="mt-2 flex items-center gap-2">
                                                    <Button size="sm" icon="check" disabled={draftNote === r.note} onClick={() => void saveNote(r)}>
                                                        保存备注
                                                    </Button>
                                                    {r.note && draftNote !== r.note && <span className="text-[11px] text-slate-400">有未保存改动</span>}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                </Card>
            )}

            <ConfirmDialog
                open={!!askDel}
                onClose={() => setAskDel(null)}
                onConfirm={() => askDel && void remove(askDel)}
                title="删除这条询盘？"
                desc={`来自 ${askDel?.name ?? ''}（${askDel?.email ?? ''}）的记录会被永久删除，备注一并丢失。若只是想归档，标成「已处理」或「垃圾」更合适。`}
                confirmLabel="删除"
            />
        </div>
    );
}
