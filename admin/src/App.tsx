import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import { NAV, RESOURCES } from './lib/resources';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ResourceList from './pages/ResourceList';
import ResourceEdit from './pages/ResourceEdit';

function Gate() {
    const { session, loading } = useAuth();
    if (loading) return <div className="grid h-screen place-items-center text-slate-400">加载中…</div>;
    if (!session) return <Navigate to="/login" replace />;
    return <Outlet />;
}

const SITE = RESOURCES.find((r) => r.singleton)!;

export default function App() {
    return (
        <AuthProvider>
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route element={<Gate />}>
                    <Route element={<Layout />}>
                        <Route index element={<Dashboard />} />
                        {NAV.map((r) => (
                            <Route key={r.key} path={r.key} element={<ResourceList resource={r} />} />
                        ))}
                        {NAV.map((r) => (
                            <Route key={`${r.key}-new`} path={`${r.key}/new`} element={<ResourceEdit resource={r} />} />
                        ))}
                        {NAV.map((r) => (
                            <Route key={`${r.key}-edit`} path={`${r.key}/:id`} element={<ResourceEdit resource={r} />} />
                        ))}
                        <Route path={SITE.key} element={<ResourceEdit resource={SITE} />} />
                    </Route>
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </AuthProvider>
    );
}
