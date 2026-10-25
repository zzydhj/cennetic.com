/**
 * 后台的组件原语：所有页面只组合这些，不各写一套样式。
 * 颜色/阴影/动效一律来自 tailwind.config 的 token（brand=藏青、gold=香槟金、accent=红、ink=墨、canvas=画布）。
 * 质感约定：卡片用四层阴影 shadow-card，悬浮 shadow-lift，弹层 shadow-pop；主按钮走渐变 + 内描边。
 */
import {
    forwardRef,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
    type ButtonHTMLAttributes,
    type InputHTMLAttributes,
    type LabelHTMLAttributes,
    type ReactNode,
    type SelectHTMLAttributes,
    type TextareaHTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';
import { cx } from '../lib/cx';
import { Icon, type IconName } from './Icon';

/* ── 按钮 ─────────────────────────────────────────────────────────────── */

const buttonVariants = {
    primary:
        'text-white bg-gradient-to-b from-brand-500 to-brand-700 shadow-glow ring-1 ring-inset ring-white/10 hover:from-brand-400 hover:to-brand-600',
    secondary:
        'bg-white/90 text-slate-700 shadow-card ring-1 ring-inset ring-slate-200 hover:bg-white hover:text-brand-700 hover:ring-brand-200',
    ghost: 'text-slate-500 hover:bg-slate-100/80 hover:text-slate-800',
    danger: 'bg-white text-accent shadow-card ring-1 ring-inset ring-accent/25 hover:bg-accent-soft',
    subtle: 'bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-100 hover:bg-brand-100',
    gold: 'text-white bg-gradient-to-b from-gold-500 to-gold-700 shadow-gold ring-1 ring-inset ring-white/15 hover:to-gold-600',
    dark: 'bg-ink-900 text-white shadow-pop ring-1 ring-inset ring-white/10 hover:bg-ink-800',
};

const buttonSizes = {
    sm: 'h-8 px-2.5 text-xs',
    md: 'h-9 px-3.5 text-[13px]',
    lg: 'h-11 px-5 text-sm',
};

export function Button({
    variant = 'primary',
    size = 'md',
    icon,
    iconRight,
    loading,
    className,
    children,
    ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: keyof typeof buttonVariants;
    size?: keyof typeof buttonSizes;
    icon?: IconName;
    iconRight?: IconName;
    loading?: boolean;
}) {
    return (
        <button
            className={cx(
                'focus-ring inline-flex select-none items-center justify-center gap-1.5 rounded-lg font-medium transition-all duration-200 ease-expo active:translate-y-px disabled:pointer-events-none disabled:opacity-50',
                buttonSizes[size],
                buttonVariants[variant],
                className,
            )}
            {...rest}
        >
            {loading ? <Spinner className="h-3.5 w-3.5" /> : icon && <Icon name={icon} className="h-4 w-4 shrink-0" />}
            {children}
            {iconRight && <Icon name={iconRight} className="h-4 w-4 shrink-0 opacity-70" />}
        </button>
    );
}

/** 表格里用的纯图标按钮（有 title 与 aria-label，不能只有图标） */
export function IconButton({
    icon,
    label,
    tone = 'slate',
    className,
    ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon: IconName; label: string; tone?: 'slate' | 'danger' | 'light' }) {
    const tones = {
        slate: 'text-slate-400 hover:bg-slate-100 hover:text-brand-700',
        danger: 'text-slate-400 hover:bg-accent-soft hover:text-accent',
        light: 'bg-white/10 text-slate-200 hover:bg-white/20 hover:text-white',
    };
    return (
        <button
            title={label}
            aria-label={label}
            className={cx(
                'focus-ring inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all duration-200 ease-expo disabled:pointer-events-none disabled:opacity-40',
                tones[tone],
                className,
            )}
            {...rest}
        >
            <Icon name={icon} />
        </button>
    );
}

/* ── 表单控件 ─────────────────────────────────────────────────────────── */

const control =
    'focus-ring w-full rounded-lg border border-slate-200/90 bg-white px-3 text-sm text-slate-800 shadow-inner transition-all duration-200 placeholder:text-slate-400 hover:border-slate-300 focus:border-brand-400 focus:shadow-card';

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
    return <input className={cx(control, 'h-[38px]', className)} {...rest} />;
}

/** 带左侧图标的搜索/密钥输入框：图标不参与点击，输入体验仍是原生 input */
export function IconInput({
    icon,
    className,
    inputClassName,
    ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> & { icon: IconName; className?: string; inputClassName?: string }) {
    return (
        <span className={cx('relative block', className)}>
            <Icon
                name={icon}
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            />
            <input className={cx(control, 'h-[38px] pl-9', inputClassName)} {...rest} />
        </span>
    );
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { mono?: boolean }>(
    function Textarea({ className, mono, ...rest }, ref) {
        return (
            <textarea
                ref={ref}
                className={cx(control, 'resize-y py-2 leading-relaxed', mono && 'font-mono text-xs leading-[1.7]', className)}
                {...rest}
            />
        );
    },
);

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
    return (
        <span className="relative block">
            <select
                className={cx(
                    control,
                    'h-[38px] cursor-pointer appearance-none pr-9',
                    'bg-[linear-gradient(180deg,#fff,#fbfcfe)]',
                    className,
                )}
                {...rest}
            >
                {children}
            </select>
            <Icon
                name="chevronDown"
                className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            />
        </span>
    );
}

export function Label({ className, ...rest }: LabelHTMLAttributes<HTMLLabelElement>) {
    return (
        <label
            className={cx(
                'mb-1.5 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500',
                className,
            )}
            {...rest}
        />
    );
}

/** 字段容器：标签 + 悬停说明 + 右侧计数/提示 + 控件 + 底部错误 */
export function Field({
    label,
    required,
    help,
    aside,
    error,
    children,
    className,
}: {
    label: string;
    required?: boolean;
    help?: string;
    aside?: ReactNode;
    error?: string | null;
    children: ReactNode;
    className?: string;
}) {
    return (
        <div className={cx('min-w-0', className)}>
            <Label>
                {label}
                {required && <span className="text-accent">*</span>}
                {help && <HelpDot text={help} />}
                {aside && <span className="ml-auto font-normal normal-case tracking-normal text-slate-400">{aside}</span>}
            </Label>
            {children}
            {error && (
                <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-accent">
                    <Icon name="alert" className="h-3.5 w-3.5" />
                    {error}
                </p>
            )}
        </div>
    );
}

/** 悬停气泡：把「这个框填什么」就地讲清楚，不用翻文档 */
export function HelpDot({ text }: { text: string }): JSX.Element {
    return (
        <Tooltip text={text}>
            <span
                className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-slate-300 text-[10px] font-bold text-slate-400 transition-colors hover:border-brand-400 hover:text-brand-600"
                aria-label={text}
            >
                ?
            </span>
        </Tooltip>
    );
}

/**
 * 通用悬停气泡。
 * 用视口坐标定位 + 挂到 body：卡片有 overflow-hidden、弹窗有 overflow-y-auto，
 * 只要用 absolute 就一定会被裁（尤其中线对齐时靠左边距的触发器会溢出屏幕）。
 *
 * 两个坑（踩过）：
 *  · 位置只能走 left/top，不能用 -translate-y-full 这种 transform 工具类：
 *    animate-pop-in 的 fill-mode 会把 transform 填成 none，把位移永久抹掉，气泡就会倒下来压住正文；
 *  · 默认往上贴（鼠标不挡说明），拿真实高度测过才发现上方放不下才翻到下方；
 *    缩放原点跟着方向走，看着像从触发器边上长出来，而不是从指尖中心扩散。
 */
export function Tooltip({ text, children, width = 264 }: { text: string; children: ReactNode; width?: number }): JSX.Element {
    const box = useRef<HTMLSpanElement>(null);
    const tip = useRef<HTMLSpanElement>(null);
    const [pos, setPos] = useState<{ left: number; top: number; place: 'top' | 'bottom' } | null>(null);

    const show = (): void => {
        const el = box.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        // 先按居中算，再夹到视口内（左右各留 12px）；纵向先给一个粗略值，下面同一帧内精修
        const left = Math.min(Math.max(12, r.left + r.width / 2 - width / 2), Math.max(12, window.innerWidth - width - 12));
        setPos({ left, top: r.top - 10, place: 'top' });
    };
    const hide = (): void => setPos(null);

    /* 按实测高度定位置：上边放得下就往上，放不下才往下（在绘制前完成，不会闪） */
    useLayoutEffect(() => {
        const el = tip.current;
        const boxEl = box.current;
        if (!pos || !el || !boxEl) return;
        const r = boxEl.getBoundingClientRect();
        const h = el.offsetHeight;
        const fitsTop = r.top - 10 - h >= 8;
        const fitsBottom = r.bottom + 10 + h <= window.innerHeight - 8;
        const place: 'top' | 'bottom' = fitsTop || !fitsBottom ? 'top' : 'bottom';
        const top = place === 'top' ? r.top - 10 - h : r.bottom + 10;
        if (top !== pos.top || place !== pos.place) setPos({ ...pos, top, place });
    }, [pos]);

    /* 页面滚动时坐标就失效了，直接收起（再悬停会重新算） */
    useEffect(() => {
        if (!pos) return;
        const onScroll = (): void => hide();
        window.addEventListener('scroll', onScroll, true);
        window.addEventListener('resize', onScroll);
        return () => {
            window.removeEventListener('scroll', onScroll, true);
            window.removeEventListener('resize', onScroll);
        };
    }, [pos]);

    return (
        <span
            ref={box}
            className="relative inline-flex"
            onMouseEnter={show}
            onMouseLeave={hide}
            onFocus={show}
            onBlur={hide}
            onPointerDown={(e) => e.stopPropagation()}
        >
            {children}
            {pos &&
                createPortal(
                    <span
                        ref={tip}
                        role="tooltip"
                        style={{ left: pos.left, top: pos.top, width }}
                        className={cx(
                            'pointer-events-none fixed z-[90] block rounded-lg bg-ink-900 px-3 py-2 text-[11px] font-normal leading-relaxed tracking-normal text-slate-100 shadow-pop animate-pop-in',
                            pos.place === 'top' ? 'origin-bottom' : 'origin-top',
                        )}
                    >
                        {text}
                    </span>,
                    document.body,
                )}
        </span>
    );
}

/* ── 容器 ─────────────────────────────────────────────────────────────── */

export function Card({
    children,
    className,
    hover,
    gradle,
    id,
}: {
    children: ReactNode;
    className?: string;
    /** 悬浮抬升，用于可点击的卡片 */
    hover?: boolean;
    /** 渐变描边（只给需要「称重」的卡片用，别滥） */
    gradle?: boolean;
    id?: string;
}) {
    return (
        <div
            id={id}
            className={cx(
                'rounded-xl border border-slate-200/70 bg-white shadow-card',
                gradle && 'edge-grad',
                hover && 'lift',
                className,
            )}
        >
            {children}
        </div>
    );
}

export function SectionCard({
    title,
    desc,
    actions,
    icon,
    tone = 'brand',
    children,
    className,
    bodyClassName,
    footer,
    id,
}: {
    id?: string;
    title: ReactNode;
    desc?: string;
    actions?: ReactNode;
    icon?: IconName;
    tone?: keyof typeof chipTones;
    children: ReactNode;
    className?: string;
    bodyClassName?: string;
    footer?: ReactNode;
}) {
    return (
        <Card id={id} className={cx('overflow-hidden', className)}>
            <div className="flex items-start gap-3 border-b border-slate-100 bg-[linear-gradient(180deg,#fcfdff,#f7f9fc)] px-5 py-4">
                {icon && (
                    <span className={cx('mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', chipTones[tone])}>
                        <Icon name={icon} />
                    </span>
                )}
                <div className="min-w-0">
                    <h3 className="text-[13px] font-semibold tracking-tightest text-slate-800">{title}</h3>
                    {desc && <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{desc}</p>}
                </div>
                {actions && <div className="ml-auto flex shrink-0 items-center gap-2">{actions}</div>}
            </div>
            <div className={cx('p-5', bodyClassName)}>{children}</div>
            {footer && <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-3">{footer}</div>}
        </Card>
    );
}

/** 页头：小 kicker + 大标题 + 说明 + 右侧动作，所有页面统一这套节奏 */
export function PageHeader({
    kicker,
    title,
    desc,
    actions,
    meta,
    className,
}: {
    kicker?: string;
    title: ReactNode;
    desc?: string;
    actions?: ReactNode;
    meta?: ReactNode;
    className?: string;
}) {
    return (
        <div className={cx('mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
            <div className="min-w-0">
                {kicker && (
                    <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-500">
                        <Icon name="sparkle" className="h-3.5 w-3.5" />
                        {kicker}
                    </p>
                )}
                <h2 className="truncate text-[22px] font-bold leading-tight tracking-tightest text-slate-900">{title}</h2>
                {desc && <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-slate-500">{desc}</p>}
                {meta && <div className="mt-2.5 flex flex-wrap items-center gap-2">{meta}</div>}
            </div>
            {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </div>
    );
}

export function Divider({ className }: { className?: string }): JSX.Element {
    return <div className={cx('hairline my-4', className)} />;
}

export function Kbd({ children }: { children: ReactNode }): JSX.Element {
    return <span className="kbd">{children}</span>;
}

const chipTones = {
    brand: 'bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-100',
    gold: 'bg-gold-soft text-gold-700 ring-1 ring-inset ring-gold-300/50',
    green: 'bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-100',
    amber: 'bg-amber-50 text-amber-600 ring-1 ring-inset ring-amber-100',
    red: 'bg-accent-soft text-accent ring-1 ring-inset ring-accent/15',
    slate: 'bg-slate-100 text-slate-500 ring-1 ring-inset ring-slate-200',
};

/* ── 状态与反馈 ───────────────────────────────────────────────────────── */

const badgeTones = {
    slate: 'bg-slate-100 text-slate-600 ring-slate-200',
    green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    amber: 'bg-amber-50 text-amber-700 ring-amber-200',
    red: 'bg-accent-soft text-accent ring-accent/20',
    blue: 'bg-brand-50 text-brand-700 ring-brand-200',
    gold: 'bg-gold-soft text-gold-700 ring-gold-300/60',
};

export function Badge({
    children,
    tone = 'slate',
    dot,
    icon,
    className,
}: {
    children: ReactNode;
    tone?: keyof typeof badgeTones;
    dot?: boolean;
    icon?: IconName;
    className?: string;
}) {
    return (
        <span
            className={cx(
                // whitespace-nowrap 不能省：表格里列宽被挤窄时文字会换行，rounded-full 会把胶囊撑成一个圆
                'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset',
                badgeTones[tone],
                className,
            )}
        >
            {dot && (
                <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-current opacity-60 animate-ping-soft" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
                </span>
            )}
            {icon && <Icon name={icon} className="h-3 w-3" />}
            {children}
        </span>
    );
}

/** 内容状态：draft/published 是全后台共用的一套语义 */
export function StatusBadge({ status }: { status?: string | null }): JSX.Element {
    return status === 'published' ? (
        <Badge tone="green" dot>
            已发布
        </Badge>
    ) : (
        <Badge tone="amber" dot>
            草稿
        </Badge>
    );
}

export function Spinner({ className = 'h-4 w-4' }: { className?: string }): JSX.Element {
    return (
        <svg className={cx('animate-spin text-current', className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
    );
}

/** 骨架屏：条数与每行高度可配，列表/表格占位用 */
export function Skeleton({ rows = 3, className }: { rows?: number; className?: string }): JSX.Element {
    return (
        <div className={cx('space-y-2.5', className)}>
            {Array.from({ length: rows }, (_, i) => (
                <div key={i} className="skeleton h-3.5" style={{ width: `${92 - i * 7}%` }} />
            ))}
        </div>
    );
}

export function EmptyState({
    icon = 'layers',
    title,
    desc,
    action,
}: {
    icon?: IconName;
    title: string;
    desc?: string;
    action?: ReactNode;
}): JSX.Element {
    return (
        <div className="flex flex-col items-center justify-center px-6 py-16 text-center animate-fade-in">
            <span className="relative mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[linear-gradient(160deg,#f4f7fb,#e9eef6)] text-slate-300 shadow-inner ring-1 ring-inset ring-slate-200">
                <Icon name={icon} className="h-6 w-6" />
            </span>
            <p className="text-sm font-semibold text-slate-700">{title}</p>
            {desc && <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-slate-500">{desc}</p>}
            {action && <div className="mt-5">{action}</div>}
        </div>
    );
}

/** 顶部横幅提示（保存成功/失败这类一次性反馈） */
export function Flash({
    tone = 'blue',
    title,
    children,
    action,
}: {
    tone?: 'blue' | 'red' | 'green' | 'gold';
    title?: string;
    children?: ReactNode;
    action?: ReactNode;
}): JSX.Element {
    const tones = {
        blue: 'bg-brand-50 text-brand-800 ring-brand-100',
        red: 'bg-accent-soft text-accent ring-accent/20',
        green: 'bg-emerald-50 text-emerald-800 ring-emerald-100',
        gold: 'bg-gold-soft text-gold-700 ring-gold-300/50',
    };
    const icons: Record<typeof tone, IconName> = {
        blue: 'clock',
        red: 'alert',
        green: 'checkCircle',
        gold: 'sparkle',
    };
    return (
        <div className={cx('flex items-center gap-2.5 rounded-lg px-3.5 py-2.5 text-xs font-medium ring-1 ring-inset animate-fade-up', tones[tone])}>
            <Icon name={icons[tone]} className="h-4 w-4 shrink-0" />
            <div className="min-w-0 flex-1">
                {title && <p className="font-semibold">{title}</p>}
                {children && <p className={cx(title && 'mt-0.5', 'opacity-90')}>{children}</p>}
            </div>
            {action}
        </div>
    );
}

/* ── 选择与切换 ───────────────────────────────────────────────────────── */

export function Switch({
    checked,
    onChange,
    label,
}: {
    checked: boolean;
    onChange: (v: boolean) => void;
    label?: string;
}): JSX.Element {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={label}
            onClick={() => onChange(!checked)}
            className={cx(
                'focus-ring relative inline-flex h-[22px] w-10 shrink-0 items-center rounded-full transition-colors duration-300 ease-expo',
                checked ? 'bg-gradient-to-r from-brand-500 to-brand-700 shadow-glow' : 'bg-slate-200',
            )}
        >
            <span
                className={cx(
                    'absolute left-0.5 inline-flex h-[18px] w-[18px] rounded-full bg-white shadow-pop transition-transform duration-300 ease-spring',
                    checked && 'translate-x-[18px]',
                )}
            />
        </button>
    );
}

/** 分段控制器：列表页的状态筛选、视图切换都用它 */
export function SegmentedControl<T extends string>({
    value,
    options,
    onChange,
    size = 'md',
}: {
    value: T;
    options: Array<{ value: T; label: string; icon?: IconName; count?: number }>;
    onChange: (v: T) => void;
    size?: 'sm' | 'md';
}): JSX.Element {
    return (
        <div className="inline-flex items-center gap-0.5 rounded-lg border border-slate-200/80 bg-slate-50/80 p-0.5 shadow-inner">
            {options.map((o) => {
                const active = o.value === value;
                return (
                    <button
                        key={o.value}
                        type="button"
                        onClick={() => onChange(o.value)}
                        className={cx(
                            'focus-ring inline-flex items-center gap-1.5 rounded-[7px] font-medium transition-all duration-200 ease-expo',
                            size === 'sm' ? 'h-7 px-2 text-[11px]' : 'h-8 px-3 text-xs',
                            active
                                ? 'bg-white text-brand-700 shadow-card ring-1 ring-inset ring-slate-200/80'
                                : 'text-slate-500 hover:text-slate-700',
                        )}
                    >
                        {o.icon && <Icon name={o.icon} className="h-3.5 w-3.5" />}
                        {o.label}
                        {o.count != null && (
                            <span className={cx('rounded-full px-1.5 text-[10px] tabular-nums', active ? 'bg-brand-50 text-brand-600' : 'bg-slate-200/70 text-slate-500')}>
                                {o.count}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}

export function Tabs({
    value,
    options,
    onChange,
}: {
    value: string;
    options: Array<{ value: string; label: string; icon?: IconName }>;
    onChange: (v: string) => void;
}): JSX.Element {
    return (
        <div className="flex items-center gap-1 border-b border-slate-200">
            {options.map((o) => {
                const active = o.value === value;
                return (
                    <button
                        key={o.value}
                        type="button"
                        onClick={() => onChange(o.value)}
                        className={cx(
                            'focus-ring relative -mb-px inline-flex items-center gap-1.5 px-3.5 py-2.5 text-[13px] font-medium transition-colors duration-200',
                            active ? 'text-brand-700' : 'text-slate-500 hover:text-slate-700',
                        )}
                    >
                        {o.icon && <Icon name={o.icon} className="h-4 w-4" />}
                        {o.label}
                        {active && (
                            <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-gradient-to-r from-brand-400 to-brand-700 animate-fade-in" />
                        )}
                    </button>
                );
            })}
        </div>
    );
}

/** 进度条：容量、完成率这类「还剩多少」的读数 */
export function ProgressBar({
    value,
    tone = 'brand',
    className,
}: {
    value: number;
    tone?: 'brand' | 'gold' | 'green' | 'red';
    className?: string;
}): JSX.Element {
    const tones = {
        brand: 'from-brand-400 to-brand-700',
        gold: 'from-gold-300 to-gold-600',
        green: 'from-emerald-300 to-emerald-600',
        red: 'from-accent/60 to-accent',
    };
    return (
        <div className={cx('h-1.5 w-full overflow-hidden rounded-full bg-slate-200/80 shadow-inner', className)}>
            <div
                className={cx('h-full origin-left rounded-full bg-gradient-to-r animate-grow-x', tones[tone])}
                style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
            />
        </div>
    );
}

/** 头像：无图则用首字母 + 品牌渐变，永远不出现破图 */
export function Avatar({ email, size = 'md' }: { email: string; size?: 'sm' | 'md' | 'lg' }): JSX.Element {
    const sizes = { sm: 'h-6 w-6 text-[10px]', md: 'h-8 w-8 text-[11px]', lg: 'h-11 w-11 text-sm' };
    return (
        <span
            className={cx(
                'inline-flex shrink-0 items-center justify-center rounded-full bg-[linear-gradient(150deg,#37619f,#012760)] font-bold uppercase tracking-tight text-white ring-1 ring-inset ring-white/25 shadow-glow',
                sizes[size],
            )}
        >
            {email ? (email.trim()[0] ?? 'C').toUpperCase() : 'CN'}
        </span>
    );
}
