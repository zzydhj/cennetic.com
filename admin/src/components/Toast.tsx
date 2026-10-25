/**
 * 轻提示（Toast）：取代 window.alert —— 原生弹窗是「廉价感」的头号来源。
 * 用法：外层包 <ToastProvider>，页面里 const toast = useToast(); toast.ok('已保存');
 */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { cx } from '../lib/cx';
import { Icon, type IconName } from './Icon';

export type ToastTone = 'success' | 'error' | 'info' | 'warn';

export interface ToastInput {
    title: string;
    desc?: string;
    tone?: ToastTone;
    /** 外链动作，例如「查看构建进度」 */
    action?: { label: string; href: string };
    /** 毫秒，默认 4200（error 为 6500） */
    duration?: number;
}

interface LiveToast extends Required<Pick<ToastInput, 'title' | 'tone' | 'duration'>> {
    id: number;
    desc?: string;
    action?: ToastInput['action'];
}

const Ctx = createContext<{ push: (t: ToastInput) => void }>(null!);

export function useToast(): {
    push: (t: ToastInput) => void;
    ok: (title: string, desc?: string) => void;
    fail: (title: string, desc?: string) => void;
    info: (title: string, desc?: string) => void;
} {
    const { push } = useContext(Ctx);
    return {
        push,
        ok: (title, desc) => push({ title, desc, tone: 'success' }),
        fail: (title, desc) => push({ title, desc, tone: 'error' }),
        info: (title, desc) => push({ title, desc, tone: 'info' }),
    };
}

const tones = {
    success: { chip: 'bg-emerald-50 text-emerald-600 ring-emerald-100', bar: 'bg-emerald-500', icon: 'checkCircle' },
    error: { chip: 'bg-accent-soft text-accent ring-accent/15', bar: 'bg-accent', icon: 'alert' },
    info: { chip: 'bg-brand-50 text-brand-600 ring-brand-100', bar: 'bg-brand-500', icon: 'sparkle' },
    warn: { chip: 'bg-amber-50 text-amber-600 ring-amber-100', bar: 'bg-amber-500', icon: 'clock' },
} as const;

export function ToastProvider({ children }: { children: ReactNode }): JSX.Element {
    const [items, setItems] = useState<LiveToast[]>([]);

    const push = useCallback((t: ToastInput): void => {
        const tone = t.tone ?? 'info';
        const id = Date.now() + Math.random();
        setItems((cur) => [
            ...cur.slice(-3),
            { id, title: t.title, desc: t.desc, tone, action: t.action, duration: t.duration ?? (tone === 'error' ? 6500 : 4200) },
        ]);
    }, []);

    const dismiss = (id: number): void => setItems((cur) => cur.filter((x) => x.id !== id));

    return (
        <Ctx.Provider value={{ push }}>
            {children}
            <div className="pointer-events-none fixed inset-y-0 right-0 z-[70] flex w-full max-w-sm flex-col justify-start gap-2.5 p-4 sm:p-6">
                {items.map((t) => (
                    <ToastRow key={t.id} toast={t} onDone={() => dismiss(t.id)} />
                ))}
            </div>
        </Ctx.Provider>
    );
}

function ToastRow({ toast, onDone }: { toast: LiveToast; onDone: () => void }): JSX.Element {
    const [left, setLeft] = useState(1);
    const tone = tones[toast.tone];

    useEffect(() => {
        const step = 60;
        const tick = window.setInterval(() => {
            setLeft((v) => {
                const next = v - step / toast.duration;
                if (next <= 0) {
                    window.clearInterval(tick);
                    onDone();
                    return 0;
                }
                return next;
            });
        }, step);
        return () => window.clearInterval(tick);
        // 计时只在挂载时启动一次，避免进度条被重绘打断
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="pointer-events-auto relative overflow-hidden rounded-xl border border-white/70 bg-white/95 p-3.5 pr-9 shadow-pop backdrop-blur animate-slide-in">
            <div className="flex items-start gap-3">
                <span className={cx('inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset', tone.chip)}>
                    <Icon name={tone.icon as IconName} className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold leading-snug tracking-tightest text-slate-800">{toast.title}</p>
                    {toast.desc && <p className="mt-0.5 text-xs leading-relaxed text-slate-500 clamp-2">{toast.desc}</p>}
                    {toast.action && (
                        <a
                            href={toast.action.href}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700 hover:underline"
                        >
                            {toast.action.label}
                            <Icon name="arrowUpRight" className="h-3.5 w-3.5" />
                        </a>
                    )}
                </div>
            </div>
            <button
                type="button"
                onClick={onDone}
                aria-label="关闭提示"
                className="focus-ring absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-300 transition-colors hover:bg-slate-100 hover:text-slate-500"
            >
                <Icon name="close" className="h-3.5 w-3.5" />
            </button>
            <div className={cx('absolute bottom-0 left-0 h-[3px] rounded-full opacity-70 transition-[width] duration-75 ease-linear', tone.bar)} style={{ width: `${left * 100}%` }} />
        </div>
    );
}
