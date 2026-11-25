-- A separate, Stripe-signed webhook receiver for protected Nomad Creative Studio staging.
-- Signing secret is stored separately in encrypted Supabase Vault, never in source.
create schema if not exists nomad_private;
revoke all on schema nomad_private from public, anon, authenticated;
grant usage on schema nomad_private to service_role;

create or replace function nomad_private.fulfill_signed_test_event(p_payload text, p_signature text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_pair text;
  v_timestamp text;
  v_signature text;
  v_secret text;
  v_expected bytea;
  v_actual bytea;
  v_diff integer := 0;
  v_n integer;
  v_event jsonb;
  v_session jsonb;
  v_id text;
  v_event_id text;
  v_user_text text;
  v_pack text;
  v_amount_text text;
begin
  if p_payload is null or octet_length(p_payload)>256000 or octet_length(p_payload)<2
    or p_signature is null or length(p_signature)>8192 then
    raise exception 'Invalid webhook envelope';
  end if;

  foreach v_pair in array string_to_array(p_signature, ',') loop
    v_pair := btrim(v_pair);
    if left(v_pair,2)='t=' then
      if v_timestamp is not null then raise exception 'Multiple timestamps'; end if;
      v_timestamp := substr(v_pair,3);
    elsif left(v_pair,3)='v1=' then
      if v_signature is null and substr(v_pair,4) ~ '^[0-9a-fA-F]{64}$' then
        v_signature := lower(substr(v_pair,4));
      end if;
    end if;
  end loop;
  if v_timestamp is null or v_timestamp !~ '^[0-9]{1,12}$'
    or v_signature is null or abs(extract(epoch from now()) - v_timestamp::numeric)>300 then
    raise exception 'Missing or stale Stripe signature';
  end if;

  select decrypted_secret into strict v_secret
    from vault.decrypted_secrets where name='nomad_creative_test_stripe_webhook';
  v_expected := extensions.hmac(convert_to(v_timestamp||'.'||p_payload,'UTF8'),
                                  convert_to(v_secret,'UTF8'),'sha256');
  v_actual := decode(v_signature,'hex');
  for v_n in 0..31 loop
    v_diff := v_diff | (get_byte(v_expected,v_n) # get_byte(v_actual,v_n));
  end loop;
  if v_diff<>0 then raise exception 'Incorrect Stripe signature'; end if;

  v_event := p_payload::jsonb;
  if (v_event->>'livemode') is distinct from 'false' then
    raise exception 'Live events are prohibited';
  end if;
  if (v_event->>'type') not in ('checkout.session.completed','checkout.session.async_payment_succeeded')
    then return false; end if;
  v_event_id := v_event->>'id';
  v_session := v_event#>'{data,object}';
  v_id := v_session->>'id';
  v_user_text := v_session#>>'{metadata,user_id}';
  v_pack := v_session#>>'{metadata,pack_id}';
  v_amount_text := v_session->>'amount_total';
  if v_event_id is null or v_event_id !~ '^evt_[A-Za-z0-9]+$'
    or v_id is null or v_id !~ '^cs_test_[A-Za-z0-9]+$'
    or (v_session->>'livemode') is distinct from 'false'
    or (v_session->>'mode') is distinct from 'payment'
    or (v_session->>'status') is distinct from 'complete'
    or (v_session->>'payment_status') is distinct from 'paid'
    or (v_session#>>'{metadata,product}') is distinct from 'nomad-creative-studio'
    or v_user_text is null
    or v_user_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or (v_session->>'client_reference_id') is distinct from v_user_text
    or v_amount_text is null or v_amount_text !~ '^[0-9]{1,10}$'
    or v_pack is null then
    raise exception 'Invalid paid test checkout session';
  end if;
  return public.nomad_fulfill_test_purchase(
    v_event_id,v_id,v_user_text::uuid,v_pack,v_amount_text::bigint,v_session->>'currency'
  );
end;
$$;
revoke all on function nomad_private.fulfill_signed_test_event(text,text) from public,anon,authenticated;
grant execute on function nomad_private.fulfill_signed_test_event(text,text) to service_role;

-- PostgREST only exposes this invoker wrapper to the internal service role.
create or replace function public.nomad_accept_signed_test_webhook(p_payload text,p_signature text)
returns boolean language sql security invoker set search_path = '' as $$
select nomad_private.fulfill_signed_test_event(p_payload,p_signature);
$$;
revoke all on function public.nomad_accept_signed_test_webhook(text,text) from public,anon,authenticated;
grant execute on function public.nomad_accept_signed_test_webhook(text,text) to service_role;