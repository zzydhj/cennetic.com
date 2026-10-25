import type {
    ButtonHTMLAttributes,
    InputHTMLAttributes,
    LabelHTMLAttributes,
    ReactNode,
    SelectHTMLAttributes,
    TextareaHTMLAttributes,
} from 'react';

const cx = (...c: Array<string | false | undefined>): string => c.filter(Boolean).join(' ');

const variants = {
    primary: 'bg-brand text-white hover:bg-brand-dark',
    ghost: 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50',
    danger: 'bg-red-600 text-white hover:bg-red-700',
};

export function Button({
    variant = 'primary',
    className,
    ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof variants }) {
    return (
        <button
            className={cx(
                'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition disabled:opacity-50',
                variants[variant],
                className,
            )}
            {...rest}
        />
    );
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
    return (
        <input
            className={cx(
                'w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand',
                className,
            )}
            {...rest}
        />
    );
}

export function Textarea({
    className,
    mono,
    ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { mono?: boolean }) {
    return (
        <textarea
            className={cx(
                'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand',
                mono && 'font-mono text-xs',
                className,
            )}
            {...rest}
        />
    );
}

export function Select({ className, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
    return (
        <select
            className={cx(
                'w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand',
                className,
            )}
            {...rest}
        />
    );
}

export function Label({ className, ...rest }: LabelHTMLAttributes<HTMLLabelElement>) {
    return <label className={cx('mb-1 block text-sm font-medium text-slate-700', className)} {...rest} />;
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
    return <div className={cx('rounded-lg border border-slate-200 bg-white shadow-sm', className)}>{children}</div>;
}

export function Badge({ children, tone = 'slate' }: { children: ReactNode; tone?: 'slate' | 'green' | 'amber' }) {
    const tones = {
        slate: 'bg-slate-100 text-slate-600',
        green: 'bg-emerald-100 text-emerald-700',
        amber: 'bg-amber-100 text-amber-800',
    };
    return <span className={cx('inline-flex rounded px-2 py-0.5 text-xs font-medium', tones[tone])}>{children}</span>;
}
