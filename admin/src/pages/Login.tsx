import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { Button, Card, Input, Label } from '../components/ui';

export default function Login() {
    const { signIn } = useAuth();
    const nav = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
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
        <div className="grid min-h-screen place-items-center p-6">
            <Card className="w-full max-w-sm p-6">
                <h1 className="mb-1 text-xl font-bold text-brand">Cennetic 后台</h1>
                <p className="mb-5 text-sm text-slate-500">请登录以管理内容</p>
                <form onSubmit={submit} className="space-y-3">
                    <div>
                        <Label>邮箱</Label>
                        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                    </div>
                    <div>
                        <Label>密码</Label>
                        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                    </div>
                    {err && <p className="text-sm text-red-600">{err}</p>}
                    <Button type="submit" className="w-full justify-center" disabled={busy}>
                        {busy ? '登录中…' : '登录'}
                    </Button>
                </form>
            </Card>
        </div>
    );
}
