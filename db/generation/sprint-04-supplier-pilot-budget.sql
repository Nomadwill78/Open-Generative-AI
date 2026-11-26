-- Development sandbox only (srybidmpvzgddjvcxugz).
-- $12 TOTAL ceiling recorded November 26, 2026. No spending approved.
-- This bookkeeping policy is a release gate, not yet a wired vendor billing workflow.
create table if not exists nomad_ops.supplier_pilot_budget (
  singleton boolean primary key default true check (singleton),
  total_cash_ceiling_cents integer not null default 1200 check (total_cash_ceiling_cents=1200),
  cash_outlay_cents integer not null default 0 check (cash_outlay_cents>=0),
  unpaid_supplier_liability_cents integer not null default 0 check (unpaid_supplier_liability_cents>=0),
  spending_authorized boolean not null default false,
  generation_enabled boolean not null default false,
  approved_at date not null default date '2026-11-26',
  updated_at timestamptz not null default now(),
  constraint nomad_pilot_cash_cap check (
    cash_outlay_cents + unpaid_supplier_liability_cents <= total_cash_ceiling_cents
  )
);
alter table nomad_ops.supplier_pilot_budget enable row level security;
revoke all on nomad_ops.supplier_pilot_budget from public,anon,authenticated;
grant select on nomad_ops.supplier_pilot_budget to service_role;
insert into nomad_ops.supplier_pilot_budget(singleton,total_cash_ceiling_cents,
  cash_outlay_cents,unpaid_supplier_liability_cents,spending_authorized,
  generation_enabled,approved_at)
values(true,1200,0,0,false,false,date '2026-11-26')
on conflict(singleton) do nothing;
-- Intentionally no public RPC, vendor credentials, auto top-ups or supplier requests.
