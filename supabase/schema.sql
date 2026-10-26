-- ============================================================================
-- Cennetic 内容后台：Supabase(Postgres) 唯一 DDL 来源
-- 形态②：Supabase 存内容 + R2 存媒体；前台 Pages 纯静态读 git 快照，不直连本库。
--
-- 设计约定（务必对齐，否则快照/后台会漂移）：
--   1) 字段名用 snake_case，语义与 src/content.config.ts、src/lib/catalog.ts 1:1；
--      snapshot.ts 负责把 snake_case 还原成 content 文件里的 camelCase frontmatter。
--   2) 正文 body 存原始 HTML（非 Markdown）：含大量表格与 qf-* 类名，富文本往返会丢结构。
--   3) RLS 全开，仅 authenticated 角色可读写；anon 无任何策略 = 前台/公网读不到库
--      （对外内容一律走 git 快照构建的静态站，库不是公开读源）。
--   4) 应用层在 Supabase SQL Editor 整份执行；后续增量放 supabase/migrations/。
-- ============================================================================

-- gen_random_uuid() 依赖 pgcrypto（Supabase 默认已启用，这里幂等兜底）
create extension if not exists pgcrypto with schema extensions;

-- ── 公共：自动维护 updated_at ──────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ============================================================================
-- 文章 articles
-- ============================================================================
create table if not exists public.articles (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique,
  title            text not null,                       -- <title>/og:title，不含站点后缀
  heading          text not null,                       -- 页面 H1
  description      text not null check (char_length(description) between 30 and 255),
  canonical        text,                                -- 留空由 snapshot 按 /slug/ 兜底
  -- 日期存原文（裸 ISO 串）：timestamptz 会因构建环境时区不同(CF=UTC vs 本地=+8)把日期渲染漂 8h，
  -- 故与 frontmatter 逐字对齐；排序/比较靠 ISO 字典序，足够。
  "date"           text not null,
  lastmod          text,
  modified         text,
  categories       text[] not null default '{}',        -- 指向 blog_categories.slug
  author           text,                                -- 指向 authors.slug
  hero             text,                                -- R2 绝对 URL 或站内路径
  hero_alt         text,
  hero_width       int,
  hero_height      int,
  robots           text not null default 'follow, index, max-snippet:-1, max-video-preview:-1, max-image-preview:large',
  word_count       int not null default 0,
  reading_minutes  int not null default 1 check (reading_minutes >= 1),
  faq              jsonb not null default '[]'::jsonb,  -- [{q,a}] → FAQPage 结构化数据
  body             text not null default '',            -- 原始 HTML
  source_id        int,                                 -- 迁移回溯，不参与渲染
  status           text not null default 'draft' check (status in ('draft','published')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ============================================================================
-- 固定页面 pages（正文同样为 HTML）
-- ============================================================================
create table if not exists public.pages (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique,
  title            text not null,
  heading          text not null,
  description      text not null default '',            -- 页面允许空摘要，故不加 30..255 约束
  canonical        text,
  robots           text not null default 'follow, index, max-snippet:-1, max-video-preview:-1, max-image-preview:large',
  "date"           text,
  lastmod          text,
  hero             text,
  menu_order       int not null default 0,
  is_listing       boolean not null default false,      -- 主体为列表的页（/blog/ /products/ 等）
  author           text,
  faq              jsonb not null default '[]'::jsonb,
  body             text not null default '',
  source_id        int,
  status           text not null default 'draft' check (status in ('draft','published')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ============================================================================
-- 产品 products（结构对齐 src/lib/catalog.ts 的 Product）
-- ============================================================================
create table if not exists public.products (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  name         text not null,
  canonical    text not null,
  summary      text not null default '',
  body         text not null default '',                -- 详情区 HTML（含内联 <style>）
  images       jsonb not null default '[]'::jsonb,      -- [{src,alt,width,height}]
  categories   jsonb not null default '[]'::jsonb,      -- [{slug,name,canonical}]
  specs        jsonb not null default '[]'::jsonb,      -- [{name,values[]}]
  faq          jsonb not null default '[]'::jsonb,      -- [{q,a}] → 问答区 + FAQPage 结构化数据（迁移 0003）
  status       text not null default 'draft' check (status in ('draft','published')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ============================================================================
-- 博客分类 blog_categories
-- ============================================================================
create table if not exists public.blog_categories (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  name         text not null,
  description  text not null default '',
  title        text,                                    -- 缺省由 "<name> - <site>" 生成
  robots       text not null default 'follow, index, max-snippet:-1, max-video-preview:-1, max-image-preview:large',
  count        int not null default 0                   -- 展示用；列表页按实际查询渲染
);

-- ============================================================================
-- 产品分类 product_categories（parent 可为上级 slug 或 '0'）
-- ============================================================================
create table if not exists public.product_categories (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  name         text not null,
  description  text not null default '',
  parent       text not null default '0',
  canonical    text not null,
  trail        text[] not null default '{}',            -- 祖先链，还原面包屑
  robots       text not null default 'follow, index, max-snippet:-1, max-video-preview:-1, max-image-preview:large',
  title        text not null default '',
  count        int not null default 0                   -- 分类下产品数（源站口径，快照原样回写）
);

-- ============================================================================
-- 作者 authors（对齐 src/data/authors.json）
-- ============================================================================
create table if not exists public.authors (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  name         text not null,
  role         text not null default '',
  bio          text not null default '',
  avatar       text not null default ''
);

-- ============================================================================
-- 站点设置 site_settings（单行，data 直接镜像 src/data/site.json 全字段）
-- ============================================================================
create table if not exists public.site_settings (
  id           boolean primary key default true check (id),   -- 强制单行
  data         text not null,                                 -- 存 site.json 原始文本(保键序/缩进/换行)，快照逐字回写
  updated_at   timestamptz not null default now()
);

-- ============================================================================
-- 媒体资产 media_assets（后台素材库复用；非必须但建议保留）
-- ============================================================================
create table if not exists public.media_assets (
  id           uuid primary key default gen_random_uuid(),
  key          text not null unique,                    -- R2 object key
  public_url   text not null,                           -- https://media.cennetic.com/...
  alt          text not null default '',
  width        int,
  height       int,
  bytes        bigint,
  mime         text,
  created_at   timestamptz not null default now()
);

-- ── 索引：贴合列表/筛选/发布的访问模式 ──────────────────────────────────────
create index if not exists articles_status_idx      on public.articles (status);
create index if not exists articles_date_idx        on public.articles ("date" desc);
create index if not exists articles_categories_idx  on public.articles using gin (categories);
create index if not exists pages_status_idx         on public.pages (status);
create index if not exists pages_menu_order_idx     on public.pages (menu_order);
create index if not exists products_status_idx      on public.products (status);
create index if not exists product_categories_parent_idx on public.product_categories (parent);
create index if not exists product_categories_trail_idx  on public.product_categories using gin (trail);

-- ── updated_at 触发器（仅对含该列的可变表）─────────────────────────────────
do $$
declare
  t text;
begin
  foreach t in array array['articles','pages','products','site_settings'] loop
    execute format(
      'drop trigger if exists set_updated_at on public.%I;
       create trigger set_updated_at before update on public.%I
         for each row execute function public.set_updated_at();', t, t);
  end loop;
end$$;

-- ============================================================================
-- 行级安全 RLS：全开；仅 authenticated 可全量读写，anon 无任何策略
--   → 前台/公网即使拿到 anon key 也读不到库内容（对外只读 git 快照构建的静态站）
-- ============================================================================
do $$
declare
  t text;
begin
  foreach t in array array[
    'articles','pages','products','blog_categories',
    'product_categories','authors','site_settings','media_assets'
  ] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('alter table public.%I force row level security;', t);  -- 连表属主也受策略约束
    execute format(
      'drop policy if exists "authenticated_full_access" on public.%I;
       create policy "authenticated_full_access" on public.%I
         for all to authenticated
         using (true) with check (true);', t, t);
  end loop;
end$$;

-- 表属主/服务密钥走 BYPASSRLS（Supabase 的 service_role 默认绕过 RLS），
-- 故 snapshot/seed 脚本用 service_role 能整表读写，前台 anon 被拒。
