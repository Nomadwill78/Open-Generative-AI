-- Isolated Sprint 3 database ONLY. Never apply to the customer/payment database.
-- Synthetic signup allowance. No Stripe purchase and no real provider access.
create or replace function public.nomad_seed_sandbox_wallet(p_user uuid)
returns bigint language plpgsql security invoker set search_path = '' as $$
declare
 v_balance bigint;
begin
 if p_user is null or not exists(select 1 from auth.users where id=p_user and email_confirmed_at is not null)
 then raise exception 'Verified sandbox user required'; end if;
 v_balance:=public.nomad_apply_credit(
   p_user,'mock:welcome:'||p_user::text,'adjustment',500
 );
 select available into strict v_balance from public.nomad_wallets where user_id=p_user;
 return v_balance;
end;
$$;
revoke all on function public.nomad_seed_sandbox_wallet(uuid) from public,anon,authenticated;
grant execute on function public.nomad_seed_sandbox_wallet(uuid) to service_role;