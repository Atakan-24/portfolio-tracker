-- Historical visitor and chat logs are private owner data, not a public Data API.
-- Removes broad client access; retains every record and existing owner/service-role grants.
begin;
alter table public.portfolio_visits enable row level security;
alter table public.portfolio_qa_log enable row level security;
drop policy if exists "anon kann lesen" on public.portfolio_visits;
drop policy if exists "anon kann lesen" on public.portfolio_qa_log;
revoke all privileges on table public.portfolio_visits, public.portfolio_qa_log
  from public, anon, authenticated;
commit;
