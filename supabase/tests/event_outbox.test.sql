-- Tests: event outbox — publish path, actor stamping, name/actor validation,
-- audit-gated reads, no direct authenticated publish.
-- Personas: vic (holds platform.audit.read), wilma (plain member).
begin;
create extension if not exists pgtap with schema extensions;

select plan(10);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000e01', 'vic@example.com'),
  ('00000000-0000-0000-0000-000000000e02', 'wilma@example.com');

-- fixtures as postgres (RLS + guards bypassed)
insert into public.companies (id, name, slug)
values ('b0000000-0000-0000-0000-000000000001', 'Event Co', 'event-co');

insert into public.teams (id, company_id, name)
values ('b0000000-0000-0000-0000-0000000000a1', 'b0000000-0000-0000-0000-000000000001', 'Geral');

insert into public.company_members (id, company_id, user_id, status, joined_at) values
  ('b0000000-0000-0000-0000-0000000000d1', 'b0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000e01', 'active', now()),
  ('b0000000-0000-0000-0000-0000000000d2', 'b0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000e02', 'active', now());

-- vic holds platform.audit.read (company scope)
insert into public.company_roles (id, company_id, name)
values ('b0000000-0000-0000-0000-0000000000f1', 'b0000000-0000-0000-0000-000000000001', 'Auditor');
insert into public.role_permissions (company_role_id, permission_key, scope)
values ('b0000000-0000-0000-0000-0000000000f1', 'platform.audit.read', 'company');
insert into public.team_memberships (company_id, team_id, member_id, company_role_id, created_by)
values ('b0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-0000000000a1',
        'b0000000-0000-0000-0000-0000000000d1', 'b0000000-0000-0000-0000-0000000000f1',
        '00000000-0000-0000-0000-000000000e01');

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

-- publish (as postgres / system context) records an event
select isnt(
  public.publish_event('b0000000-0000-0000-0000-000000000001', 'hr.absence.approved.v1',
    jsonb_build_object('absence_id', 1), 'system', null),
  null, 'publish_event returns an event id');
select is(
  (select name from public.events order by id desc limit 1),
  'hr.absence.approved.v1', 'the event name is stored');
select is(
  (select actor->>'type' from public.events order by id desc limit 1),
  'system', 'the actor type is stamped');

-- a user-actor event stamps the given id
select isnt(
  public.publish_event('b0000000-0000-0000-0000-000000000001', 'finance.expense.created',
    '{}'::jsonb, 'user', '00000000-0000-0000-0000-000000000e02'),
  null, 'publish a user-actor event');
select is(
  (select actor->>'id' from public.events order by id desc limit 1),
  '00000000-0000-0000-0000-000000000e02', 'user actor id is stamped');

-- name format is enforced
select throws_ok(
  $$select public.publish_event('b0000000-0000-0000-0000-000000000001', 'badname', '{}'::jsonb, 'system', null)$$,
  '23514', null, 'malformed event name is rejected');
-- actor_type is enforced
select throws_ok(
  $$select public.publish_event('b0000000-0000-0000-0000-000000000001', 'a.b.c', '{}'::jsonb, 'hacker', null)$$,
  '22000', null, 'invalid actor_type is rejected');

-- authenticated users cannot publish directly (no EXECUTE)
select test_login('00000000-0000-0000-0000-000000000e02', 'aal2');
select throws_ok(
  $$select public.publish_event('b0000000-0000-0000-0000-000000000001', 'a.b.c', '{}'::jsonb, 'user', null)$$,
  '42501', null, 'authenticated users cannot publish events directly');
select test_logout();

-- reads are audit-gated: vic (platform.audit.read) sees events, wilma does not
select test_login('00000000-0000-0000-0000-000000000e01', 'aal2');
select cmp_ok((select count(*) from public.events), '>=', 2::bigint,
  'audit.read holder reads the event stream');
select test_logout();

select test_login('00000000-0000-0000-0000-000000000e02', 'aal2');
select is((select count(*) from public.events), 0::bigint,
  'a member without platform.audit.read sees no events');
select test_logout();

select * from finish();
rollback;
