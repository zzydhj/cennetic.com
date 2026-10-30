/**
 * 登录页：左侧品牌板 + 右侧凭据卡。
 * 这是客户（和老板）看到的第一屏，按「产品门面」的规格做，而不是一个居中小方块。
 */
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { Icon } from '../components/Icon';
import { Badge, Button, Card, IconInput, Input, Label, Tooltip } from '../components/ui';

const FEATURES = [
    { icon: 'layers', title: '一处编辑，全站生效', desc: '文章 / 页面 / 设备 / 站点配置同一内容库' },
    { icon: 'shield', title: '发布前有回归闸', desc: '内容变更先过校验，不达标不上线' },
    { icon: 'image', title: '图片自动压 WebP', desc: '超大图上传即压缩，前台再按尺寸派生' },
] as const;

export default function Login() {
    const { signIn } = useAuth();
    const nav = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [show, setShow] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const submit = async (e: FormEvent): Promise<void> => {
        e.preventDefault();
        setBusy(true);
        setErr(null);
        const msg = await signIn(email, password);
        setBusy(false);
        if (msg) setErr(msg);
        else nav('/');
    };

    return (
        <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
            {/* 品牌板 */}
            <section className="relative hidden overflow-hidden bg-rail lg:flex lg:flex-col lg:justify-between">
                <div className="pointer-events-none absolute inset-0 bg-[length:32px_32px] bg-mesh opacity-40" />
                <div className="pointer-events-none absolute inset-0 bg-beam" />
                <div className="pointer-events-none absolute -left-24 top-1/3 h-80 w-80 rounded-full bg-brand-500/25 blur-3xl" />
                <div className="pointer-events-none absolute -right-10 bottom-0 h-64 w-64 rounded-full bg-gold-500/10 blur-3xl" />

                <div className="relative px-12 pt-12">
                    <div className="flex items-center gap-3">
                        <span className="relative inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[linear-gradient(150deg,#5b83c2,#012760)] text-base font-bold tracking-tightest text-white shadow-glow ring-1 ring-inset ring-white/20">
                            CN
                            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-gold-500 ring-2 ring-ink-950" />
                        </span>
                        <span className="leading-none">
                            <span className="block text-lg font-bold tracking-tightest text-white">CENNETIC</span>
                            <span className="mt-1.5 block text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-300">
                                Content Center
                            </span>
                        </span>
                    </div>
                </div>

                <div className="relative px-12">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gold-300">企业版 · 内容中台</p>
                    <h1 className="mt-4 max-w-md text-[34px] font-bold leading-[1.15] tracking-tightest text-white text-balance">
                        把数控设备的
                        <br />
                        内容，管成一套系统
                    </h1>
                    <p className="mt-4 max-w-md text-[13px] leading-relaxed text-slate-400">
                        前台静态渲染 + 独立内容库 + 三段式发布流水线。编辑体验留给运营，性能与安全交给构建流程。
                    </p>
                    <ul className="mt-8 max-w-md space-y-4">
                        {FEATURES.map((f) => (
                            <li key={f.title} className="flex items-start gap-3">
                                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-brand-200 ring-1 ring-inset ring-white/10">
                                    <Icon name={f.icon} className="h-[18px] w-[18px]" />
                                </span>
                                <span className="min-w-0">
                                    <span className="block text-[13px] font-semibold text-slate-100">{f.title}</span>
                                    <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-500">{f.desc}</span>
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="relative flex items-center gap-4 px-12 pb-10 pt-10 text-[11px] text-slate-500">
                    <span className="flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        服务正常
                    </span>
                    <span className="ml-auto font-mono">v1.0</span>
                </div>
            </section>

            {/* 凭据卡 */}
            <section className="relative flex items-center justify-center px-5 py-10 sm:px-8">
                <div className="pointer-events-none absolute inset-0 bg-canvas opacity-60 lg:hidden" />
                <Card gradle className="relative w-full max-w-[26rem] p-7 shadow-pop animate-fade-up">
                    <div className="mb-6 flex items-start justify-between gap-3">
                        <div>
                            <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-500">
                                <Icon name="lock" className="h-3.5 w-3.5" />
                                安全登录
                            </p>
                            <h2 className="text-[22px] font-bold leading-tight tracking-tightest text-slate-900">内容后台</h2>
                            <p className="mt-1.5 text-[13px] text-slate-500">使用管理员邮箱与密码进入</p>
                        </div>
                        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[linear-gradient(150deg,#5b83c2,#012760)] text-sm font-bold tracking-tightest text-white shadow-glow ring-1 ring-inset ring-white/20 lg:hidden">
                            CN
                        </span>
                    </div>

                    <form onSubmit={submit} className="space-y-4">
                        <div>
                            <Label htmlFor="email">邮箱</Label>
                            <IconInput
                                id="email"
                                icon="mail"
                                type="email"
                                autoComplete="username"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="admin@cennetic.com"
                            />
                        </div>
                        <div>
                            <Label htmlFor="password" className="justify-between">
                                <span className="flex items-center gap-1">
                                    密码
                                    <Tooltip text="密码由后台账号体系独立托管，忘记密码请联系运维重置。">
                                        <span className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-slate-300 text-[10px] font-bold text-slate-400">
                                            ?
                                        </span>
                                    </Tooltip>
                                </span>
                            </Label>
                            <span className="relative block">
                                <Input
                                    id="password"
                                    type={show ? 'text' : 'password'}
                                    autoComplete="current-password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••••"
                                    className="pr-10 font-mono"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShow((s) => !s)}
                                    aria-label={show ? '隐藏密码' : '显示密码'}
                                    className="focus-ring absolute right-1.5 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                                >
                                    <Icon name={show ? 'eyeOff' : 'eye'} className="h-4 w-4" />
                                </button>
                            </span>
                        </div>

                        {err && (
                            <div className="flex items-start gap-2 rounded-lg bg-accent-soft px-3 py-2.5 text-xs font-medium text-accent ring-1 ring-inset ring-accent/20 animate-fade-up">
                                <Icon name="alert" className="mt-px h-4 w-4 shrink-0" />
                                <span className="min-w-0">{err}</span>
                            </div>
                        )}

                        <div className="flex items-center justify-between text-[11px]">
                            <span className="flex items-center gap-1.5 text-slate-400">
                                <Icon name="shield" className="h-3.5 w-3.5" />
                                会话有效期约 1 小时
                            </span>
                            <span className="text-slate-400">需要帮助？联系内容负责人</span>
                        </div>

                        <Button type="submit" size="lg" className="shine w-full justify-center" loading={busy} icon={busy ? undefined : 'logout'}>
                            {busy ? '正在验证…' : '进入后台'}
                        </Button>
                    </form>

                    <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
                        <Badge tone="slate" icon="globe">
                            {typeof window === 'undefined'
                                ? '—'
                                : window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
                                    ? '本地开发'
                                    : '生产环境'}
                        </Badge>
                        <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
                            <Icon name="factory" className="h-3.5 w-3.5" />
                            CENNETIC 内容中台
                        </span>
                    </div>
                </Card>
            </section>
        </div>
    );
}
