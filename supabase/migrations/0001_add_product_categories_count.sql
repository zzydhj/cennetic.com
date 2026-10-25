-- 0001：对齐 product_categories 与 catalog.ts 的 ProductCategory（建表时漏了 count 列）
-- 在 Supabase SQL Editor 执行本文件；幂等，可重复运行。
alter table public.product_categories
  add column if not exists count int not null default 0;
