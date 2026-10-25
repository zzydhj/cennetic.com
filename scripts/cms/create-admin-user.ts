/**
 * 一次性：用 Secret key 通过 GoTrue 管理员 API 建后台登录账号（email_confirm=true，免验证邮件）。
 * 运行：npx tsx scripts/cms/create-admin-user.ts <email> <password>
 *   不带参数则默认邮箱 admin@cennetic.com + 随机强密码（打印一次，登录后应尽快改）。
 * 幂等：若邮箱已存在，打印已存在并退出 0（不报错）。
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';

const ROOT = process.cwd();
(function loadEnv() {
    const p = join(ROOT, '.env');
    if (!existsSync(p)) throw new Error('缺少 .env');
    for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
        if (m) process.env[m[1]!] ??= m[2]!.trim();
    }
})();

const URL_BASE = process.env.SUPABASE_URL!;
const SECRET = process.env.SUPABASE_SECRET_KEY!;
if (!URL_BASE || !SECRET) throw new Error('SUPABASE_URL / SUPABASE_SECRET_KEY 未设置');

const email = process.argv[2] ?? 'admin@cennetic.com';
const password = process.argv[3] ?? randomBytes(12).toString('base64url');

async function main() {
    const res = await fetch(`${URL_BASE}/auth/v1/admin/users`, {
        method: 'POST',
        headers: {
            apikey: SECRET,
            Authorization: `Bearer ${SECRET}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, email_confirm: true, role: 'authenticated' }),
    });
    const text = await res.text();
    if (res.status === 422 && /already/i.test(text)) {
        console.log(`ℹ 用户 ${email} 已存在，跳过创建。`);
        return;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${text}`);
    const user = JSON.parse(text);
    console.log('✓ 后台账号已创建');
    console.log(`  email    : ${email}`);
    console.log(`  password : ${password}`);
    console.log(`  uid      : ${user.id}`);
    console.log('  ⚠ 请登录后尽快修改密码；此密码仅本次打印。');
}

main().catch((e) => {
    console.error('✗ 建号失败：', e instanceof Error ? e.message : e);
    process.exit(1);
});
