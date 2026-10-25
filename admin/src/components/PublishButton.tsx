import { useState } from 'react';
import { triggerPublish } from '../lib/publish';
import { Button } from './ui';

interface Status {
    ok: boolean;
    text: string;
    url?: string;
}

/**
 * 顶栏「发布」：把 Supabase 里的改动推到线上。
 * 链路：本按钮 → /api/publish（Pages Function）→ GitHub Action（快照 + 回归闸 + 提交 main）→ Pages 重建。
 */
export function PublishButton() {
    const [busy, setBusy] = useState(false);
    const [status, setStatus] = useState<Status | null>(null);

    async function go(): Promise<void> {
        if (!confirm('发布会把后台内容快照进仓库并触发线上重建（约 2–4 分钟）。确定发布？')) return;
        setBusy(true);
        setStatus(null);
        const r = await triggerPublish('admin');
        setBusy(false);
        setStatus(r.ok ? { ok: true, text: '已触发，正在生成快照与重建', url: r.runUrl } : { ok: false, text: r.error ?? '发布触发失败' });
    }

    return (
        <div className="flex items-center gap-2">
            {status && (
                <span
                    className={`max-w-[22rem] truncate text-xs ${status.ok ? 'text-emerald-600' : 'text-red-600'}`}
                    title={status.text}
                >
                    {status.url ? (
                        <a className="hover:underline" href={status.url} target="_blank" rel="noreferrer">
                            {status.text}
                        </a>
                    ) : (
                        status.text
                    )}
                </span>
            )}
            <Button onClick={go} disabled={busy} title="后台改动只有发布后才会出现在前台">
                {busy ? '发布中…' : '发布上线'}
            </Button>
        </div>
    );
}
