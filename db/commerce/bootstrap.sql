-- Review-only bootstrap for a NEW dedicated Supabase database.
-- Do not execute against an existing product database.
begin;
create table public.nomad_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 100),
  created_at timestamptz not null default now()
);
create table public.nomad_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  studio text not null check (studio in ('image','video','cinema','audio','marketing','lipsync')),
  created_at timestamptz not null default now(),
  unique (id,user_id)
);
create index nomad_projects_user_idx on public.nomad_projects(user_id);
create table public.nomad_wallets (
  user_id uuid primary key references auth.users(id) on delete restrict,
  available bigint not null default 0 check (available >= 0),
  updated_at timestamptz not null default now()
);
create table public.nomad_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.nomad_wallets(user_id) on delete restrict,
  operation_key text not null unique check (char_length(operation_key) between 1 and 255),
  kind text not null check (kind in ('purchase','reserve','release','refund','adjustment')),
  delta bigint not null check (delta <> 0 and delta between -1000000000 and 1000000000),
  balance_after bigint not null check (balance_after >= 0),
  created_at timestamptz not null default now(),
  check ((kind in ('purchase','release') and delta > 0) or
         (kind in ('reserve','refund') and delta < 0) or kind = 'adjustment')
);
create index nomad_ledger_user_idx on public.nomad_credit_ledger(user_id,created_at desc);
create table public.nomad_generation_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.nomad_wallets(user_id) on delete restrict,
  project_id uuid,
  request_key uuid not null,
  model_id text not null,
  reserved_credits bigint not null check (reserved_credits > 0),
  provider_job_id text unique,
  status text not null default 'reserved' check (status in ('reserved','submitted','succeeded','failed','review')),
  created_at timestamptz not null default now(),
  unique(user_id,request_key),
  foreign key(project_id,user_id) references public.nomad_projects(id,user_id)
);
create table public.nomad_payment_events (
  event_id text primary key,
  received_at timestamptz not null default now()
);
create table public.nomad_purchases (
  checkout_session_id text primary key,
  user_id uuid not null references public.nomad_wallets(user_id) on delete restrict,
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null check (currency = 'usd'),
  credits bigint not null check (credits > 0),
  created_at timestamptz not null default now()
);
alter table public.nomad_profiles enable row level security;
alter table public.nomad_projects enable row level security;
alter table public.nomad_wallets enable row level security;
alter table public.nomad_credit_ledger enable row level security;
alter table public.nomad_generation_jobs enable row level security;
alter table public.nomad_payment_events enable row level security;
alter table public.nomad_purchases enable row level security;
revoke all on public.nomad_profiles,public.nomad_projects,public.nomad_wallets,public.nomad_credit_ledger,public.nomad_generation_jobs,public.nomad_payment_events,public.nomad_purchases from public,anon,authenticated;
grant select,insert,update on public.nomad_profiles to authenticated;
grant select,insert on public.nomad_projects to authenticated;
grant update(title,studio) on public.nomad_projects to authenticated;
grant select on public.nomad_wallets,public.nomad_credit_ledger,public.nomad_generation_jobs,public.nomad_purchases to authenticated;
grant select,insert,update on public.nomad_profiles,public.nomad_projects,public.nomad_wallets,public.nomad_generation_jobs,public.nomad_payment_events,public.nomad_purchases to service_role;
grant select,insert on public.nomad_credit_ledger to service_role;
create policy profile_read on public.nomad_profiles for select to authenticated using ((select auth.uid())=user_id);
create policy profile_insert on public.nomad_profiles for insert to authenticated with check ((select auth.uid())=user_id);
create policy profile_update on public.nomad_profiles for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy project_read on public.nomad_projects for select to authenticated using ((select auth.uid())=user_id);
create policy project_insert on public.nomad_projects for insert to authenticated with check ((select auth.uid())=user_id);
create policy project_update on public.nomad_projects for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy wallet_read on public.nomad_wallets for select to authenticated using ((select auth.uid())=user_id);
create policy ledger_read on public.nomad_credit_ledger for select to authenticated using ((select auth.uid())=user_id);
create policy job_read on public.nomad_generation_jobs for select to authenticated using ((select auth.uid())=user_id);
create policy purchase_read on public.nomad_purchases for select to authenticated using ((select auth.uid())=user_id);
-- Trusted server only. Locks the wallet before checking idempotency or available funds.
create function public.nomad_apply_credit(p_user uuid,p_key text,p_kind text,p_delta bigint)
returns bigint language plpgsql security invoker set search_path = '' as $$
declare
  v_balance bigint;
  v_prior public.nomad_credit_ledger%rowtype;
begin
  if p_user is null or p_key is null or char_length(p_key) not between 1 and 255
    or p_delta is null or p_delta=0 or p_delta not between -1000000000 and 1000000000
    or p_kind is null or not ((p_kind in ('purchase','release') and p_delta>0)
      or (p_kind in ('reserve','refund') and p_delta<0) or p_kind='adjustment') then
    raise exception 'Invalid credit operation';
  end if;
  insert into public.nomad_wallets(user_id) values(p_user) on conflict(user_id) do nothing;
  select available into strict v_balance from public.nomad_wallets where user_id=p_user for update;
  select * into v_prior from public.nomad_credit_ledger where operation_key=p_key;
  if found then
    if v_prior.user_id<>p_user or v_prior.kind<>p_kind or v_prior.delta<>p_delta then
      raise exception 'Idempotency conflict';
    end if;
    return v_prior.balance_after;
  end if;
  if v_balance+p_delta<0 then raise exception 'Insufficient credits'; end if;
  v_balance:=v_balance+p_delta;
  update public.nomad_wallets set available=v_balance,updated_at=now() where user_id=p_user;
  insert into public.nomad_credit_ledger(user_id,operation_key,kind,delta,balance_after)
    values(p_user,p_key,p_kind,p_delta,v_balance);
  return v_balance;
end;
$$;
revoke all on function public.nomad_apply_credit(uuid,text,text,bigint) from public,anon,authenticated;
grant execute on function public.nomad_apply_credit(uuid,text,text,bigint) to service_role;
commit;
