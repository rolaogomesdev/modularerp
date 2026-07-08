-- RPC tests: create_company, invite_member, accept_invitation
-- Personas: dora (founder), eva (invitee, correct email), frank (wrong email / outsider)
begin;
create extension if not exists pgtap with schema extensions;

select plan(17);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-0000000000d0', 'dora@example.com',  '{"display_name": "Dora"}'),
  ('00000000-0000-0000-0000-0000000000e0', 'eva@example.com',   '{"display_name": "Eva"}'),
  ('00000000-0000-0000-0000-0000000000f0', 'frank@example.com', '{"display_name": "Frank"}');

create function test_login(user_id uuid, user_email text, aal text)
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', user_id, 'email', user_email, 'role', 'authenticated', 'aal', aal)::text,
    true
  );
end;
$$;

create function test_logout()
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', null, true);
end;
$$;

-- ---------------------------------------------------------------------------
-- create_company
-- ---------------------------------------------------------------------------

select test_login('00000000-0000-0000-0000-0000000000d0', 'dora@example.com', 'aal1');
select throws_ok(
  $$select * from public.create_company('Padaria Silva', 'padaria-silva')$$,
  '42501', null,
  'create_company: rejected at aal1'
);
select test_logout();

select test_login('00000000-0000-0000-0000-0000000000d0', 'dora@example.com', 'aal2');
select lives_ok(
  $$select * from public.create_company('Padaria Silva', 'padaria-silva')$$,
  'create_company: works at aal2'
);
select results_eq(
  'select slug from public.companies',
  $$values ('padaria-silva')$$,
  'creator immediately sees the new company (active membership created)'
);
select throws_ok(
  $$select * from public.create_company('Copy Cat', 'padaria-silva')$$,
  '23505', null,
  'create_company: duplicate slug rejected'
);
select throws_ok(
  $$select * from public.create_company('Xis', 'Bad Slug!')$$,
  '23514', null,
  'create_company: invalid slug rejected by check constraint'
);
select test_logout();

-- fixtures as postgres
create temp table ctx as
  select id as company_id from public.companies where slug = 'padaria-silva';
grant select on ctx to authenticated;

-- ---------------------------------------------------------------------------
-- invite_member
-- ---------------------------------------------------------------------------

select test_login('00000000-0000-0000-0000-0000000000d0', 'dora@example.com', 'aal2');
select lives_ok(
  $$select public.invite_member((select company_id from ctx), 'Eva@Example.com')$$,
  'invite_member: active member can invite (email normalized)'
);
select throws_ok(
  $$select public.invite_member((select company_id from ctx), 'eva@example.com')$$,
  '23505', null,
  'invite_member: duplicate pending invite rejected'
);
select throws_ok(
  $$select public.invite_member((select company_id from ctx), 'not-an-email')$$,
  '22000', null,
  'invite_member: invalid email rejected'
);
select throws_ok(
  $$select invite_token from public.company_members$$,
  '42501', null,
  'invite tokens are unreadable by authenticated users (column privilege)'
);
select test_logout();

-- fixture as postgres: grab eva's token
create temp table invite as
  select m.invite_token
  from public.company_members m
  where m.invited_email = 'eva@example.com' and m.user_id is null;
grant select on invite to authenticated;

-- outsider cannot invite, wrong email cannot accept
select test_login('00000000-0000-0000-0000-0000000000f0', 'frank@example.com', 'aal2');
select throws_ok(
  $$select public.invite_member((select company_id from ctx), 'anyone@example.com')$$,
  '42501', null,
  'invite_member: non-member rejected'
);
select throws_ok(
  $$select * from public.accept_invitation((select invite_token from invite))$$,
  '42501', null,
  'accept_invitation: wrong email rejected'
);
select test_logout();

-- ---------------------------------------------------------------------------
-- accept_invitation
-- ---------------------------------------------------------------------------

select test_login('00000000-0000-0000-0000-0000000000e0', 'eva@example.com', 'aal1');
select throws_ok(
  $$select * from public.accept_invitation((select invite_token from invite))$$,
  '42501', null,
  'accept_invitation: rejected at aal1'
);
select test_logout();

select test_login('00000000-0000-0000-0000-0000000000e0', 'eva@example.com', 'aal2');
select is(
  (select count(*) from public.companies),
  0::bigint,
  'eva sees nothing before accepting'
);
select lives_ok(
  $$select * from public.accept_invitation((select invite_token from invite))$$,
  'accept_invitation: correct email at aal2 succeeds'
);
select results_eq(
  'select slug from public.companies',
  $$values ('padaria-silva')$$,
  'eva sees the company after accepting'
);
select throws_ok(
  $$select public.invite_member((select company_id from ctx), 'newbie@example.com')$$,
  '42501', null,
  'plain member cannot invite (requires platform.member.manage — Phase 1 tightening)'
);
select throws_ok(
  $$select * from public.accept_invitation((select invite_token from invite))$$,
  'P0002', null,
  'accept_invitation: token single-use'
);
select test_logout();

select * from finish();
rollback;
