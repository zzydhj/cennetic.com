/**
 * 命令面板（⌘K / Ctrl+K）：全后台的「键盘入口」。
 * 面板本身不关心命令是什么，动作由 Layout 注入（导航 / 新建 / 发布 / 退出）。
 * 跟 Modal / Tooltip 一样挂到 body：fixed 不能依赖祖先节点（入场动画与 overflow 都会弄坏定位）。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cx } from '../lib/cx';
import { Icon, type IconName } from './Icon';
import { Kbd } from './ui';

export interface CommandAction {
    id: string;
    group: string;
    label: string;
    hint?: string;
    icon: IconName;
    run: () => void;
}

export function CommandPalette({
    open,
    onClose,
    actions,
}: {
    open: boolean;
    onClose: () => void;
    actions: CommandAction[];
}): JSX.Element | null {
    const [q, setQ] = useState('');
    const [cursor, setCursor] = useState(0);
    const input = useRef<HTMLInputElement>(null);

    const list = useMemo(() => {
        const s = q.trim().toLowerCase();
        if (!s) return actions;
        return actions.filter((a) => `${a.group}${a.label}${a.hint ?? ''}`.toLowerCase().includes(s));
    }, [q, actions]);

    const grouped = useMemo(() => {
        const out: Array<{ group: string; items: CommandAction[] }> = [];
        list.forEach((a) => {
            const bucket = out.find((g) => g.group === a.group);
            if (bucket) bucket.items.push(a);
            else out.push({ group: a.group, items: [a] });
        });
        return out;
    }, [list]);

    /* 打开时重置并聚焦；关闭时交还滚动 */
    useEffect(() => {
        if (!open) return;
        setQ('');
        setCursor(0);
        const t = window.setTimeout(() => input.current?.focus(), 30);
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            window.clearTimeout(t);
            document.body.style.overflow = prev;
        };
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent): void => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setCursor((c) => Math.min(c + 1, Math.max(list.length - 1, 0)));
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setCursor((c) => Math.max(c - 1, 0));
            }
            if (e.key === 'Enter') {
                e.preventDefault();
                const hit = list[cursor];
                if (hit) {
                    hit.run();
                    onClose();
                }
            }
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open, list, cursor, onClose]);

    if (!open) return null;

    let index = -1;

    return createPortal(
        <div className="fixed inset-0 z-[80] flex items-start justify-center p-4 pt-[10vh] sm:pt-[14vh]">
            <div className="fixed inset-0 bg-ink-950/50 backdrop-blur-[3px] animate-fade-in" onClick={onClose} aria-hidden="true" />
            <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-white/70 bg-white shadow-pop animate-pop-in">
                <div className="flex items-center gap-3 border-b border-slate-100 px-4">
                    <Icon name="search" className="h-4 w-4 shrink-0 text-slate-400" />
                    <input
                        ref={input}
                        value={q}
                        onChange={(e) => {
                            setQ(e.target.value);
                            setCursor(0);
                        }}
                        placeholder="跳转页面、新建内容、发布上线…"
                        className="h-14 w-full bg-transparent text-[15px] tracking-tight text-slate-800 outline-none placeholder:text-slate-400"
                        aria-label="命令搜索"
                    />
                    <Kbd>esc</Kbd>
                </div>

                <div className="max-h-[52vh] overflow-y-auto p-2">
                    {grouped.length === 0 && (
                        <p className="px-3 py-10 text-center text-sm text-slate-400">没有匹配的命令</p>
                    )}
                    {grouped.map((g) => (
                        <div key={g.group} className="mb-1">
                            <p className="px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">{g.group}</p>
                            {g.items.map((a) => {
                                index += 1;
                                const active = index === cursor;
                                const myIndex = index;
                                return (
                                    <button
                                        key={a.id}
                                        type="button"
                                        onMouseMove={() => setCursor(myIndex)}
                                        onClick={() => {
                                            a.run();
                                            onClose();
                                        }}
                                        className={cx(
                                            'flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left transition-colors duration-100',
                                            active ? 'bg-brand-50 text-brand-800' : 'text-slate-600 hover:bg-slate-50',
                                        )}
                                    >
                                        <span
                                            className={cx(
                                                'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset transition-colors',
                                                active ? 'bg-white text-brand-600 ring-brand-100 shadow-card' : 'bg-slate-50 text-slate-400 ring-slate-100',
                                            )}
                                        >
                                            <Icon name={a.icon} className="h-[15px] w-[15px]" />
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-[13px] font-medium">{a.label}</span>
                                            {a.hint && <span className="mt-0.5 block truncate text-[11px] text-slate-400">{a.hint}</span>}
                                        </span>
                                        {active && <Icon name="arrowUpRight" className="h-4 w-4 shrink-0 opacity-50" />}
                                    </button>
                                );
                            })}
                        </div>
                    ))}
                </div>

                <div className="flex items-center gap-4 border-t border-slate-100 bg-slate-50/70 px-4 py-2.5 text-[11px] text-slate-500">
                    <span className="flex items-center gap-1.5">
                        <Kbd>↑</Kbd>
                        <Kbd>↓</Kbd> 选择
                    </span>
                    <span className="flex items-center gap-1.5">
                        <Kbd>⏎</Kbd> 执行
                    </span>
                    <span className="ml-auto flex items-center gap-1.5 font-medium text-slate-400">
                        <Icon name="command" className="h-3.5 w-3.5" />
                        Cennetic Command
                    </span>
                </div>
            </div>
        </div>,
        document.body,
    );
}
