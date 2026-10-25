import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!url || !anonKey) {
    // 构建期缺这两项会让后台连不上库；宁可早失败也不要静默白屏
    throw new Error('缺少 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 环境变量');
}

export const supabase = createClient(url, anonKey);
