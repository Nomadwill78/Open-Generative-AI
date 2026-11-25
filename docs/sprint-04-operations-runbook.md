# Sprint 4: Isolated sandbox operations and alert runbook

**Scope:** Supabase project `srybidmpvzgddjvcxugz` only. The customer Supabase project `raqcqstsqphemgldkwbv` and production routes are unchanged. No paid AI provider is enabled.

## Enforced admission controls

- **5 new reservations per UTC-minute bucket**, 30 per UTC hour, 100 per UTC day, per verified account.
- **2 concurrent reserved jobs per account** and **20 concurrent reserved mock jobs globally**. Older-than-five-minute reservations are recovered on the next customer's request, and older-than-seven-minute reservations are flagged by monitoring.
- Admission is enforced in the database, not browser JS, and serialized with Postgres transaction advisory locks and per-wallet row locks.
- Repeated identical request keys return the original job without consuming a new allowance or charging again. Identity conflicts are rejected.
- A rejected reservation does not insert a job, deduct credits or consume any rate token because the entire operation is transactional.
- The preview Edge Function converts rate, concurrency and capacity rejections into **HTTP 429** with `Retry-After: 60` and records a private monitoring event. The UI displays a specific rate-limit notice.

Buckets are **fixed UTC windows**, not moving-window tokens. A temporary burst may cross a window boundary. The limits prevent accidental cost amplification but do not replace a global USD cost cap or distributed queue for real suppliers.

## Operational monitoring

- `nomad_ops.mock_rate_windows`: private per-user rate admission counters.
- `nomad_ops.mock_events`: private idempotent records for limits, capacity, insufficient balance, simulated provider failure and database rejections.
- `nomad_ops.alerts`: durable alerts with severity, category, occurrence count, last-seen timestamp, and resolution state.
- `public.nomad_mock_scan_alerts()`: 5-minute cron monitoring, checks ledger conservation (`wallet.available = sum(ledger.delta)`), failed-job spikes and stale reservations; prunes old counters and events.
- `cron.job`: scheduled job named `nomad-mock-ops-scan`, `*/5 * * * *`.
- `pg_notify('nomad_mock_ops_alert', ...)`: immediate best-effort database notification to any connected listener. This is **not** an email or push notification by itself.
- ChatGPT automation `Nomad Studio Ops Alerts` (ID `6b076bf6d13481918c4f09a7192be140`) checks for new/worsening alerts **hourly**. It is an external read-only condition-watch task; its actual future delivery must be validated once triggered.

### Alert thresholds

| Alert | Trigger | Priority |
|---|---|---|
| `rate_abuse` | 3 rate-limit rejections for one account in 10 minutes | Warning |
| `concurrency_abuse` | 3 concurrency rejections in 10 minutes | Warning |
| `capacity` | 3 global capacity rejections for one account in 10 minutes | Warning |
| `database_errors` | 3 database RPC rejections for one account in 10 minutes | Critical |
| `failure_spike` | At least 3 failed mock jobs for one account in 15 minutes | Warning |
| `stale_reservations` | At least one job reserved more than 7 minutes | Warning |
| `ledger_mismatch` | Wallet balance differs from summed posted ledger deltas | Critical |

This is a sandbox operational policy, **not** a final SLA or production abuse defense.

## Read-only operator checks

Use the connected Supabase SQL tool **only** on the sandbox project ID:

```sql
select alert_key,category,severity,observed_count,first_seen_at,last_seen_at,status
from nomad_ops.alerts
where status='open'
order by case severity when 'critical' then 0 else 1 end, last_seen_at desc
limit 50;

select bucket, count(*) as account_windows, sum(requests) as admitted
from nomad_ops.mock_rate_windows
where bucket_start>=now()-interval '1 hour'
group by bucket order by bucket;

select status, count(*) as jobs
from public.nomad_generation_jobs
group by status order by status;

select count(*) as open_reservations
from public.nomad_generation_jobs
where status='reserved' and created_at>now()-interval '5 minutes';

select jobname,schedule,active from cron.job where jobname='nomad-mock-ops-scan';
select status,return_message,start_time,end_time from cron.job_run_details
where jobid=(select jobid from cron.job where jobname='nomad-mock-ops-scan')
order by start_time desc limit 10;
```

Do not expose these private schemas through the anonymous Data API or embed credentials in a client.

## Responding safely

1. **Critical ledger mismatch:** freeze all new reservation requests by disabling the sandbox flag. Inspect full ledger and job IDs, do not edit balances directly.
2. **Database errors:** confirm Supabase Auth, RPC privileges and migration state; examine Edge logs using request IDs, never print access tokens.
3. **Stale reservations:** reconcile job state, consider invoking the idempotent stale mock recovery RPC for the affected account after inspection.
4. **Failure spike:** inspect simulated-failure flags and provider telemetry; distinguish deliberately simulated failures from unplanned operational failures.
5. **Rate/concurrency alert:** verify request-key reuse, repeated submissions and browser-client behavior; investigate before raising caps.
6. Acknowledge or resolve alerts only after investigation. The monitoring job will not automatically send external email or SMS.

## Validation performed

- SQL rollback tests: sixth request rejected after five admissions; third reserved job rejected; rejected requests did not debit credits or use rate tokens.
- Genuine overlapping execution: four simultaneous requests on an isolated fixture account yielded exactly **two accepted** and **two concurrency-rejected**, wallet 450 from a 500 credit seed, and exactly two rate tokens; fixture was deleted.
- Private alerts: three rejected events created exactly one deduplicated warning; scan saw the open alert in a rolled-back SQL test.
- Cron installed and enabled using the existing free-tier database, with no paid external telemetry service.

## Release restrictions

Real-money provider integration additionally requires an owner-approved USD spending cap, provider-specific cost reservations, real model output validation, content safety, webhooks, queue timeouts, fraud controls, and escalation contacts. All mock charges are synthetic; they do not map directly to external supplier credits.
