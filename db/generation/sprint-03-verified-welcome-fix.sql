-- Sprint 3 isolated sandbox only. Correct the 403 caused by service_role
-- being unable to SELECT auth.users inside a SECURITY INVOKER credit seed.
-- This function remains callable only from the trusted server-side service_role.
create or replace function public.nomad_seed_sandbox_wallet(p_user uuid)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  v_balance bigint;
begin
  if p_user is null or not exists (
    select 1 from auth.users
    where id=p_user and email_confirmed_at is not null
      and coalesce(is_anonymous,false)=false
  ) then
    raise exception 'Verified sandbox user required';
  end if;
  perform public.nomad_apply_credit(
    p_user,'mock:welcome:'||p_user::text,'adjustment',500
  );
  select available into strict v_balance
    from public.nomad_wallets where user_id=p_user;
  return v_balance;
end;
$$;
revoke all on function public.nomad_seed_sandbox_wallet(uuid) from public,anon,authenticated;
grant execute on function public.nomad_seed_sandbox_wallet(uuid) to service_role;

-- Give confirmed sandbox accounts their synthetic allowance on verification.
-- No payment state, real supplier credit or other database is changed.
create or replace function public.nomad_welcome_on_email_confirmation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.email_confirmed_at is null then return new; end if;
  if TG_OP='INSERT' then
    perform public.nomad_seed_sandbox_wallet(new.id);
  elsif old.email_confirmed_at is null then
    perform public.nomad_seed_sandbox_wallet(new.id);
  end if;
  return new;
end;
$$;
revoke all on function public.nomad_welcome_on_email_confirmation() from public,anon,authenticated;
create or replace trigger nomad_sandbox_verified_welcome
after insert or update of email_confirmed_at on auth.users
for each row execute function public.nomad_welcome_on_email_confirmation();
