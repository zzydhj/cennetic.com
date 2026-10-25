-- ============================================================================
-- 0002 · 日期与站点数据改存「原文」
-- 原因：
--   1) timestamptz 会把裸 ISO 串按会话时区解释。灌库在本地(+8)、快照可能在
--      GitHub Action/CF(UTC)，同一个瞬间会被渲染成不同日期字符串 → 与
--      frontmatter 里的 '2026-06-16T06:12:25' 逐字对不上，快照产出漂移。
--   2) jsonb 会重排对象键序（同长度键按字母排序），site.json 的键序/缩进也会丢。
--   改 text 原样存字符串，快照逐字回写，杜绝时区与键序两类漂移。
-- 执行：Supabase SQL Editor 整份运行；跑完需重跑 `npx tsx scripts/cms/seed-supabase.ts`。
-- ============================================================================

begin;

-- articles：索引建在 date 上，先删后建（跨类型改列型不能自动重建该索引）
drop index if exists public.articles_date_idx;

alter table public.articles
  alter column "date"    type text,
  alter column lastmod   type text,
  alter column modified  type text;

create index if not exists articles_date_idx on public.articles ("date" desc);

-- pages
alter table public.pages
  alter column "date"   type text,
  alter column lastmod  type text;

-- site_settings：存 site.json 原始文本（保键序、4 空格缩进与尾部换行）
alter table public.site_settings
  alter column data type text using data::text;

commit;

-- 说明：faq / images / categories / specs 仍留 jsonb（后台按 JSON 编辑更顺手），
-- 键序由 snapshot.ts 显式重建，不依赖 jsonb 的存储顺序。
