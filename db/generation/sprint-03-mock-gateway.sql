-- Sprint 3. Unapplied development migration: does NOT alter the existing staging database.
-- All monetary changes flow through the existing locked, idempotent credit ledger.
-- Mock prices are synthetic credits, not real model costs.
alter table public.nomad_generation_jobs
  add column if not exists prompt_hash text,
  add column if not exists output_json jsonb,
  add column if not exists completed_at timestamptz;
alter table public.nomad_generation_jobs
  add constraint nomad_mock_prompt_hash_format
  check (prompt_hash is null or prompt_hash ~ '^[a-f0-9]{64}$');
alter table public.nomad_generation_jobs
  add constraint nomad_mock_output_size
  check (output_json is null or octet_length(output_json::text)<=4096);

create or replace function public.nomad_reserve_mock_generation(
  p_user uuid, p_request uuid, p_model text, p_prompt_hash text, p_project uuid default null
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_cost bigint;
  v_wallet bigint;
  v_job public.nomad_generation_jobs%rowtype;
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

  insert into public.nomad_generation_jobs(user_id,project_id,request_key,model_id,prompt_hash,reserved_credits,status)
    values(p_user,p_project,p_request,p_model,p_prompt_hash,v_cost,'reserved')
    returning * into v_job;
  v_wallet:=public.nomad_apply_credit(p_user,'mock:reserve:'||v_job.id,'reserve',-v_cost);
  return jsonb_build_object('id',v_job.id,'status','reserved','credits',v_cost,'available',v_wallet,'output',null);
end;
$$;

create or replace function public.nomad_settle_mock_generation(
  p_user uuid, p_request uuid, p_succeeded boolean, p_output jsonb default null
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_job public.nomad_generation_jobs%rowtype;
  v_wallet bigint;
  v_kind text;
begin
  if p_user is null or p_request is null or p_succeeded is null then
    raise exception 'Invalid settlement';
  end if;
  select available into strict v_wallet from public.nomad_wallets where user_id=p_user for update;
  select * into strict v_job from public.nomad_generation_jobs
    where user_id=p_user and request_key=p_request for update;
  if v_job.model_id not in ('mock-image-v1','mock-video-v1') then
    raise exception 'Real providers cannot use mock settlement';
  end if;
  if v_job.status in ('succeeded','failed') then
    return jsonb_build_object('id',v_job.id,'status',v_job.status,
      'credits',v_job.reserved_credits,'available',v_wallet,'output',v_job.output_json);
  end if;
  if v_job.status <> 'reserved' then raise exception 'Invalid job state transition'; end if;

  if p_succeeded then
    v_kind:=case v_job.model_id when 'mock-image-v1' then 'mock-image' else 'mock-video' end;
    if p_output is null or jsonb_typeof(p_output) <> 'object'
      or p_output->>'kind' is distinct from v_kind
      or p_output->>'provider' is distinct from 'local-mock'
      or octet_length(p_output::text)>4096 then
      raise exception 'Invalid mock output';
    end if;
    update public.nomad_generation_jobs set status='succeeded',
      output_json=p_output,completed_at=now() where id=v_job.id;
    return jsonb_build_object('id',v_job.id,'status','succeeded',
      'credits',v_job.reserved_credits,'available',v_wallet,'output',p_output);
  end if;
  v_wallet:=public.nomad_apply_credit(p_user,'mock:release:'||v_job.id,'release',v_job.reserved_credits);
  update public.nomad_generation_jobs set status='failed',completed_at=now(),
    output_json=null where id=v_job.id;
  return jsonb_build_object('id',v_job.id,'status','failed',
    'credits',v_job.reserved_credits,'available',v_wallet,'output',null);
end;
$$;

-- Recover only stale mock reservations after five minutes, never real-provider jobs.
-- This is invoked on a subsequent mock request for that customer.
create or replace function public.nomad_recover_stale_mock_generations(p_user uuid)
returns integer language plpgsql security invoker set search_path = '' as $$
declare
  v_job public.nomad_generation_jobs%rowtype;
  v_count integer:=0;
begin
  if p_user is null then raise exception 'Invalid customer'; end if;
  perform 1 from public.nomad_wallets where user_id=p_user for update;
  for v_job in select * from public.nomad_generation_jobs
    where user_id=p_user and model_id in ('mock-image-v1','mock-video-v1')
      and status='reserved' and created_at < now()-interval '5 minutes'
    order by created_at,id for update loop
    perform public.nomad_apply_credit(p_user,'mock:release:'||v_job.id,'release',v_job.reserved_credits);
    update public.nomad_generation_jobs set status='failed',completed_at=now(),output_json=null
      where id=v_job.id;
    v_count:=v_count+1;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.nomad_reserve_mock_generation(uuid,uuid,text,text,uuid) from public,anon,authenticated;
revoke all on function public.nomad_settle_mock_generation(uuid,uuid,boolean,jsonb) from public,anon,authenticated;
revoke all on function public.nomad_recover_stale_mock_generations(uuid) from public,anon,authenticated;
grant execute on function public.nomad_reserve_mock_generation(uuid,uuid,text,text,uuid) to service_role;
grant execute on function public.nomad_settle_mock_generation(uuid,uuid,boolean,jsonb) to service_role;
grant execute on function public.nomad_recover_stale_mock_generations(uuid) to service_role;
