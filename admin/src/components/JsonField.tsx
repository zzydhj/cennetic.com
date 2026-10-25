/**
 * JSON 编辑器：等宽文本域 + 实时合法性读数 + 一键整理缩进。
 * 给 FAQ 这类「结构化但字段不固定」的数组用；站点配置(site.json)已改走 SiteConfigField 表单。
 * 保存前页面还会再 parse 一次做最终闸，所以这里只负责「别让人不知不觉改坏」。
 * 注意：「整理缩进」前后会逐字符比对数据等价，不等价就不写入。
 */
import { useMemo, useRef, useState } from 'react';
import { cx } from '../lib/cx';
import { num } from '../lib/format';
import { Icon } from './Icon';
import { Button, Textarea, Tooltip } from './ui';

export function JsonField({
    value,
    onChange,
    rows = 12,
    label,
}: {
    value: unknown;
    onChange: (v: string) => void;
    rows?: number;
    /** 用于读数文案：数组还是对象 */
    label?: string;
}): JSX.Element {
    const text = typeof value === 'string' ? value : JSON.stringify(value ?? [], null, 2);
    const [flash, setFlash] = useState<string | null>(null);
    const say = (msg: string): void => {
        setFlash(msg);
        window.setTimeout(() => setFlash(null), 2600);
    };

    const parsed = useMemo(() => {
        const trimmed = text.trim();
        if (!trimmed) return { ok: true as const, empty: true, size: 0 };
        try {
            const v = JSON.parse(trimmed) as unknown;
            const size = Array.isArray(v) ? v.length : typeof v === 'object' && v !== null ? Object.keys(v as object).length : 0;
            return { ok: true as const, empty: false, size, isArray: Array.isArray(v) };
        } catch (e) {
            return { ok: false as const, empty: false, size: 0, error: e instanceof Error ? e.message : 'JSON 解析失败' };
        }
    }, [text]);

    /* 打开时那一版就是参照物：只记一次，不随编辑漂格 */
    const initial = useRef<string | null>(null);
    if (initial.current === null && text.trim()) initial.current = text;

    /** 与打开时的版本比顶层键（数组比条数）：少键就是误删 */
    const diff = useMemo(() => {
        if (!initial.current || !parsed.ok || parsed.empty) return null;
        try {
            const a = JSON.parse(initial.current) as unknown;
            const b = JSON.parse(text) as unknown;
            if (!a || !b || Array.isArray(a) !== Array.isArray(b)) return { missing: [], added: [], note: '结构类型变了（对象↔数组）' };
            if (Array.isArray(a) && Array.isArray(b)) {
                return a.length === b.length ? null : { missing: [], added: [], note: `条目数 ${a.length} → ${b.length}` };
            }
            const ka = Object.keys(a as object);
            const kb = Object.keys(b as object);
            const missing = ka.filter((k) => !kb.includes(k));
            const added = kb.filter((k) => !ka.includes(k));
            return missing.length || added.length ? { missing, added } : null;
        } catch {
            return null;
        }
    }, [text, parsed]);

    /** 只重排空白：确认 parse 后的数据与原文逐字符等价才落笔 */
    function reindent(): void {
        try {
            const v = JSON.parse(text) as unknown;
            const out = JSON.stringify(v, null, 2);
            if (JSON.stringify(JSON.parse(out)) !== JSON.stringify(JSON.parse(text))) {
                say('没动：整理前后数据不等价（通常是键名重复），已保留你写的内容');
                return;
            }
            onChange(out);
            say('已整理缩进：只改了空格与换行，字段与值未变');
        } catch (e) {
            say(e instanceof Error ? e.message : '无法整理');
        }
    }

    const lines = text.split('\n').length;

    return (
        <div className="overflow-hidden rounded-lg border border-slate-200/90 bg-white shadow-inner transition-shadow focus-within:border-brand-300 focus-within:shadow-card">
            <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 bg-[linear-gradient(180deg,#fcfdff,#f5f7fb)] px-2 py-1.5">
                <span className="mr-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    <Icon name="braces" className="h-3.5 w-3.5" />
                    JSON
                </span>
                <span
                    className={cx(
                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset',
                        !parsed.ok
                            ? 'bg-accent-soft text-accent ring-accent/20'
                            : parsed.empty
                                ? 'bg-slate-100 text-slate-500 ring-slate-200'
                                : 'bg-emerald-50 text-emerald-700 ring-emerald-100',
                    )}
                >
                    <Icon name={parsed.ok ? 'checkCircle' : 'alert'} className="h-3 w-3" />
                    {!parsed.ok ? '语法错误' : parsed.empty ? '空值（按默认提交）' : `${label ?? (parsed.isArray ? '条目' : '键')} ${num(parsed.size)}`}
                </span>
                {!parsed.ok && parsed.ok === false && (
                    <span className="hidden truncate text-[10px] text-accent sm:block" title={parsed.error}>
                        {parsed.error}
                    </span>
                )}
                <span className="ml-auto flex items-center gap-1.5">
                    <span className="hidden text-[10px] tabular-nums text-slate-400 sm:block">
                        {num(lines)} 行 · {num(text.length)} 字符
                    </span>
                    <Tooltip text="只重排空格与换行。写入前会逐字符比对整理前后的数据，确认一个字段都没增删才会落笔，所以点它不会改坏内容。">
                        <Button size="sm" variant="secondary" icon="sparkle" onClick={reindent} disabled={!parsed.ok || !!parsed.empty}>
                            整理缩进
                        </Button>
                    </Tooltip>
                </span>
            </div>
            {flash && <p className="border-b border-slate-100 bg-brand-50/60 px-3 py-1.5 text-[11px] font-medium text-brand-700">{flash}</p>}
            {diff && (diff.missing.length > 0 || diff.added.length > 0 || diff.note) && (
                <p
                    className={cx(
                        'flex flex-wrap items-center gap-1.5 border-b px-3 py-1.5 text-[11px] font-medium',
                        diff.missing.length > 0 || diff.note ? 'bg-accent-soft/70 text-accent' : 'bg-brand-50/60 text-brand-700',
                    )}
                >
                    <Icon name="alert" className="h-3.5 w-3.5 shrink-0" />
                    {diff.missing.length > 0 && `与打开时相比少了字段：${diff.missing.join('、')}。少整块通常是误删了逗号或括号。`}
                    {diff.added.length > 0 && `${diff.missing.length > 0 ? '另外，' : ''}多了字段：${diff.added.join('、')}。`}
                    {diff.note && `与打开时相比：${diff.note}。`}
                </p>
            )}
            <Textarea
                mono
                rows={rows}
                value={text}
                onChange={(e) => onChange(e.target.value)}
                spellCheck={false}
                className={cx('resize-y rounded-none border-0 shadow-none focus:shadow-none', !parsed.ok && 'bg-accent-soft/40')}
            />
        </div>
    );
}
