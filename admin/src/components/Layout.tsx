import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { NAV } from '../lib/resources';
import { useAuth } from '../lib/auth';
import { Button } from './ui';
import { PublishButton } from './PublishButton';

const linkCls = ({ isActive }: { isActive: boolean }): string =>
    `block rounded-md px-3 py-2 text-sm font-medium ${isActive ? 'bg-brand text-white' : 'text-slate-600 hover:bg-slate-100'
    }`;

export default function Layout() {
    const { session, signOut } = useAuth();
    const nav = useNavigate();

    const onLogout = async (): Promise<void> => {
        await signOut();
        nav('/login');
    };

    return (
        <div className="flex min-h-screen">
            <aside className="w-56 shrink-0 border-r border-slate-200 bg-white p-3">
                <div className="px-2 py-3 text-lg font-bold text-brand">Cennetic</div>
                <nav className="space-y-1">
                    <NavLink to="/" end className={linkCls}>
                        仪表盘
                    </NavLink>
                    {NAV.map((r) => (
                        <NavLink key={r.key} to={`/${r.key}`} className={linkCls}>
                            {r.label}
                        </NavLink>
                    ))}
                    <NavLink to="/media" className={linkCls}>
                        媒体
                    </NavLink>
                    <NavLink to="/site_settings" className={linkCls}>
                        站点设置
                    </NavLink>
                </nav>
            </aside>
            <div className="flex flex-1 flex-col">
                <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
                    <span className="text-sm text-slate-500">内容管理后台</span>
                    <div className="flex items-center gap-3">
                        <PublishButton />
                        <span className="text-sm text-slate-500">{session?.user.email}</span>
                        <Button variant="ghost" onClick={onLogout}>
                            退出
                        </Button>
                    </div>
                </header>
                <main className="flex-1 p-6">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
