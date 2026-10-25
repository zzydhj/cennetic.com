/**
 * CMS 脚本的进程配置：载入根目录 .env，并按需取必填变量。
 * 只依赖 node 内置模块，避免为两个脚本再引 dotenv。
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** 项目根（脚本一律从仓库根用 npx tsx 运行） */
export const ROOT = process.cwd();

/**
 * 载入 .env：已存在于进程环境的变量优先（便于 CI/GH Action 用 secrets 直接注入）。
 * 缺文件不报错——由 requireEnv 在真正缺值时给出明确提示。
 */
export function loadEnvFile(): void {
    const p = join(ROOT, '.env');
    if (!existsSync(p)) return;
    for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
        if (!m) continue;
        process.env[m[1]!] ??= m[2]!.trim();
    }
}

/** 取必填环境变量；缺失即 fail-loud，不留半跑状态 */
export function requireEnv(name: string): string {
    const v = process.env[name];
    if (!v) throw new Error(`缺少环境变量 ${name}（参考 .env.example）`);
    return v;
}
