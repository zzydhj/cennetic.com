-- ============================================================================
-- 0004 · 询盘表 inquiries（前台表单直接落到自己的库，不经第三方）
-- 原因：
--   联系页的询盘表单此前只有两条出口：唤起 WhatsApp、生成 mailto 草稿 —— 都依赖
--   访客自己的客户端动作，访客不点发送就等于没询盘，且没有任何留痕。
--   本表让「填了就送达」，数据全在自己库里，后台登录即可看到。
-- 权限设计（这是本迁移的重点，不是随手开的策略）：
--   · anon（前台访客）只有一条 for insert 策略，且 with check 里带真实约束：
--     长度上限、邮箱格式、state 必须是 'new'、note 必须为空。
--     → 拿得到公开的 anon key 也只能投递一条合规的新询盘，读不到任何历史行，
--       也不能把自己标记成已处理或写备注。绕过 Pages Function 直打 REST 同样被挡。
--   · authenticated（后台登录用户）全权，用于查看/改状态/写备注/删除。
--   · service_role 走 BYPASSRLS，快照脚本不受影响（本表不进快照，见下）。
-- 为什么不进快照：询盘是外部输入的业务数据，不是站点内容。写进 git 会让
--   「谁留了邮箱电话」这类个人信息永久留在仓库历史里。
-- 执行：Supabase SQL Editor 整份运行。可重复执行（if not exists + drop policy if exists）。
-- 顺序：先跑本 SQL，再部署带 /api/inquiry 的 Pages，否则前台提交 404。
-- ============================================================================

create table if not exists public.inquiries (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text not null,
  phone       text not null default '',
  country     text not null default '',
  message     text not null,
  -- 来源页与机型：产品页将来复用同一张表时靠这两列区分是谁家机器带来的询盘
  page        text not null default '',
  product     text not null default '',
  -- 处理状态：new=未读 / reading=跟进中 / done=已处理 / junk=垃圾（人工标记，不自动改）
  state       text not null default 'new' check (state in ('new','reading','done','junk')),
  note        text not null default '',
  created_at  timestamptz not null default now()
);

create index if not exists inquiries_created_idx on public.inquiries (created_at desc);
create index if not exists inquiries_state_idx   on public.inquiries (state);

alter table public.inquiries enable row level security;
alter table public.inquiries force row level security;   -- 连表属主也受策略约束

drop policy if exists "public_drop_only" on public.inquiries;
create policy "public_drop_only" on public.inquiries
  for insert to anon
  with check (
    state = 'new'
    and note = ''
    and char_length(trim(name)) between 1 and 120
    and char_length(trim(email)) between 3 and 254
    and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    and char_length(trim(message)) between 5 and 4000
    and char_length(phone)   <= 60
    and char_length(country) <= 80
    and char_length(page)    <= 300
    and char_length(product) <= 200
  );

drop policy if exists "authenticated_full_access" on public.inquiries;
create policy "authenticated_full_access" on public.inquiries
  for all to authenticated
  using (true) with check (true);
