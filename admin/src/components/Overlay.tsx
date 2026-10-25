/**
 * 浮层原语：下拉菜单（Dropdown）与模态框（Modal）。
 * 这两个是「全站唯一的一份」行为约定：点外部关闭、Esc 关闭、焦点环统一，
 * 页面里不再自己写 useState + absolute 的散装弹层。
 *
 * 定位约定：Modal 是 fixed，必须 portal 到 body。
 * 页面外层有入场动画（animate-fade-up），只要祖先带 transform，fixed 就会相对那个祖先定位，
 * 滚到哪儿弹层就跟到哪儿；同时 Card 的 overflow-hidden 也会裁。与 Tooltip 同一套做法。
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cx } from '../lib/cx';
import { Icon, type IconName } from './Icon';
import { IconButton, Spinner } from './ui';

/* ── 下拉菜单 ─────────────────────────────────────────────────────────── */

export function Dropdown({
    trigger,
    children,
    align = 'right',
    width = 'w-64',
    label,
}: {
    /** 触发器渲染函数，能拿到 close（点菜单项后自己关掉） */
    trigger: (open: boolean, toggle: () => void) => ReactNode;
    children: (close: () => void) => ReactNode;
    align?: 'left' | 'right';
    width?: string;
    /** 给屏幕阅读器用的名字 */
    label?: string;
}): JSX.Element {
    const [open, setOpen] = useState(false);
    const box = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent): void => {
            if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
        };
        const onKey = (e: KeyboardEvent): void => {
            if (e.key === 'Escape') setOpen(false);
        };
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDown);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    return (
        <div className="relative" ref={box}>
            {trigger(open, () => setOpen((o) => !o))}
            {open && (
                <div
                    role={label ? 'menu' : undefined}
                    aria-label={label}
                    className={cx(
                        'absolute z-50 mt-2 origin-top rounded-xl border border-slate-200/80 bg-white p-1.5 shadow-pop animate-pop-in',
                        width,
                        align === 'right' ? 'right-0' : 'left-0',
                    )}
                >
                    {children(() => setOpen(false))}
                </div>
            )}
        </div>
    );
}

/** 菜单项：图标 + 文本 + 右侧读数/快捷键，全后台菜单只用它 */
export function MenuItem({
    icon,
    children,
    hint,
    tone = 'default',
    onClick,
    disabled,
}: {
    icon?: IconName;
    children: ReactNode;
    hint?: ReactNode;
    tone?: 'default' | 'danger';
    onClick?: () => void;
    disabled?: boolean;
}): JSX.Element {
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={onClick}
            className={cx(
                'focus-ring flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-40',
                tone === 'danger' ? 'text-accent hover:bg-accent-soft' : 'text-slate-600 hover:bg-slate-50 hover:text-brand-700',
            )}
        >
            {icon && <Icon name={icon} className="h-4 w-4 shrink-0 opacity-70" />}
            <span className="min-w-0 flex-1 truncate">{children}</span>
            {hint && <span className="shrink-0 text-[11px] text-slate-400">{hint}</span>}
        </button>
    );
}

export function MenuLabel({ children }: { children: ReactNode }): JSX.Element {
    return (
        <p className="px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">{children}</p>
    );
}

/* ── 模态框 ───────────────────────────────────────────────────────────── */

export function Modal({
    open,
    onClose,
    title,
    desc,
    icon,
    children,
    footer,
    size = 'md',
}: {
    open: boolean;
    onClose: () => void;
    title: string;
    desc?: string;
    icon?: IconName;
    children: ReactNode;
    footer?: ReactNode;
    size?: 'sm' | 'md' | 'lg';
}): JSX.Element | null {
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent): void => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKey);
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = prev;
        };
    }, [open, onClose]);

    if (!open) return null;
    const sizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-3xl' };

    return createPortal(
        <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto p-4 sm:items-center sm:p-6">
            <div className="fixed inset-0 bg-ink-950/45 backdrop-blur-sm animate-fade-in" onClick={onClose} aria-hidden="true" />
            <div
                role="dialog"
                aria-modal="true"
                aria-label={title}
                className={cx(
                    'relative my-auto w-full rounded-2xl border border-white/60 bg-white shadow-pop animate-pop-in',
                    sizes[size],
                )}
            >
                <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4">
                    {icon && (
                        <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[linear-gradient(160deg,#eff4fb,#dbe6f5)] text-brand-600 shadow-inner ring-1 ring-inset ring-brand-100">
                            <Icon name={icon} className="h-[18px] w-[18px]" />
                        </span>
                    )}
                    <div className="min-w-0 flex-1">
                        <h3 className="text-[15px] font-bold tracking-tightest text-slate-900">{title}</h3>
                        {desc && <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{desc}</p>}
                    </div>
                    <IconButton icon="close" label="关闭" onClick={onClose} />
                </div>
                <div className="max-h-[min(70vh,44rem)] overflow-y-auto px-5 py-4">{children}</div>
                {footer && <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/70 px-5 py-3.5">{footer}</div>}
            </div>
        </div>,
        document.body,
    );
}

/** 二次确认：把 window.confirm 换成成体系的对话框 */
export function ConfirmDialog({
    open,
    title,
    desc,
    children,
    confirmLabel = '确定',
    tone = 'danger',
    busy,
    onConfirm,
    onClose,
}: {
    open: boolean;
    title: string;
    desc?: string;
    /** 正文补充（步骤说明、影响清单等） */
    children?: ReactNode;
    confirmLabel?: string;
    tone?: 'danger' | 'primary';
    busy?: boolean;
    onConfirm: () => void;
    onClose: () => void;
}): JSX.Element {
    return (
        <Modal open={open} onClose={onClose} title={title} icon="alert" size="sm">
            {desc && <p className="mt-1 text-[13px] leading-relaxed text-slate-600">{desc}</p>}
            {children}
            <div className="mt-4 flex justify-end gap-2">
                <button
                    type="button"
                    onClick={onClose}
                    className="focus-ring h-9 rounded-lg px-3.5 text-[13px] font-medium text-slate-600 transition-colors hover:bg-slate-100"
                >
                    取消
                </button>
                <button
                    type="button"
                    disabled={busy}
                    onClick={onConfirm}
                    className={cx(
                        'focus-ring inline-flex h-9 items-center gap-1.5 rounded-lg px-4 text-[13px] font-semibold text-white shadow-glow transition-all duration-200 ease-expo active:translate-y-px disabled:opacity-60',
                        tone === 'danger'
                            ? 'bg-gradient-to-b from-[#e0344f] to-accent hover:from-[#c8102e] hover:to-[#a30c24]'
                            : 'bg-gradient-to-b from-brand-500 to-brand-700 hover:from-brand-400',
                    )}
                >
                    {busy && <Spinner className="h-3.5 w-3.5" />}
                    {confirmLabel}
                </button>
            </div>
        </Modal>
    );
}
