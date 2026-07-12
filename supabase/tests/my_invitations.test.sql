-- Tests: my_invitations() — invitee sees own pending invitations, nobody else's
begin;
create extension if not exists pgtap with schema extensions;

select plan(6);

insert into auth.users (id, email)
values
  ('00000000-0000-0000-0000-0000000000a1', 'gil@example.com'),
  ('00000000-0000-0000-0000-0000000000b1', 'ines@example.com'),
  ('00000000-0000-0000-0000-0000000000c1', 'hugo@example.com');

-- ADR-0004: company creation requires platform_admin - promote the founder persona
update public.profiles set app_role = 'platform_admin'
where id = '00000000-0000-0000-0000-0000000000a1';

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

-- gil founds a company and invites ines
select test_login('00000000-0000-0000-0000-0000000000a1', 'gil@example.com', 'aal2');
select lives_ok(
  $$select * from public.create_company('Oficina Gil', 'oficina-gil')$$,
  'fixture: company created'
);
select lives_ok(
  $$select public.invite_member((select id from public.companies where slug = 'oficina-gil'), 'Ines@Example.com')$$,
  'fixture: ines invited'
);
select test_logout();

-- ines at aal2 sees her invitation, with a usable token
select test_login('00000000-0000-0000-0000-0000000000b1', 'ines@example.com', 'aal2');
select results_eq(
  'select company_name from public.my_invitations()',
  $$values ('Oficina Gil')$$,
  'invitee sees her pending invitation'
);
select isnt(
  (select invite_token from public.my_invitations() limit 1),
  null,
  'invitee receives the token (usable for accept)'
);
select test_logout();

-- ines at aal1 sees nothing
select test_login('00000000-0000-0000-0000-0000000000b1', 'ines@example.com', 'aal1');
select is(
  (select count(*) from public.my_invitations()),
  0::bigint,
  'aal1 session sees no invitations'
);
select test_logout();

-- hugo (different email) sees nothing
select test_login('00000000-0000-0000-0000-0000000000c1', 'hugo@example.com', 'aal2');
select is(
  (select count(*) from public.my_invitations()),
  0::bigint,
  'other users see no invitations addressed to someone else'
);
select test_logout();

select * from finish();
rollback;
