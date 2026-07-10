-- Tests: ADR-0004 — platform-admin gates, provisioning flow, owner-on-accept,
-- companies metadata policy, signup hook contract.
-- Personas: paulo (platform_admin), quim (regular user), dona (customer owner)
begin;
create extension if not exists pgtap with schema extensions;

select plan(15);

insert into auth.users (id, email)
values
  ('00000000-0000-0000-0000-0000000000aa', 'paulo@sorusoft.example'),
  ('00000000-0000-0000-0000-0000000000bb', 'quim@example.com'),
  ('00000000-0000-0000-0000-0000000000cc', 'dona@fnac.example');

update public.profiles set app_role = 'platform_admin'
where id = '00000000-0000-0000-0000-0000000000aa';

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

-- regular users can no longer create companies
select test_login('00000000-0000-0000-0000-0000000000bb', 'quim@example.com', 'aal2');
select throws_ok(
  $$select * from public.create_company('Quim Lda', 'quim-lda')$$,
  '42501', null,
  'ADR-0004: regular users cannot create companies'
);
select throws_ok(
  $$select * from public.admin_create_company('Quim Lda', 'quim-lda', 'a@b.pt')$$,
  '42501', null,
  'ADR-0004: regular users cannot provision either'
);
select test_logout();

-- platform admin provisions a customer company
select test_login('00000000-0000-0000-0000-0000000000aa', 'paulo@sorusoft.example', 'aal2');
select lives_ok(
  $$select * from public.admin_create_company('FNAC Formação', 'fnac-formacao', 'Dona@FNAC.example')$$,
  'platform admin provisions a company'
);
-- metadata visibility (companies table) without membership
select cmp_ok(
  (select count(*) from public.companies),
  '>=', 1::bigint,
  'platform admin lists companies metadata'
);
-- ...but the metadata policy grants NOTHING inside the company
select is(
  (select count(*) from public.company_roles),
  0::bigint,
  'platform admin sees no roles inside customer companies'
);
select test_logout();

-- ground truth as postgres
create temp table pc as select id from public.companies where slug = 'fnac-formacao';
grant select on pc to authenticated;

select is(
  (select count(*) from public.company_roles where company_id = (select id from pc)),
  5::bigint, 'templates seeded for the provisioned company'
);
select is(
  (select count(*) from public.company_members
   where company_id = (select id from pc) and user_id is not null),
  0::bigint, 'the admin did NOT become a member'
);
select is(
  (select invited_role_template from public.company_members
   where company_id = (select id from pc) and user_id is null),
  'owner', 'owner invitation issued with the role template'
);

-- regular user sees no companies (not a member of any)
select test_login('00000000-0000-0000-0000-0000000000bb', 'quim@example.com', 'aal2');
select is(
  (select count(*) from public.companies), 0::bigint,
  'regular non-member still sees zero companies'
);
select test_logout();

-- customer accepts and lands as Owner
create temp table ptok as
  select invite_token from public.company_members
  where company_id = (select id from pc) and user_id is null;
grant select on ptok to authenticated;

select test_login('00000000-0000-0000-0000-0000000000cc', 'dona@fnac.example', 'aal2');
select lives_ok(
  $$select * from public.accept_invitation((select invite_token from ptok))$$,
  'customer accepts the owner invitation'
);
select is(
  (select public.authorize('platform.role.manage', (select id from pc))),
  true, 'accepting granted the Owner role (full company control)'
);
select test_logout();

-- signup hook contract
select is(
  (public.hook_restrict_signup(jsonb_build_object('user', jsonb_build_object('email', 'stranger@example.com')))
     -> 'error' ->> 'http_code'),
  '403',
  'hook rejects signups without an invitation'
);
-- fixture as postgres: a pending invitation for a new hire
insert into public.company_members (company_id, status, invited_email, invite_token)
values ((select id from pc), 'invited', 'newhire@fnac.example', gen_random_uuid());
select is(
  (public.hook_restrict_signup(jsonb_build_object('user', jsonb_build_object('email', 'NewHire@FNAC.example')))
     ->> 'error'),
  null,
  'hook lets invited emails through (case-insensitive)'
);

-- TAKEOVER GUARD: an impostor who registers the owner's email but never
-- received the link must NOT obtain the token via my_invitations() (they'd
-- otherwise accept and seize Owner). Provision a fresh owner invitation:
select test_login('00000000-0000-0000-0000-0000000000aa', 'paulo@sorusoft.example', 'aal2');
select lives_ok(
  $$select * from public.admin_create_company('Alvo Lda', 'alvo-lda', 'chefe@alvo.example')$$,
  'fixture: owner invitation for chefe@alvo.example'
);
select test_logout();

-- impostor controls an account claiming the invited email, but has no link
select test_login('00000000-0000-0000-0000-0000000000bb', 'chefe@alvo.example', 'aal2');
select is(
  (select count(*) from public.my_invitations()),
  0::bigint,
  'TAKEOVER GUARD: owner (role-bearing) invitations are NOT surfaced by my_invitations — the link is required'
);
select test_logout();

select * from finish();
rollback;
