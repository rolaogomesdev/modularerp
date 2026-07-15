-- Tests: hr_leave_requests — the leave-request toy flow composing every primitive
-- (custom-field column, approvals four-eyes, notifications, audit, event outbox).
begin;
create extension if not exists pgtap with schema extensions;

select plan(19);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a5', 'xavi@example.com'),  -- Owner/approver
  ('00000000-0000-0000-0000-0000000000b5', 'yara@example.com'),  -- Employee/requester
  ('00000000-0000-0000-0000-0000000000c5', 'nora@example.com');  -- roleless member

update public.profiles set app_role = 'platform_admin'
where id = '00000000-0000-0000-0000-0000000000a5';

create function test_login(user_id uuid, user_email text, aal text)
returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', user_id, 'email', user_email, 'role', 'authenticated', 'aal', aal)::text, true);
end; $$;

create function test_logout()
returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', null, true);
end; $$;

select has_table('public', 'hr_leave_requests', 'hr_leave_requests table exists');           -- 1
select is(
  (select count(*) from public.permissions
   where key in ('hr.absence.create', 'hr.absence.read', 'hr.absence.approve')),
  3::bigint, 'hr.absence.* permissions seeded'                                                -- 2
);

-- xavi (platform_admin) creates company A and becomes Owner (auto-gets hr.absence.* company).
select test_login('00000000-0000-0000-0000-0000000000a5', 'xavi@example.com', 'aal2');
select lives_ok($$select * from public.create_company('Padel Clube', 'padel')$$,
  'fixture: company A created');                                                              -- 3
create temp table ca as select id from public.companies where slug = 'padel';
grant select on ca to authenticated;

-- Apply the module's template grants (the Phase 3 registry will do this at
-- creation; here it is explicit because A is created inside the test tx).
select test_logout();
select lives_ok($$select public.grant_hr_absence_templates((select id from ca))$$,
  'fixture: hr template grants applied');                                                     -- 4

-- yara + nora invited and accept.
select test_login('00000000-0000-0000-0000-0000000000a5', 'xavi@example.com', 'aal2');
select lives_ok($$select public.invite_member((select id from ca), 'yara@example.com')$$,
  'fixture: yara invited');                                                                   -- 5
select lives_ok($$select public.invite_member((select id from ca), 'nora@example.com')$$,
  'fixture: nora invited');                                                                   -- 6
select test_logout();
create temp table tk as
  select invited_email, invite_token from public.company_members
  where company_id = (select id from ca) and invited_email in ('yara@example.com', 'nora@example.com');
grant select on tk to authenticated;

select test_login('00000000-0000-0000-0000-0000000000b5', 'yara@example.com', 'aal2');
select lives_ok(
  $$select public.accept_invitation((select invite_token from tk where invited_email = 'yara@example.com'))$$,
  'fixture: yara joined');                                                                    -- 7
select test_login('00000000-0000-0000-0000-0000000000c5', 'nora@example.com', 'aal2');
select lives_ok(
  $$select public.accept_invitation((select invite_token from tk where invited_email = 'nora@example.com'))$$,
  'fixture: nora joined');                                                                    -- 8

-- xavi assigns yara the Employee role (she may now request leave, own-scope).
select test_login('00000000-0000-0000-0000-0000000000a5', 'xavi@example.com', 'aal2');
select lives_ok($$
  insert into public.team_memberships (company_id, team_id, member_id, company_role_id, created_by)
  select (select id from ca),
         (select id from public.teams where company_id = (select id from ca) and name = 'Geral'),
         (select id from public.company_members where company_id = (select id from ca)
            and user_id = '00000000-0000-0000-0000-0000000000b5'),
         (select id from public.company_roles where company_id = (select id from ca) and template_key = 'employee'),
         '00000000-0000-0000-0000-0000000000a5'
$$, 'fixture: yara assigned Employee');                                                       -- 9

-- yara submits a leave request through the one door.
select test_login('00000000-0000-0000-0000-0000000000b5', 'yara@example.com', 'aal2');
select lives_ok(
  $$select public.submit_leave_request((select id from ca), 'vacation', '2026-08-01', '2026-08-05', 'beach')$$,
  'requester submits a leave request');                                                       -- 10

-- Everything the one call must have produced (checked out-of-band, bypassing RLS).
select test_logout();
select is(
  (select count(*) from public.hr_leave_requests where company_id = (select id from ca)),
  1::bigint, 'leave request persisted');                                                      -- 11
select is(
  (select count(*) from public.events
   where company_id = (select id from ca) and name = 'hr.leave.requested'),
  1::bigint, 'hr.leave.requested event published');                                           -- 12
select is(
  (select count(*) from public.approvals
   where company_id = (select id from ca) and kind = 'hr.absence' and status = 'pending'),
  1::bigint, 'four-eyes approval opened');                                                     -- 13
create temp table ap as
  select id from public.approvals where company_id = (select id from ca) and kind = 'hr.absence';
grant select on ap to authenticated;

-- Read gating.
select test_login('00000000-0000-0000-0000-0000000000b5', 'yara@example.com', 'aal2');
select is(
  (select count(*) from public.hr_leave_requests where company_id = (select id from ca)),
  1::bigint, 'the requester reads their own request');                                        -- 14
select test_login('00000000-0000-0000-0000-0000000000c5', 'nora@example.com', 'aal2');
select is(
  (select count(*) from public.hr_leave_requests where company_id = (select id from ca)),
  0::bigint, 'a roleless member cannot read others'' requests');                              -- 15

-- Four-eyes: the requester cannot decide their own; the door is the only writer.
select test_login('00000000-0000-0000-0000-0000000000b5', 'yara@example.com', 'aal2');
select throws_ok(
  $$select public.decide_approval((select id from ap), true)$$,
  'PT002', null, 'requester cannot approve their own leave');                                 -- 16
select throws_ok(
  $$insert into public.hr_leave_requests (company_id, member_id, subject_user_id, leave_type, start_date, end_date)
    values ((select id from ca), '00000000-0000-0000-0000-000000000000',
            '00000000-0000-0000-0000-0000000000b5', 'sick', '2026-01-01', '2026-01-02')$$,
  '42501', null, 'no direct insert — submit_leave_request is the only door');                 -- 17

-- Owner approves; the module reacts and publishes the decision event.
select test_login('00000000-0000-0000-0000-0000000000a5', 'xavi@example.com', 'aal2');
select lives_ok($$select public.decide_approval((select id from ap), true, 'enjoy')$$,
  'owner approves the leave');                                                                 -- 18
select test_logout();
select is(
  (select count(*) from public.events
   where company_id = (select id from ca) and name = 'hr.leave.approved'),
  1::bigint, 'hr.leave.approved event published on decision');                                -- 19

select * from finish();
rollback;
