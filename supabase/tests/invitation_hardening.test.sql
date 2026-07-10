-- Tests: invitation expiry, revoke, re-invite after expiry, deleted-company guard
begin;
create extension if not exists pgtap with schema extensions;

select plan(12);

insert into auth.users (id, email)
values
  ('00000000-0000-0000-0000-0000000000d2', 'nuno@example.com'),
  ('00000000-0000-0000-0000-0000000000e2', 'olga@example.com'),
  ('00000000-0000-0000-0000-0000000000f2', 'paulo@example.com');

-- ADR-0004: company creation requires platform_admin - promote the founder persona
update public.profiles set app_role = 'platform_admin'
where id = '00000000-0000-0000-0000-0000000000d2';

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

-- fixtures: nuno founds a company and invites olga
select test_login('00000000-0000-0000-0000-0000000000d2', 'nuno@example.com', 'aal2');
select lives_ok(
  $$select * from public.create_company('Serralharia Nuno', 'serralharia-nuno')$$,
  'fixture: company created'
);
select lives_ok(
  $$select public.invite_member((select id from public.companies where slug = 'serralharia-nuno'), 'olga@example.com')$$,
  'fixture: olga invited'
);
select test_logout();

-- backdate the invitation past the 14-day window
update public.company_members
set created_at = now() - interval '15 days'
where invited_email = 'olga@example.com' and user_id is null;

create temp table t1 as
  select invite_token from public.company_members
  where invited_email = 'olga@example.com' and user_id is null;
grant select on t1 to authenticated;

-- expired: hidden and unacceptable
select test_login('00000000-0000-0000-0000-0000000000e2', 'olga@example.com', 'aal2');
select throws_ok(
  $$select * from public.accept_invitation((select invite_token from t1))$$,
  'P0002', null,
  'expired invitation cannot be accepted'
);
select is(
  (select count(*) from public.my_invitations()),
  0::bigint,
  'expired invitation hidden from the invitee''s home'
);
select test_logout();

-- re-invite after expiry replaces the stale row
select test_login('00000000-0000-0000-0000-0000000000d2', 'nuno@example.com', 'aal2');
select lives_ok(
  $$select public.invite_member((select id from public.companies where slug = 'serralharia-nuno'), 'olga@example.com')$$,
  're-invite succeeds after previous invitation expired'
);
select test_logout();

create temp table t2 as
  select id, invite_token from public.company_members
  where invited_email = 'olga@example.com' and user_id is null;
grant select on t2 to authenticated;

select test_login('00000000-0000-0000-0000-0000000000e2', 'olga@example.com', 'aal2');
select is(
  (select count(*) from public.my_invitations()),
  1::bigint,
  'fresh invitation visible again'
);
select test_logout();

-- revoke: outsider rejected, member succeeds
select test_login('00000000-0000-0000-0000-0000000000f2', 'paulo@example.com', 'aal2');
select throws_ok(
  $$select public.revoke_invitation((select id from t2))$$,
  '42501', null,
  'non-member cannot revoke'
);
select test_logout();

select test_login('00000000-0000-0000-0000-0000000000d2', 'nuno@example.com', 'aal2');
select lives_ok(
  $$select public.revoke_invitation((select id from t2))$$,
  'active member can revoke a pending invitation'
);
select test_logout();

select test_login('00000000-0000-0000-0000-0000000000e2', 'olga@example.com', 'aal2');
select is(
  (select count(*) from public.my_invitations()),
  0::bigint,
  'revoked invitation gone from the invitee''s home'
);
select test_logout();

-- revoked email can be re-invited immediately
select test_login('00000000-0000-0000-0000-0000000000d2', 'nuno@example.com', 'aal2');
select lives_ok(
  $$select public.invite_member((select id from public.companies where slug = 'serralharia-nuno'), 'olga@example.com')$$,
  'revoke frees the email for re-invitation'
);
select test_logout();

create temp table t3 as
  select invite_token from public.company_members
  where invited_email = 'olga@example.com' and user_id is null;
grant select on t3 to authenticated;

-- soft-deleted company: acceptance blocked
update public.companies set deleted_at = now() where slug = 'serralharia-nuno';

select test_login('00000000-0000-0000-0000-0000000000e2', 'olga@example.com', 'aal2');
select throws_ok(
  $$select * from public.accept_invitation((select invite_token from t3))$$,
  'P0002', null,
  'cannot accept into a soft-deleted company'
);
select is(
  (select count(*) from public.my_invitations()),
  0::bigint,
  'deleted-company invitations hidden from home'
);
select test_logout();

select * from finish();
rollback;
