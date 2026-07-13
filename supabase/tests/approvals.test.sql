-- Tests: approvals — four-eyes, approver scope via authorize(), self-approval
-- refused (even with permission), notifications, audit, cancel.
-- Personas: igor (requester, Team A), julia (approver Team A only),
--           karl (approver company-wide — tests self-approval), outsider.
begin;
create extension if not exists pgtap with schema extensions;

select plan(19);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000f2', 'igor@example.com'),
  ('00000000-0000-0000-0000-0000000000f3', 'julia@example.com'),
  ('00000000-0000-0000-0000-0000000000f4', 'karl@example.com'),
  ('00000000-0000-0000-0000-0000000000f5', 'outsider@example.com');

-- fixtures as postgres (RLS + escalation guards bypassed for setup)
insert into public.companies (id, name, slug)
values ('a0000000-0000-0000-0000-000000000c01', 'Leave Co', 'leave-co');

insert into public.teams (id, company_id, name) values
  ('a0000000-0000-0000-0000-0000000000aa', 'a0000000-0000-0000-0000-000000000c01', 'Team A'),
  ('a0000000-0000-0000-0000-0000000000bb', 'a0000000-0000-0000-0000-000000000c01', 'Team B');

insert into public.company_members (id, company_id, user_id, status, joined_at) values
  ('a0000000-0000-0000-0000-00000000d002', 'a0000000-0000-0000-0000-000000000c01', '00000000-0000-0000-0000-0000000000f2', 'active', now()),
  ('a0000000-0000-0000-0000-00000000d003', 'a0000000-0000-0000-0000-000000000c01', '00000000-0000-0000-0000-0000000000f3', 'active', now()),
  ('a0000000-0000-0000-0000-00000000d004', 'a0000000-0000-0000-0000-000000000c01', '00000000-0000-0000-0000-0000000000f4', 'active', now()),
  ('a0000000-0000-0000-0000-00000000d005', 'a0000000-0000-0000-0000-000000000c01', '00000000-0000-0000-0000-0000000000f5', 'active', now());

insert into public.permissions (key, module, resource, action, allowed_scopes, description)
values ('test.leave.approve', 'test', 'leave', 'approve', '{team,company}', 'leave approval');

insert into public.company_roles (id, company_id, name) values
  ('a0000000-0000-0000-0000-0000000e0001', 'a0000000-0000-0000-0000-000000000c01', 'Team Approver'),
  ('a0000000-0000-0000-0000-0000000e0002', 'a0000000-0000-0000-0000-000000000c01', 'Company Approver');

insert into public.role_permissions (company_role_id, permission_key, scope) values
  ('a0000000-0000-0000-0000-0000000e0001', 'test.leave.approve', 'team'),
  ('a0000000-0000-0000-0000-0000000e0002', 'test.leave.approve', 'company');

-- julia approves Team A only; karl approves company-wide
insert into public.team_memberships (company_id, team_id, member_id, company_role_id, created_by) values
  ('a0000000-0000-0000-0000-000000000c01', 'a0000000-0000-0000-0000-0000000000aa', 'a0000000-0000-0000-0000-00000000d003', 'a0000000-0000-0000-0000-0000000e0001', '00000000-0000-0000-0000-0000000000f2'),
  ('a0000000-0000-0000-0000-000000000c01', 'a0000000-0000-0000-0000-0000000000aa', 'a0000000-0000-0000-0000-00000000d004', 'a0000000-0000-0000-0000-0000000e0002', '00000000-0000-0000-0000-0000000000f2');

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

create temp table ids (label text primary key, id uuid);
grant select, insert on ids to authenticated;

-- igor requests leave (Team A)
select test_login('00000000-0000-0000-0000-0000000000f2', 'aal2');
select lives_ok(
  $$insert into ids
    select 'req_a', public.request_approval(
      'a0000000-0000-0000-0000-000000000c01', 'a0000000-0000-0000-0000-0000000000aa',
      'test.leave.approve', 'test.leave', 'leave', null,
      jsonb_build_object('what', '3 days off'))$$,
  'requester creates a Team A approval'
);
-- requester sees their own
select is((select count(*) from public.approvals where requester_id = '00000000-0000-0000-0000-0000000000f2'),
  1::bigint, 'requester sees their own request');
select test_logout();

-- julia (Team A approver) got notified and sees the request
select test_login('00000000-0000-0000-0000-0000000000f3', 'aal2');
select is((select count(*) from public.notifications where kind = 'approval.requested'),
  1::bigint, 'eligible approver was notified');
select is((select count(*) from public.approvals), 1::bigint,
  'Team A approver sees the request in scope');
-- self-approval N/A for julia; she is not the requester
select test_logout();

-- karl (company approver) also sees it
select test_login('00000000-0000-0000-0000-0000000000f4', 'aal2');
select is((select count(*) from public.approvals), 1::bigint,
  'company-wide approver also sees the request');
select test_logout();

-- outsider (no approve permission, not requester) sees nothing
select test_login('00000000-0000-0000-0000-0000000000f5', 'aal2');
select is((select count(*) from public.approvals), 0::bigint,
  'non-approver, non-requester sees no requests');
select throws_ok(
  $$select public.decide_approval((select id from ids where label = 'req_a'), true, null)$$,
  '42501', null,
  'outsider cannot decide (no permission)'
);
select test_logout();

-- a Team B request: julia (Team A) must NOT see it; karl (company) must
select test_login('00000000-0000-0000-0000-0000000000f2', 'aal2');
insert into ids
  select 'req_b', public.request_approval(
    'a0000000-0000-0000-0000-000000000c01', 'a0000000-0000-0000-0000-0000000000bb',
    'test.leave.approve', 'test.leave', 'leave', null, '{}'::jsonb);
select test_logout();

select test_login('00000000-0000-0000-0000-0000000000f3', 'aal2');
select is((select count(*) from public.approvals), 1::bigint,
  'Team A approver does NOT see the Team B request (scope)');
select test_logout();

select test_login('00000000-0000-0000-0000-0000000000f4', 'aal2');
select is((select count(*) from public.approvals), 2::bigint,
  'company approver sees both teams'' requests');
select test_logout();

-- SELF-APPROVAL: karl (company approver) requests, then tries to decide his own
select test_login('00000000-0000-0000-0000-0000000000f4', 'aal2');
insert into ids
  select 'req_karl', public.request_approval(
    'a0000000-0000-0000-0000-000000000c01', 'a0000000-0000-0000-0000-0000000000aa',
    'test.leave.approve', 'test.leave', 'leave', null, '{}'::jsonb);
select throws_ok(
  $$select public.decide_approval((select id from ids where label = 'req_karl'), true, null)$$,
  'PT002', null,
  'FOUR-EYES: cannot decide your own request even holding the permission'
);
select test_logout();

-- julia approves igor's Team A request
select test_login('00000000-0000-0000-0000-0000000000f3', 'aal2');
select lives_ok(
  $$select public.decide_approval((select id from ids where label = 'req_a'), true, 'Enjoy')$$,
  'Team A approver approves the request'
);
select test_logout();

select is(
  (select status from public.approvals where id = (select id from ids where label = 'req_a')),
  'approved', 'request is approved');
select is(
  (select decided_by from public.approvals where id = (select id from ids where label = 'req_a')),
  '00000000-0000-0000-0000-0000000000f3'::uuid, 'decided_by records the approver');

-- requester got the decision notification
select is(
  (select count(*) from public.notifications
   where recipient_id = '00000000-0000-0000-0000-0000000000f2' and kind = 'approval.decided'),
  1::bigint, 'requester notified of the decision');

-- deciding again is refused
select test_login('00000000-0000-0000-0000-0000000000f4', 'aal2');
select throws_ok(
  $$select public.decide_approval((select id from ids where label = 'req_a'), false, null)$$,
  'P0002', null,
  'an already-decided request cannot be decided again');
select test_logout();

-- cancel: only the requester, only pending
-- karl (company approver) can SEE req_b but must not be able to cancel it
select test_login('00000000-0000-0000-0000-0000000000f4', 'aal2');
select throws_ok(
  $$select public.cancel_approval((select id from ids where label = 'req_b'))$$,
  '42501', null,
  'a non-requester cannot cancel someone else''s request'
);
select test_logout();

select test_login('00000000-0000-0000-0000-0000000000f2', 'aal2');
select lives_ok(
  $$select public.cancel_approval((select id from ids where label = 'req_b'))$$,
  'requester cancels their own pending request');

-- request_approval rejects a team that is not in the company (integrity)
select throws_ok(
  $$select public.request_approval(
      'a0000000-0000-0000-0000-000000000c01', gen_random_uuid(),
      'test.leave.approve', 'test.leave', null, null, '{}'::jsonb)$$,
  '23514', null,
  'request_approval rejects a team not belonging to the company');
-- fresh request for the suspended-requester case
insert into ids
  select 'req_c', public.request_approval(
    'a0000000-0000-0000-0000-000000000c01', 'a0000000-0000-0000-0000-0000000000aa',
    'test.leave.approve', 'test.leave', null, null, '{}'::jsonb);
select test_logout();

-- requester suspended AFTER requesting: a decision must still succeed
update public.company_members set status = 'suspended'
where user_id = '00000000-0000-0000-0000-0000000000f2';

select test_login('00000000-0000-0000-0000-0000000000f3', 'aal2');
select lives_ok(
  $$select public.decide_approval((select id from ids where label = 'req_c'), true, null)$$,
  'a decision succeeds even if the requester was suspended (notification best-effort)');
select test_logout();

select * from finish();
rollback;
