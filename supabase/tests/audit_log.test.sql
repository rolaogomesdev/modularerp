-- Tests: audit_log — append-only, actor stamping, read gating, RPC coverage
begin;
create extension if not exists pgtap with schema extensions;

select plan(14);

insert into auth.users (id, email)
values
  ('00000000-0000-0000-0000-0000000000a5', 'xavi@example.com'),
  ('00000000-0000-0000-0000-0000000000b5', 'yara@example.com');

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

-- xavi creates a company (becomes Owner -> holds platform.audit.read)
select test_login('00000000-0000-0000-0000-0000000000a5', 'xavi@example.com', 'aal2');
select lives_ok(
  $$select * from public.create_company('Padel Clube', 'padel-clube')$$,
  'fixture: company created'
);

create temp table cc as select id from public.companies where slug = 'padel-clube';
grant select on cc to authenticated;

select is(
  (select count(*) from public.audit_log where company_id = (select id from cc) and action = 'company.create'),
  1::bigint, 'company.create audited'
);
select is(
  (select actor_user_id from public.audit_log where company_id = (select id from cc) and action = 'company.create'),
  '00000000-0000-0000-0000-0000000000a5'::uuid, 'actor stamped as the creator'
);

-- invite + revoke + re-invite, each audited
select lives_ok(
  $$select public.invite_member((select id from cc), 'yara@example.com')$$,
  'fixture: yara invited'
);
select is(
  (select after->>'invited_email' from public.audit_log
   where company_id = (select id from cc) and action = 'member.invite'
   order by created_at desc limit 1),
  'yara@example.com', 'member.invite audited with email'
);
select test_logout();

create temp table inv as
  select id, invite_token from public.company_members
  where invited_email = 'yara@example.com' and user_id is null;
grant select on inv to authenticated;

select test_login('00000000-0000-0000-0000-0000000000a5', 'xavi@example.com', 'aal2');
select lives_ok(
  $$select public.revoke_invitation((select id from inv))$$,
  'fixture: invitation revoked'
);
select is(
  (select count(*) from public.audit_log where company_id = (select id from cc) and action = 'member.revoke_invite'),
  1::bigint, 'member.revoke_invite audited'
);
select lives_ok(
  $$select public.invite_member((select id from cc), 'yara@example.com')$$,
  'fixture: yara re-invited'
);
select test_logout();

create temp table inv2 as
  select invite_token from public.company_members
  where invited_email = 'yara@example.com' and user_id is null;
grant select on inv2 to authenticated;

-- yara accepts: audited with her as actor
select test_login('00000000-0000-0000-0000-0000000000b5', 'yara@example.com', 'aal2');
select lives_ok(
  $$select * from public.accept_invitation((select invite_token from inv2))$$,
  'fixture: yara accepted'
);
select test_logout();

select is(
  (select actor_user_id from public.audit_log
   where company_id = (select id from cc) and action = 'member.accept'),
  '00000000-0000-0000-0000-0000000000b5'::uuid, 'member.accept audited with the invitee as actor'
);

-- read gating: Owner sees the trail, plain member sees nothing
select test_login('00000000-0000-0000-0000-0000000000a5', 'xavi@example.com', 'aal2');
select cmp_ok(
  (select count(*) from public.audit_log where company_id = (select id from cc)),
  '>=', 5::bigint, 'Owner (platform.audit.read) reads the trail'
);
select test_logout();

select test_login('00000000-0000-0000-0000-0000000000b5', 'yara@example.com', 'aal2');
select is(
  (select count(*) from public.audit_log where company_id = (select id from cc)),
  0::bigint, 'member without platform.audit.read sees nothing'
);

-- append-only: no direct writes, no rewriting history
select throws_ok(
  $$insert into public.audit_log (company_id, action, entity) values ((select id from cc), 'fake.entry', 'x')$$,
  '42501', null, 'direct INSERT by authenticated users denied'
);
select throws_ok(
  $$update public.audit_log set reason = 'tampered' where company_id = (select id from cc)$$,
  '42501', null, 'UPDATE denied — history cannot be rewritten'
);
select test_logout();

select * from finish();
rollback;
