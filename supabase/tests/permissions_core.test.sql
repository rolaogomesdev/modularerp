-- Tests: authorize() semantics + permission-table RLS (03-permissions.md)
-- Personas: sara (company-scope reader), tomas (team-scope, Team A),
--           vera (own-scope, Team B), otto (member of nothing)
begin;
create extension if not exists pgtap with schema extensions;

select plan(25);

-- ---------------------------------------------------------------------------
-- Fixtures (as postgres)
-- ---------------------------------------------------------------------------

insert into auth.users (id, email)
values
  ('00000000-0000-0000-0000-0000000000a3', 'sara@example.com'),
  ('00000000-0000-0000-0000-0000000000b3', 'tomas@example.com'),
  ('00000000-0000-0000-0000-0000000000c3', 'vera@example.com'),
  ('00000000-0000-0000-0000-0000000000d3', 'otto@example.com');

insert into public.companies (id, name, slug) values
  ('30000000-0000-0000-0000-000000000001', 'Fábrica Um', 'fabrica-um'),
  ('30000000-0000-0000-0000-000000000002', 'Outra Lda',  'outra');

insert into public.company_members (id, company_id, user_id, status, joined_at) values
  ('31000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a3', 'active', now()),
  ('31000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b3', 'active', now()),
  ('31000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c3', 'active', now());

insert into public.teams (id, company_id, name) values
  ('32000000-0000-0000-0000-00000000000a', '30000000-0000-0000-0000-000000000001', 'Team A'),
  ('32000000-0000-0000-0000-00000000000b', '30000000-0000-0000-0000-000000000001', 'Team B'),
  ('32000000-0000-0000-0000-00000000000c', '30000000-0000-0000-0000-000000000002', 'Team X');

-- throwaway catalog key for scope testing (rolled back with the transaction)
insert into public.permissions (key, module, resource, action, allowed_scopes, description)
values ('test.doc.read', 'test', 'doc', 'read', '{own,team,company}', 'test fixture');

insert into public.company_roles (id, company_id, name) values
  ('33000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Reader Company'),
  ('33000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', 'Reader Team'),
  ('33000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000001', 'Reader Own'),
  ('33000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000001', 'Managers');

insert into public.role_permissions (company_role_id, permission_key, scope) values
  ('33000000-0000-0000-0000-000000000001', 'test.doc.read', 'company'),
  ('33000000-0000-0000-0000-000000000002', 'test.doc.read', 'team'),
  ('33000000-0000-0000-0000-000000000003', 'test.doc.read', 'own');

insert into public.team_memberships (company_id, team_id, member_id, company_role_id, created_by) values
  -- sara: company scope, held in Team A
  ('30000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-00000000000a', '31000000-0000-0000-0000-000000000001', '33000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a3'),
  -- tomas: team scope in Team A
  ('30000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-00000000000a', '31000000-0000-0000-0000-000000000002', '33000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000a3'),
  -- vera: own scope in Team B
  ('30000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-00000000000b', '31000000-0000-0000-0000-000000000003', '33000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000000a3');

-- expired membership (tomas, company scope — must grant nothing)
insert into public.team_memberships (company_id, team_id, member_id, company_role_id, valid_from, valid_to, created_by) values
  ('30000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-00000000000b', '31000000-0000-0000-0000-000000000002', '33000000-0000-0000-0000-000000000001', now() - interval '10 days', now() - interval '1 day', '00000000-0000-0000-0000-0000000000a3');
-- future membership (vera, company scope — not yet valid)
insert into public.team_memberships (company_id, team_id, member_id, company_role_id, valid_from, created_by) values
  ('30000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-00000000000b', '31000000-0000-0000-0000-000000000003', '33000000-0000-0000-0000-000000000001', now() + interval '1 day', '00000000-0000-0000-0000-0000000000a3');

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

-- shorthand fixture ids
create temp table f as select
  '30000000-0000-0000-0000-000000000001'::uuid as company,
  '30000000-0000-0000-0000-000000000002'::uuid as other_company,
  '32000000-0000-0000-0000-00000000000a'::uuid as team_a,
  '32000000-0000-0000-0000-00000000000b'::uuid as team_b,
  '00000000-0000-0000-0000-0000000000a3'::uuid as sara,
  '00000000-0000-0000-0000-0000000000c3'::uuid as vera;
grant select on f to authenticated;

-- ---------------------------------------------------------------------------
-- authorize(): AAL gate, scopes, time bounds
-- ---------------------------------------------------------------------------

select test_login('00000000-0000-0000-0000-0000000000a3', 'aal1');
select is(
  (select public.authorize('test.doc.read', (select company from f))),
  false, 'aal1 session resolves nothing, even with a company-scope grant'
);
select test_logout();

select test_login('00000000-0000-0000-0000-0000000000a3', 'aal2');
select is(
  (select public.authorize('test.doc.read', (select company from f))),
  true, 'company scope: allowed with no team/owner context'
);
select is(
  (select public.authorize('test.doc.read', (select other_company from f))),
  false, 'wrong company: denied'
);
select is(
  (select public.authorize('nope.nope.nope', (select company from f))),
  false, 'unknown permission: denied'
);
select test_logout();

select test_login('00000000-0000-0000-0000-0000000000b3', 'aal2');
select is(
  (select public.authorize('test.doc.read', (select company from f), (select team_a from f))),
  true, 'team scope: allowed for a row in the holder''s team'
);
select is(
  (select public.authorize('test.doc.read', (select company from f), (select team_b from f))),
  false, 'team scope: denied for another team (and the expired company-scope membership grants nothing)'
);
select is(
  (select public.authorize('test.doc.read', (select company from f))),
  false, 'team scope: denied when the row has no team context'
);
select test_logout();

select test_login('00000000-0000-0000-0000-0000000000c3', 'aal2');
select is(
  (select public.authorize('test.doc.read', (select company from f), null, (select vera from f))),
  true, 'own scope: allowed when the row is about me'
);
select is(
  (select public.authorize('test.doc.read', (select company from f), null, (select sara from f))),
  false, 'own scope: denied for someone else''s row (and the future membership grants nothing yet)'
);
select test_logout();

-- suspension kills resolution instantly
update public.company_members set status = 'suspended'
where id = '31000000-0000-0000-0000-000000000001';
select test_login('00000000-0000-0000-0000-0000000000a3', 'aal2');
select is(
  (select public.authorize('test.doc.read', (select company from f))),
  false, 'suspended member: denied despite valid membership rows'
);
select test_logout();
update public.company_members set status = 'active'
where id = '31000000-0000-0000-0000-000000000001';

-- ---------------------------------------------------------------------------
-- catalog + org-structure visibility
-- ---------------------------------------------------------------------------

select test_login('00000000-0000-0000-0000-0000000000a3', 'aal2');
select cmp_ok(
  (select count(*) from public.permissions where module = 'platform'),
  '>=', 6::bigint,
  'catalog: platform permissions readable by authenticated users'
);
select is(
  (select count(*) from public.teams),
  2::bigint, 'member sees own company''s teams only'
);
select cmp_ok(
  (select count(*) from public.team_memberships),
  '>=', 3::bigint, 'member sees the company''s memberships'
);
select test_logout();

select test_login('00000000-0000-0000-0000-0000000000d3', 'aal2');
select is((select count(*) from public.teams), 0::bigint, 'non-member sees no teams');
select is((select count(*) from public.company_roles), 0::bigint, 'non-member sees no roles');
select is((select count(*) from public.team_memberships), 0::bigint, 'non-member sees no memberships');
select test_logout();

-- ---------------------------------------------------------------------------
-- write gates: teams need platform.team.manage
-- ---------------------------------------------------------------------------

select test_login('00000000-0000-0000-0000-0000000000a3', 'aal2');
select throws_ok(
  $$insert into public.teams (company_id, name) values ((select company from f), 'Team C')$$,
  '42501', null,
  'creating a team without platform.team.manage is denied'
);
select test_logout();

-- grant sara the Managers role with platform.team.manage
insert into public.role_permissions (company_role_id, permission_key, scope)
values ('33000000-0000-0000-0000-000000000004', 'platform.team.manage', 'company');
insert into public.team_memberships (company_id, team_id, member_id, company_role_id, created_by)
values ('30000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-00000000000a', '31000000-0000-0000-0000-000000000001', '33000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-0000000000a3');

select test_login('00000000-0000-0000-0000-0000000000a3', 'aal2');
select lives_ok(
  $$insert into public.teams (company_id, name) values ((select company from f), 'Team C')$$,
  'creating a team with platform.team.manage succeeds'
);
select test_logout();

-- ---------------------------------------------------------------------------
-- integrity triggers
-- ---------------------------------------------------------------------------

select throws_ok(
  $$insert into public.role_permissions (company_role_id, permission_key, scope)
    values ('33000000-0000-0000-0000-000000000004', 'platform.team.manage', 'own')$$,
  '23514', null,
  'scope outside the catalog''s allowed_scopes is rejected'
);
select throws_ok(
  $$insert into public.team_memberships (company_id, team_id, member_id, company_role_id, created_by)
    values ('30000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-00000000000c', '31000000-0000-0000-0000-000000000001', '33000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a3')$$,
  '23514', null,
  'membership pointing at another company''s team is rejected'
);

-- ---------------------------------------------------------------------------
-- authorize() consumed by RLS: companies.update
-- ---------------------------------------------------------------------------

select test_login('00000000-0000-0000-0000-0000000000c3', 'aal2');
select lives_ok(
  $$update public.companies set name = 'Hacked' where id = (select company from f)$$,
  'update without platform.company.update runs (RLS filters silently)'
);
select test_logout();
select is(
  (select name from public.companies where id = '30000000-0000-0000-0000-000000000001'),
  'Fábrica Um', 'company name untouched without the permission'
);

insert into public.role_permissions (company_role_id, permission_key, scope)
values ('33000000-0000-0000-0000-000000000004', 'platform.company.update', 'company');

select test_login('00000000-0000-0000-0000-0000000000a3', 'aal2');
select lives_ok(
  $$update public.companies set name = 'Fábrica Um, Lda' where id = (select company from f)$$,
  'update with platform.company.update runs'
);
select test_logout();
select is(
  (select name from public.companies where id = '30000000-0000-0000-0000-000000000001'),
  'Fábrica Um, Lda', 'company name updated by the permission holder'
);

-- non-members still see nothing of the company itself
select test_login('00000000-0000-0000-0000-0000000000d3', 'aal2');
select is(
  (select count(*) from public.companies where id = '30000000-0000-0000-0000-000000000001'),
  0::bigint, 'non-member cannot see the company at all'
);
select test_logout();

select * from finish();
rollback;
