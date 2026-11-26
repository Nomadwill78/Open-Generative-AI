-- Sprint 4 sandbox-only request guardrails. Does not connect any paid provider.
create schema if not exists nomad_ops;
revoke all on schema nomad_ops from public,anon,authenticated;
grant usage on schema nomad_ops to service_role;

create table nomad_ops.mock_rate_windows (
  user_id uuid not null references auth.users(id) on delete cascade,
  bucket text not null check (bucket in ('minute','hour','day')),
  bucket_start timestamptz not null,
  requests integer not null default 0 check(requests>=0),
  primary key(user_id,bucket,bucket_start)
);
create index mock_rate_windows_expiry_idx on nomad_ops.mock_rate_windows(bucket_start);
create table nomad_ops.mock_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  request_key uuid not null,
  kind text not null check(kind in ('rate_limited','concurrent_limited','capacity_limited',
                                  'insufficient_credits','provider_failed','database_rejected','request_error','stale_recovered')),
  created_at timestamptz not null default clock_timestamp(),
  unique(user_id,request_key,kind)
);
create index mock_events_recent_idx on nomad_ops.mock_events(user_id,kind,created_at desc);
create table nomad_ops.alerts (
  alert_key text primary key check(char_length(alert_key) between 1 and 255),
  category text not null check(category in ('rate_abuse','concurrency_abuse','capacity',
                        'failure_spike','stale_reservations','ledger_mismatch','database_errors')),
  severity text not null check(severity in ('warning','critical')),
  user_id uuid references auth.users(id) on delete set null,
  observed_count integer not null default 1 check(observed_count>=1),
  first_seen_at timestamptz not null default clock_timestamp(),
  last_seen_at timestamptz not null default clock_timestamp(),
  status text not null default 'open' check(status in ('open','acknowledged','resolved'))
);
create index mock_alerts_active_idx on nomad_ops.alerts(status,last_seen_at desc);
alter table nomad_ops.mock_rate_windows enable row level security;
alter table nomad_ops.mock_events enable row level security;
alter table nomad_ops.alerts enable row level security;
revoke all on all tables in schema nomad_ops from public,anon,authenticated;
grant select,insert,update,delete on nomad_ops.mock_rate_windows to service_role;
grant select,insert,delete on nomad_ops.mock_events to service_role;
grant select,insert,update on nomad_ops.alerts to service_role;
grant usage,select on all sequences in schema nomad_ops to service_role;

create or replace function nomad_ops.raise_alert(
 p_key text,p_category text,p_severity text,p_user uuid,p_count integer default 1
) returns boolean language plpgsql security invoker set search_path = '' as $$
declare v_inserted boolean;
begin
 insert into nomad_ops.alerts(alert_key,category,severity,user_id,observed_count)
 values(p_key,p_category,p_severity,p_user, greatest(p_count,1))
 on conflict(alert_key) do update
    set observed_count=greatest(nomad_ops.alerts.observed_count,excluded.observed_count),
        last_seen_at=clock_timestamp(),status='open'
 returning (xmax = 0) into v_inserted;
 if v_inserted then
   perform pg_catalog.pg_notify('nomad_mock_ops_alert',
    pg_catalog.json_build_object('key',p_key,'category',p_category,'severity',p_severity)::text);
 end if;
 return coalesce(v_inserted,false);
end;$$;
revoke all on function nomad_ops.raise_alert(text,text,text,uuid,integer) from public,anon,authenticated;
grant execute on function nomad_ops.raise_alert(text,text,text,uuid,integer) to service_role;

create or replace function public.nomad_mock_record_guardrail(p_user uuid,p_request uuid,p_kind text)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare v_count integer;v_inserted boolean;v_category text;
begin
 if p_user is null or p_request is null or p_kind not in (
 'rate_limited','concurrent_limited','capacity_limited','insufficient_credits',
 'provider_failed','database_rejected','request_error','stale_recovered') then
 raise exception 'Invalid mock monitoring event'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_user::text),5);
 insert into nomad_ops.mock_events(user_id,request_key,kind)
 values(p_user,p_request,p_kind)
 on conflict(user_id,request_key,kind) do nothing
 returning true into v_inserted;
 if not coalesce(v_inserted,false) then return false; end if;
 if p_kind in ('rate_limited','concurrent_limited','database_rejected','capacity_limited') then
 select count(*)::integer into v_count from nomad_ops.mock_events
 where user_id=p_user and kind=p_kind and created_at>clock_timestamp()-interval '10 minutes';
 if v_count>=3 then
   v_category:=case p_kind when 'rate_limited' then 'rate_abuse'
     when 'concurrent_limited' then 'concurrency_abuse'
     when 'capacity_limited' then 'capacity' else 'database_errors' end;
   perform nomad_ops.raise_alert(v_category||':'||p_user||':'||
      to_char(clock_timestamp() at time zone 'UTC','YYYYMMDDHH24'),
      v_category,case when p_kind='database_rejected' then 'critical' else 'warning' end,
      p_user,v_count);
 end if;
 end if;
 return true;
end;$$;
revoke all on function public.nomad_mock_record_guardrail(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.nomad_mock_record_guardrail(uuid,uuid,text) to service_role;

create or replace function public.nomad_reserve_mock_generation(
  p_user uuid, p_request uuid, p_model text, p_prompt_hash text, p_project uuid default null
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_cost bigint;
  v_wallet bigint;
  v_job public.nomad_generation_jobs%rowtype;
  v_minute timestamptz;
  v_hour timestamptz;
  v_day timestamptz;
begin
  if p_user is null or p_request is null
    or p_prompt_hash is null or p_prompt_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid generation request';
  end if;
  v_cost:=case p_model when 'mock-image-v1' then 25 when 'mock-video-v1' then 100 else null end;
  if v_cost is null then raise exception 'Only mock models are permitted'; end if;

  insert into public.nomad_wallets(user_id) values(p_user) on conflict(user_id) do nothing;
  select available into strict v_wallet from public.nomad_wallets where user_id=p_user for update;

  select * into v_job from public.nomad_generation_jobs
    where user_id=p_user and request_key=p_request for update;
  if found then
    if v_job.model_id is distinct from p_model
      or v_job.prompt_hash is distinct from p_prompt_hash
      or v_job.project_id is distinct from p_project
      or v_job.reserved_credits is distinct from v_cost then
      raise exception 'Idempotency conflict: request already used with different parameters';
    end if;
    return jsonb_build_object('id',v_job.id,'status',v_job.status,
      'credits',v_job.reserved_credits,'available',v_wallet,'output',v_job.output_json);
  end if;
  if p_project is not null and not exists(
    select 1 from public.nomad_projects where id=p_project and user_id=p_user
  ) then raise exception 'Project does not belong to customer'; end if;
  if v_wallet < v_cost then raise exception 'Insufficient credits'; end if;

  -- Every new reservation is serialized across users and within each wallet.
  -- Replay requests returned earlier do not consume another rate token.
  perform pg_catalog.pg_advisory_xact_lock(604,4);
  if (select count(*) from public.nomad_generation_jobs
      where user_id=p_user and status='reserved' and created_at>now()-interval '5 minutes') >= 2
  then raise exception 'Mock concurrent job limit exceeded'; end if;
  if (select count(*) from public.nomad_generation_jobs
      where status='reserved' and created_at>now()-interval '5 minutes') >= 20
  then raise exception 'Mock global capacity exceeded'; end if;

  v_minute:=date_trunc('minute',clock_timestamp());
  v_hour:=date_trunc('hour',clock_timestamp());
  v_day:=date_trunc('day',clock_timestamp() at time zone 'UTC') at time zone 'UTC';
  if coalesce((select requests from nomad_ops.mock_rate_windows
       where user_id=p_user and bucket='minute' and bucket_start=v_minute),0)>=5
  then raise exception 'Mock rate limit exceeded: minute'; end if;
  if coalesce((select requests from nomad_ops.mock_rate_windows
       where user_id=p_user and bucket='hour' and bucket_start=v_hour),0)>=30
  then raise exception 'Mock rate limit exceeded: hour'; end if;
  if coalesce((select requests from nomad_ops.mock_rate_windows
       where user_id=p_user and bucket='day' and bucket_start=v_day),0)>=100
  then raise exception 'Mock rate limit exceeded: day'; end if;

  insert into public.nomad_generation_jobs(user_id,project_id,request_key,model_id,prompt_hash,reserved_credits,status)
    values(p_user,p_project,p_request,p_model,p_prompt_hash,v_cost,'reserved')
    returning * into v_job;
  v_wallet:=public.nomad_apply_credit(p_user,'mock:reserve:'||v_job.id,'reserve',-v_cost);
  insert into nomad_ops.mock_rate_windows(user_id,bucket,bucket_start,requests)
    values (p_user,'minute',v_minute,1),(p_user,'hour',v_hour,1),(p_user,'day',v_day,1)
    on conflict(user_id,bucket,bucket_start)
    do update set requests=nomad_ops.mock_rate_windows.requests+1;
  return jsonb_build_object('id',v_job.id,'status','reserved','credits',v_cost,'available',v_wallet,'output',null);
end;
$$;

create or replace function public.nomad_mock_scan_alerts()
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_user record;v_new integer:=0;v_total integer;
begin
 for v_user in
 select w.user_id,w.available,
  (select coalesce(sum(l.delta),0) from public.nomad_credit_ledger l
   where l.user_id=w.user_id) as ledger_total,
  (select count(*) from public.nomad_generation_jobs j
   where j.user_id=w.user_id and j.status='failed'
   and j.completed_at>clock_timestamp()-interval '15 minutes')::integer as failures,
  (select count(*) from public.nomad_generation_jobs j
   where j.user_id=w.user_id and j.status='reserved'
   and j.created_at<clock_timestamp()-interval '7 minutes')::integer as stale_count
 from public.nomad_wallets w
 loop
  if v_user.available<>v_user.ledger_total then
   if nomad_ops.raise_alert('ledger_mismatch:'||v_user.user_id,
       'ledger_mismatch','critical',v_user.user_id,1) then v_new:=v_new+1;end if;
  end if;
  if v_user.failures>=3 then
   if nomad_ops.raise_alert('failure_spike:'||v_user.user_id||':'||
       to_char(clock_timestamp() at time zone 'UTC','YYYYMMDDHH24'),
       'failure_spike','warning',v_user.user_id,v_user.failures)
      then v_new:=v_new+1;end if;
  end if;
  if v_user.stale_count>=1 then
   if nomad_ops.raise_alert('stale_reservations:'||v_user.user_id||':'||
       to_char(clock_timestamp() at time zone 'UTC','YYYYMMDDHH24'),
       'stale_reservations','warning',v_user.user_id,v_user.stale_count)
      then v_new:=v_new+1;end if;
  end if;
 end loop;
 delete from nomad_ops.mock_rate_windows where bucket_start < clock_timestamp()-interval '3 days';
 delete from nomad_ops.mock_events where created_at < clock_timestamp()-interval '30 days';
 select count(*)::integer into v_total from nomad_ops.alerts where status='open';
 return jsonb_build_object('new_alerts',v_new,'open_alerts',v_total,'scanned_at',clock_timestamp());
end;$$;
revoke all on function public.nomad_mock_scan_alerts() from public,anon,authenticated;
grant execute on function public.nomad_mock_scan_alerts() to service_role;
