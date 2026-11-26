-- Scheduled, local-only telemetry scan. Free Supabase Cron extension; no external HTTP, email, or paid APIs.
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;
select cron.schedule('nomad-mock-ops-scan','*/5 * * * *',
 'select public.nomad_mock_scan_alerts();');
