import { useEffect, useState } from 'react';
import { triggerPublish } from '../lib/publish';
import { precheckPublish } from '../lib/precheck';
import { fetchLatestChange, invalidateReadouts } from '../lib/readouts';
import { ago } from '../lib/format';
import { cx } from '../lib/cx';
import { Icon } from './Icon';
import { Button, Spinner } from './ui';
import { ConfirmDialog } from './Overlay';
import { useToast } from './Toast';

/** 本机记录「上一次由这个浏览器触发的发布」时间，用来点亮「改动待发布」 */
const LS_KEY = 'cennetic:lastPublish';

/**
 * 顶栏「发布上线」：把内容库里的改动推到线上。
 * 链路：本按钮 → /api/publish（服务端函数）→ 构建流水线（快照 + 回归闸 + 提交）→ 线上重建。
 * 反馈一律走 Toast + 内联进度，不再用 window.confirm/alert。
 *
 * 不展示 runUrl：接口会返回流水线运行页地址（那是排障入口），但它是代码托管站的
 * 仓库链接，直接挂在后台 UI 上等于把仓库地址交给任何能看到屏幕的人（2026-10-30 按站主要求去掉）。
 * 要看进度请走服务端日志或让运维直接给链接。
 */
export function PublishButton({ drafts = 0 }: { drafts?: number }): JSX.Element {
    const toast = useToast();
    const [ask, setAsk] = useState(false);
    const [busy, setBusy] = useState(false);
    const [lastAt, setLastAt] = useState<string | null>(null);
    const [latest, setLatest] = useState<string | null>(null);

    useEffect(() => {
        setLastAt(window.localStorage.getItem(LS_KEY));
        void fetchLatestChange().then(setLatest);
    }, []);

    const dirty = !!latest && (!lastAt || latest > lastAt);

    async function go(): Promise<void> {
        setAsk(false);
        setBusy(true);

        /*
         * 发布是全站级的：快照逐行检查内容，一行不合格就整次中断，
         * 而“触发”本身会回成功——不先预检，运营只会看到「发布已触发」然后什么也没发生。
         */
        const bad = await precheckPublish();
        if (bad.length > 0) {
            setBusy(false);
            toast.push({
                tone: 'error',
                title: `有 ${bad.length} 处内容不合格，已拦下本次发布`,
                desc: bad.slice(0, 3).join('；') + (bad.length > 3 ? `；另有 ${bad.length - 3} 处，改完再发` : ''),
                duration: 16000,
            });
            return;
        }

        const r = await triggerPublish('admin');
        setBusy(false);
        if (r.ok) {
            const stamp = new Date().toISOString();
            window.localStorage.setItem(LS_KEY, stamp);
            setLastAt(stamp);
            invalidateReadouts();
            void fetchLatestChange().then(setLatest);
            toast.push({
                tone: 'success',
                title: '发布已触发',
                desc: '约 2–4 分钟后，客户就能看到新内容',
                duration: 8000,
            });
        } else {
            toast.push({ tone: 'error', title: '发布触发失败', desc: r.error ?? '未知错误' });
        }
    }

    return (
        <div className="flex items-center gap-2.5">
            {/* 状态胶囊：未发布改动 / 已同步，两种语气 */}
            <span
                className={cx(
                    'hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset lg:inline-flex',
                    busy
                        ? 'bg-brand-50 text-brand-700 ring-brand-100'
                        : dirty
                            ? 'bg-amber-50 text-amber-700 ring-amber-100'
                            : 'bg-emerald-50 text-emerald-700 ring-emerald-100',
                )}
                title={dirty ? `最后一次改动：${ago(latest)}` : lastAt ? `上次发布触发于 ${ago(lastAt)}` : '内容与线上一致'}
            >
                <span className="relative flex h-1.5 w-1.5">
                    {(busy || dirty) && <span className="absolute inline-flex h-full w-full rounded-full bg-current opacity-60 animate-ping-soft" />}
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
                </span>
                {busy ? '正在发布' : dirty ? `内容改动待发布${drafts > 0 ? ` · ${drafts} 篇草稿` : ''}` : '内容与线上一致'}
            </span>

            <Button
                variant="primary"
                icon={busy ? undefined : 'rocket'}
                loading={busy}
                onClick={() => setAsk(true)}
                disabled={busy}
                title="后台改动只有发布后才会出现在前台"
                className={cx('shine', dirty && !busy && 'ring-2 ring-gold-300/70')}
            >
                {busy ? '发布中' : '发布上线'}
            </Button>

            <ConfirmDialog
                open={ask}
                onClose={() => setAsk(false)}
                onConfirm={() => void go()}
                title="确认发布上线？"
                desc="会把你在后台的改动更新到网站，全程约 2–4 分钟。"
                confirmLabel="开始发布"
                tone="primary"
            >
                <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-2.5 text-[11px] font-medium text-slate-600 ring-1 ring-inset ring-slate-100">
                    <span className="inline-flex items-center gap-1">
                        <Icon name="database" className="h-3.5 w-3.5 text-brand-500" />
                        收齐改动
                    </span>
                    <Icon name="chevronRight" className="h-3 w-3 text-slate-300" />
                    <span className="inline-flex items-center gap-1">
                        <Icon name="shield" className="h-3.5 w-3.5 text-brand-500" />
                        自动检查
                    </span>
                    <Icon name="chevronRight" className="h-3 w-3 text-slate-300" />
                    <span className="inline-flex items-center gap-1">
                        <Icon name="globe" className="h-3.5 w-3.5 text-brand-500" />
                        更新到网站
                    </span>
                </div>
                {drafts > 0 && (
                    <p className="mt-2.5 text-[11px] leading-relaxed text-amber-700">
                        当前有 {drafts} 篇草稿：它们会一并保存，但网站上只显示已发布的内容。
                    </p>
                )}
            </ConfirmDialog>
        </div>
    );
}

/** 供其它页面复用的「发布中」小指示 */
export function Publishing({ label = '正在发布' }: { label?: string }): JSX.Element {
    return (
        <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-medium text-brand-700 ring-1 ring-inset ring-brand-100">
            <Spinner className="h-3 w-3" />
            {label}
        </span>
    );
}
