-- Tests: security_events — append-only detection substrate, collectors, read gating.
begin;
create extension if not exists pgtap with schema extensions;

select plan(19);

insert into auth.users (id, email)
values
  ('00000000-0000-0000-0000-0000000000a5', 'xavi@example.com'),
  ('00000000-0000-0000-0000-0000000000b5', 'yara@example.com'),
  ('00000000-0000-0000-0000-0000000000c5', 'zoe@example.com');

-- Company creation requires platform_admin (ADR-0004): promote the two founders.
update public.profiles set app_role = 'platform_admin'
where id in ('00000000-0000-0000-0000-0000000000a5',
             '00000000-0000-0000-0000-0000000000c5');

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

select has_table('public', 'security_events', 'security_events table exists');  -- 1

-- xavi (platform_admin) creates company A; the owner bootstrap assigns a
-- membership, which must surface on the privilege-change collector.
select test_login('00000000-0000-0000-0000-0000000000a5', 'xavi@example.com', 'aal2');
select lives_ok(
  $$select * from public.create_company('Sec Alpha', 'sec-a')$$,
  'fixture: company A created'                                                   -- 2
);
create temp table ca as select id from public.companies where slug = 'sec-a';
grant select on ca to authenticated;
select cmp_ok(
  (select count(*) from public.security_events
   where company_id = (select id from ca) and kind = 'privilege.change'),
  '>=', 1::bigint, 'owner bootstrap captured as a privilege.change signal'       -- 3
);

-- zoe (platform_admin) creates company B — used for cross-company isolation.
select test_login('00000000-0000-0000-0000-0000000000c5', 'zoe@example.com', 'aal2');
select lives_ok(
  $$select * from public.create_company('Sec Beta', 'sec-b')$$,
  'fixture: company B created'                                                   -- 4
);
create temp table cb as select id from public.companies where slug = 'sec-b';
grant select on cb to authenticated;

-- xavi invites yara to A; yara accepts and becomes a plain member (no audit.read).
select test_login('00000000-0000-0000-0000-0000000000a5', 'xavi@example.com', 'aal2');
select lives_ok(
  $$select public.invite_member((select id from ca), 'yara@example.com')$$,
  'fixture: yara invited to A'                                                   -- 5
);
-- Capture the token out-of-band (invite_token is not readable by members).
select test_logout();
create temp table tk as
  select invite_token from public.company_members
  where company_id = (select id from ca) and invited_email = 'yara@example.com';
grant select on tk to authenticated;

select test_login('00000000-0000-0000-0000-0000000000b5', 'yara@example.com', 'aal2');
select lives_ok(
  $$select public.accept_invitation((select invite_token from tk))$$,
  'fixture: yara joined A'                                                       -- 6
);

-- A member may file an event for their own company, but not for another.
select lives_ok(
  $$select public.record_security_event('test.ping', (select id from ca))$$,
  'member records an event for their own company'                               -- 7
);
select throws_ok(
  $$select public.record_security_event('test.ping', (select id from cb))$$,
  '42501', null, 'member cannot file an event for a company they are not in'     -- 8
);

-- The recorded event is stored (verified out-of-band, bypassing RLS).
select test_logout();
select cmp_ok(
  (select count(*) from public.security_events
   where company_id = (select id from ca) and kind = 'test.ping'),
  '=', 1::bigint, 'the recorded event is persisted'                             -- 9
);

-- Read gating.
select test_login('00000000-0000-0000-0000-0000000000a5', 'xavi@example.com', 'aal2');
select cmp_ok(
  (select count(*) from public.security_events where company_id = (select id from ca)),
  '>', 0::bigint, 'audit reader (Owner) sees the company stream'                 -- 10
);
select test_login('00000000-0000-0000-0000-0000000000b5', 'yara@example.com', 'aal2');
select is(
  (select count(*) from public.security_events where company_id = (select id from ca)),
  0::bigint, 'member without platform.audit.read sees nothing'                   -- 11
);
select is(
  (select count(*) from public.security_events where company_id = (select id from cb)),
  0::bigint, 'member of A cannot see company B events (isolation)'               -- 12
);

-- Platform-level events (company_id null) are for platform_admin eyes only.
select test_login('00000000-0000-0000-0000-0000000000a5', 'xavi@example.com', 'aal2');
select lives_ok(
  $$select public.record_security_event('auth.login_failed', null, 'warning')$$,
  'a platform-level event can be recorded'                                       -- 13
);
select is(
  (select count(*) from public.security_events
   where company_id is null and kind = 'auth.login_failed'),
  1::bigint, 'platform_admin sees platform-level events'                         -- 14
);
select test_login('00000000-0000-0000-0000-0000000000b5', 'yara@example.com', 'aal2');
select is(
  (select count(*) from public.security_events where company_id is null),
  0::bigint, 'non-admins never see platform-level events'                        -- 15
);

-- Suspending a member is a security-relevant privilege change and is collected.
select test_login('00000000-0000-0000-0000-0000000000a5', 'xavi@example.com', 'aal2');
select lives_ok(
  $$update public.company_members set status = 'suspended'
    where company_id = (select id from ca)
      and user_id = '00000000-0000-0000-0000-0000000000b5'$$,
  'fixture: xavi suspends yara'                                                  -- 16
);
select test_logout();
select cmp_ok(
  (select count(*) from public.security_events
   where company_id = (select id from ca) and kind = 'privilege.member_status'),
  '=', 1::bigint, 'member suspension captured as a signal'                       -- 17
);

-- Append-only: the stream cannot be rewritten by anyone.
select test_login('00000000-0000-0000-0000-0000000000a5', 'xavi@example.com', 'aal2');
select throws_ok(
  $$update public.security_events set severity = 'critical'
    where company_id = (select id from ca)$$,
  '42501', null, 'UPDATE denied — signals cannot be tampered with'               -- 18
);
select throws_ok(
  $$delete from public.security_events where company_id = (select id from ca)$$,
  '42501', null, 'DELETE denied — history cannot be erased'                      -- 19
);
select test_logout();

select * from finish();
rollback;
