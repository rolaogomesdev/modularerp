-- Phase 1 exit: the worked examples of 03-permissions.md as automated tests,
-- plus the phase's exit criteria (permission changes audited; delegation
-- auto-expires under a running clock).
--
-- Personas (00-overview.md): Marta (HR-Manager-analog, company scope incl.
-- sensitive), João (Supervisor, team scope, Team A), Rita (Employee, own
-- scope, Team A), Otto (Team B row owner). Module tables don't exist until
-- Phase 3, so the matrix runs on in-test tables built with the CANONICAL
-- policy pattern — the exact shape every module table must copy.
begin;
create extension if not exists pgtap with schema extensions;

select plan(19);

-- ---------------------------------------------------------------------------
-- Cast & company
-- ---------------------------------------------------------------------------

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a8', 'marta2@example.com'),
  ('00000000-0000-0000-0000-0000000000b8', 'joao2@example.com'),
  ('00000000-0000-0000-0000-0000000000c8', 'rita2@example.com'),
  ('00000000-0000-0000-0000-0000000000d8', 'otto2@example.com');

insert into public.companies (id, name, slug) values
  ('80000000-0000-0000-0000-000000000001', 'Metalurgica Exemplo', 'metalurgica');

insert into public.company_members (id, company_id, user_id, status, joined_at) values
  ('81000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a8', 'active', now()),
  ('81000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b8', 'active', now()),
  ('81000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c8', 'active', now()),
  ('81000000-0000-0000-0000-000000000004', '80000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000d8', 'active', now());

insert into public.teams (id, company_id, name) values
  ('82000000-0000-0000-0000-00000000000a', '80000000-0000-0000-0000-000000000001', 'Team A'),
  ('82000000-0000-0000-0000-00000000000b', '80000000-0000-0000-0000-000000000001', 'Team B');

-- analog catalog keys (rolled back with the transaction)
insert into public.permissions (key, module, resource, action, allowed_scopes, is_sensitive, description) values
  ('test.doc.read',    'test', 'doc',    'read', '{own,team,company}', false, 'absence-file analog'),
  ('test.salary.read', 'test', 'salary', 'read', '{own,team,company}', true,  'salary analog (split table)');

-- roles mirroring the 03 templates (HR-Manager-analog also carries the
-- platform grants needed to exercise delegation + grant auditing)
insert into public.company_roles (id, company_id, name) values
  ('83000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000001', 'HR Manager (analog)'),
  ('83000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000001', 'Supervisor (analog)'),
  ('83000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-000000000001', 'Employee (analog)');

insert into public.role_permissions (company_role_id, permission_key, scope) values
  ('83000000-0000-0000-0000-000000000001', 'test.doc.read',           'company'),
  ('83000000-0000-0000-0000-000000000001', 'test.salary.read',        'company'),
  ('83000000-0000-0000-0000-000000000001', 'platform.member.manage',  'company'),
  ('83000000-0000-0000-0000-000000000001', 'platform.role.manage',    'company'),
  ('83000000-0000-0000-0000-000000000002', 'test.doc.read',           'team'),
  ('83000000-0000-0000-0000-000000000003', 'test.salary.read',        'own');

insert into public.team_memberships (id, company_id, team_id, member_id, company_role_id, created_by) values
  ('84000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000001', '82000000-0000-0000-0000-00000000000a', '81000000-0000-0000-0000-000000000001', '83000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a8'),
  ('84000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000001', '82000000-0000-0000-0000-00000000000a', '81000000-0000-0000-0000-000000000002', '83000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000a8'),
  ('84000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-000000000001', '82000000-0000-0000-0000-00000000000a', '81000000-0000-0000-0000-000000000003', '83000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000000a8');

-- ---------------------------------------------------------------------------
-- In-test tenant tables in the CANONICAL RLS pattern (03-permissions.md)
-- ---------------------------------------------------------------------------

create table public.docs_test (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  team_id uuid,
  user_id uuid,
  title text not null
);
alter table public.docs_test enable row level security;
create policy docs_test_select on public.docs_test for select to authenticated
  using ((select public.authorize('test.doc.read', company_id, team_id, user_id)));
grant select on public.docs_test to authenticated;

create table public.salaries_test (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  team_id uuid,
  user_id uuid not null,
  amount numeric not null
);
alter table public.salaries_test enable row level security;
create policy salaries_test_select on public.salaries_test for select to authenticated
  using ((select public.authorize('test.salary.read', company_id, team_id, user_id)));
grant select on public.salaries_test to authenticated;

insert into public.docs_test (company_id, team_id, user_id, title) values
  ('80000000-0000-0000-0000-000000000001', '82000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c8', 'Baixa Rita'),
  ('80000000-0000-0000-0000-000000000001', '82000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000d8', 'Baixa Otto');

insert into public.salaries_test (company_id, team_id, user_id, amount) values
  ('80000000-0000-0000-0000-000000000001', '82000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c8', 1500),
  ('80000000-0000-0000-0000-000000000001', '82000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000d8', 2000);

create function test_login(user_id uuid, aal text)
returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', user_id, 'role', 'authenticated', 'aal', aal)::text, true);
end; $$;

create function test_logout()
returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', null, true);
end; $$;

-- ---------------------------------------------------------------------------
-- Example 1 — Marta (company scope) reads salaries in ANY team
-- ---------------------------------------------------------------------------
select test_login('00000000-0000-0000-0000-0000000000a8', 'aal2');
select is((select count(*) from public.salaries_test), 2::bigint,
  'EX1: Marta reads salaries across both teams (company scope)');
select is((select amount from public.salaries_test where user_id = '00000000-0000-0000-0000-0000000000c8'),
  1500::numeric, 'EX1: including Rita''s salary value');
select test_logout();

-- ---------------------------------------------------------------------------
-- Example 2 — João (Supervisor, team scope) sees Team A only; no salaries
-- ---------------------------------------------------------------------------
select test_login('00000000-0000-0000-0000-0000000000b8', 'aal2');
select is((select count(*) from public.docs_test), 1::bigint,
  'EX2: João sees exactly his team''s rows');
select is((select title from public.docs_test), 'Baixa Rita',
  'EX2: and it is the Team A row');
select is((select count(*) from public.docs_test where title = 'Baixa Otto'), 0::bigint,
  'EX2: a hand-crafted query for Team B dies in RLS');
select is((select count(*) from public.salaries_test), 0::bigint,
  'EX2: no salary permission -> the sensitive split table is invisible');
select test_logout();

-- ---------------------------------------------------------------------------
-- Example 3 — Rita reads her own payslip; her colleague''s is invisible
-- ---------------------------------------------------------------------------
select test_login('00000000-0000-0000-0000-0000000000c8', 'aal2');
select is((select count(*) from public.salaries_test), 1::bigint,
  'EX3: Rita sees exactly one salary row (own scope)');
select is((select amount from public.salaries_test), 1500::numeric,
  'EX3: and it is hers');
select is((select count(*) from public.salaries_test where user_id = '00000000-0000-0000-0000-0000000000d8'), 0::bigint,
  'EX3: the colleague''s payslip is invisible');
select test_logout();

-- ---------------------------------------------------------------------------
-- Example 4 — stolen 1-factor session: nothing readable
-- ---------------------------------------------------------------------------
select test_login('00000000-0000-0000-0000-0000000000a8', 'aal1');
select is((select count(*) from public.salaries_test), 0::bigint,
  'EX4: aal1 session reads zero salaries — even as the HR manager');
select is((select count(*) from public.docs_test), 0::bigint,
  'EX4: aal1 session reads zero docs');
select test_logout();

-- ---------------------------------------------------------------------------
-- Example 5 — the AI runs with João''s JWT: identical visibility, no more
-- (tools use the requesting user''s session — same claims, same RLS)
-- ---------------------------------------------------------------------------
select test_login('00000000-0000-0000-0000-0000000000b8', 'aal2');
select results_eq(
  $$select title from public.docs_test order by title$$,
  $$values ('Baixa Rita')$$,
  'EX5: assistant-as-João gets exactly João''s team-scoped result'
);
select is((select count(*) from public.docs_test where team_id = '82000000-0000-0000-0000-00000000000b'), 0::bigint,
  'EX5: asking the assistant about another team returns nothing');
select test_logout();

-- ---------------------------------------------------------------------------
-- Exit criterion — delegation auto-expires (running clock, no fixture reload)
-- ---------------------------------------------------------------------------
select test_login('00000000-0000-0000-0000-0000000000a8', 'aal2');
select lives_ok(
  $$insert into public.team_memberships (company_id, team_id, member_id, company_role_id, valid_to, delegated_from, created_by)
    values ('80000000-0000-0000-0000-000000000001', '82000000-0000-0000-0000-00000000000a',
            '81000000-0000-0000-0000-000000000002', '83000000-0000-0000-0000-000000000001',
            now() + interval '2 seconds', '81000000-0000-0000-0000-000000000001',
            '00000000-0000-0000-0000-0000000000a8')$$,
  'Marta delegates her HR role to João for 2 seconds'
);
select test_logout();

select test_login('00000000-0000-0000-0000-0000000000b8', 'aal2');
select is((select count(*) from public.salaries_test), 2::bigint,
  'delegation active: João temporarily sees company-wide salaries');
select test_logout();

-- clock-skew simulation: now() is frozen per transaction, so we move the
-- expiry boundary across the clock instead — nothing else changes.
update public.team_memberships
set valid_from = now() - interval '2 hours',
    valid_to   = now() - interval '1 second'
where delegated_from = '81000000-0000-0000-0000-000000000001';

select test_login('00000000-0000-0000-0000-0000000000b8', 'aal2');
select is((select count(*) from public.salaries_test), 0::bigint,
  'delegation expired: crossing valid_to alone revokes access — no revocation call needed');
select test_logout();

-- ---------------------------------------------------------------------------
-- Exit criterion — permission changes visible in the audit log (DB-level)
-- ---------------------------------------------------------------------------
select is(
  (select count(*) from public.audit_log
   where company_id = '80000000-0000-0000-0000-000000000001'
     and action = 'membership.insert'
     and actor_user_id = '00000000-0000-0000-0000-0000000000a8'),
  1::bigint,
  'the delegation landed in the audit log with Marta as actor'
);

select test_login('00000000-0000-0000-0000-0000000000a8', 'aal2');
select lives_ok(
  $$insert into public.role_permissions (company_role_id, permission_key, scope)
    values ('83000000-0000-0000-0000-000000000003', 'test.doc.read', 'own')$$,
  'Marta grants Employees own-scope doc reading'
);
select test_logout();

select is(
  (select count(*) from public.audit_log
   where company_id = '80000000-0000-0000-0000-000000000001'
     and action = 'role.grant_insert'
     and actor_user_id = '00000000-0000-0000-0000-0000000000a8'
     and after->>'permission_key' = 'test.doc.read'),
  1::bigint,
  'the grant landed in the audit log with before/after payloads'
);

select * from finish();
rollback;
