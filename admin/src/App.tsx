import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import { NAV, RESOURCES, SITE_SECTIONS } from './lib/resources';
import { Spinner } from './components/ui';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ResourceList from './pages/ResourceList';
import ResourceEdit from './pages/ResourceEdit';
import MediaLibrary from './pages/MediaLibrary';
import Inquiries from './pages/Inquiries';
import { ToastProvider } from './components/Toast';

function Gate() {
    const { session, loading } = useAuth();
    if (loading)
        return (
            <div className="grid min-h-screen place-items-center">
                <div className="flex flex-col items-center gap-3">
                    <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(150deg,#5b83c2,#012760)] text-base font-bold tracking-tightest text-white shadow-glow">
                        CN
                    </span>
                    <span className="flex items-center gap-2 text-xs font-medium tracking-wide text-slate-400">
                        <Spinner className="h-3.5 w-3.5" />
                        正在校验会话…
                    </span>
                </div>
            </div>
        );
    if (!session) return <Navigate to="/login" replace />;
    return <Outlet />;
}

const SITE = RESOURCES.find((r) => r.singleton)!;

export default function App() {
    return (
        <ToastProvider>
            <AuthProvider>
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route element={<Gate />}>
                        <Route element={<Layout />}>
                            <Route index element={<Dashboard />} />
                            <Route path="media" element={<MediaLibrary />} />
                            {/* 询盘不是内容类型，不进通用 CRUD：没有新建、不参与发布 */}
                            <Route path="inquiries" element={<Inquiries />} />
                            {NAV.map((r) => (
                                <Route key={r.key} path={r.key} element={<ResourceList resource={r} />} />
                            ))}
                            {NAV.map((r) => (
                                <Route key={`${r.key}-new`} path={`${r.key}/new`} element={<ResourceEdit resource={r} />} />
                            ))}
                            {NAV.map((r) => (
                                <Route key={`${r.key}-edit`} path={`${r.key}/:id`} element={<ResourceEdit resource={r} />} />
                            ))}
                            {/* 站点设置拆成二级页：/site_settings/:section，同一行数据按分组编辑 */}
                            <Route path={SITE.key} element={<Navigate to={`/${SITE.key}/${SITE_SECTIONS[0]!.key}`} replace />} />
                            <Route path={`${SITE.key}/:section`} element={<ResourceEdit resource={SITE} />} />
                        </Route>
                    </Route>
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </AuthProvider>
        </ToastProvider>
    );
}
