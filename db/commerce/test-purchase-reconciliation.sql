-- Only trusted server may call after Stripe signature and session verification.
create or replace function public.nomad_fulfill_test_purchase(p_event text,p_session text,p_user uuid,p_pack text,p_amount bigint,p_currency text)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare
  v_expected bigint;
  v_prior public.nomad_purchases%rowtype;
begin
  v_expected:=case p_pack when 'starter' then 2900 when 'professional' then 7900 when 'agency' then 19900 else null end;
  if p_user is null or (p_event is not null and p_event !~ '^evt_[A-Za-z0-9]+
    or p_session is null or p_session !~ '^cs_test_[A-Za-z0-9]+$'
    or char_length(p_event)>200 or char_length(p_session)>200
    or v_expected is null or p_amount is distinct from v_expected or p_currency is distinct from 'usd' then
    raise exception 'Invalid test purchase';
  end if;
  insert into public.nomad_wallets(user_id) values(p_user) on conflict(user_id) do nothing;
  perform 1 from public.nomad_wallets where user_id=p_user for update;
  -- Null event ID is reserved for trusted server-side Stripe session reconciliation.
  if p_event is not null then
    insert into public.nomad_payment_events(event_id) values(p_event) on conflict(event_id) do nothing;
    if not found then return false; end if;
  end if;
  select * into v_prior from public.nomad_purchases where checkout_session_id=p_session;
  if found then
    if v_prior.user_id<>p_user or v_prior.amount_cents<>p_amount or v_prior.currency<>p_currency or v_prior.credits<>v_expected then
      raise exception 'Purchase identity conflict';
    end if;
    return false;
  end if;
  insert into public.nomad_purchases(checkout_session_id,user_id,amount_cents,currency,credits)
    values(p_session,p_user,p_amount,p_currency,v_expected);
  perform public.nomad_apply_credit(p_user,'stripe:test:'||p_session,'purchase',v_expected);
  return true;
end;
$$;
revoke all on function public.nomad_fulfill_test_purchase(text,text,uuid,text,bigint,text) from public,anon,authenticated;
grant execute on function public.nomad_fulfill_test_purchase(text,text,uuid,text,bigint,text) to service_role;
)
    or p_session is null or p_session !~ '^cs_test_[A-Za-z0-9]+$'
    or char_length(p_event)>200 or char_length(p_session)>200
    or v_expected is null or p_amount is distinct from v_expected or p_currency is distinct from 'usd' then
    raise exception 'Invalid test purchase';
  end if;
  insert into public.nomad_wallets(user_id) values(p_user) on conflict(user_id) do nothing;
  perform 1 from public.nomad_wallets where user_id=p_user for update;
  insert into public.nomad_payment_events(event_id) values(p_event) on conflict(event_id) do nothing;
  if not found then return false; end if;
  select * into v_prior from public.nomad_purchases where checkout_session_id=p_session;
  if found then
    if v_prior.user_id<>p_user or v_prior.amount_cents<>p_amount or v_prior.currency<>p_currency or v_prior.credits<>v_expected then
      raise exception 'Purchase identity conflict';
    end if;
    return false;
  end if;
  insert into public.nomad_purchases(checkout_session_id,user_id,amount_cents,currency,credits)
    values(p_session,p_user,p_amount,p_currency,v_expected);
  perform public.nomad_apply_credit(p_user,'stripe:test:'||p_session,'purchase',v_expected);
  return true;
end;
$$;
revoke all on function public.nomad_fulfill_test_purchase(text,text,uuid,text,bigint,text) from public,anon,authenticated;
grant execute on function public.nomad_fulfill_test_purchase(text,text,uuid,text,bigint,text) to service_role;
