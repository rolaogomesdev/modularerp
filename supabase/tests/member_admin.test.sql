-- Tests: suspend/reactivate via RLS-gated update (admin UI support)
begin;
create extension if not exists pgtap with schema extensions;

select plan(8);

insert into auth.users (id, email)
values
  ('00000000-0000-0000-0000-0000000000a6', 'zeca@example.com'),
  ('00000000-0000-0000-0000-0000000000b6', 'alda@example.com');

-- ADR-0004: company creation requires platform_admin - promote the founder persona
update public.profiles set app_role = 'platform_admin'
where id = '00000000-0000-0000-0000-0000000000a6';

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

-- zeca founds a company (Owner) and alda joins as plain member; plus one
-- pending invitation row to prove it cannot be flipped through this path
select test_login('00000000-0000-0000-0000-0000000000a6', 'zeca@example.com', 'aal2');
select lives_ok(
  $$select * from public.create_company('Café Zeca', 'cafe-zeca')$$,
  'fixture: company created'
);
select lives_ok(
  $$select public.invite_member((select id from public.companies where slug = 'cafe-zeca'), 'ghost@example.com')$$,
  'fixture: pending invitation exists'
);
select test_logout();

create temp table cc as select id from public.companies where slug = 'cafe-zeca';
grant select on cc to authenticated;

insert into public.company_members (id, company_id, user_id, status, joined_at)
values ('61000000-0000-0000-0000-000000000001', (select id from cc), '00000000-0000-0000-0000-0000000000b6', 'active', now());

-- plain member cannot suspend anyone
select test_login('00000000-0000-0000-0000-0000000000b6', 'alda@example.com', 'aal2');
select lives_ok(
  $$update public.company_members set status = 'suspended'
    where company_id = (select id from cc) and user_id = '00000000-0000-0000-0000-0000000000a6'$$,
  'plain member suspend attempt runs (RLS filters to 0 rows)'
);
select test_logout();
select is(
  (select status from public.company_members
   where company_id = (select id from cc) and user_id = '00000000-0000-0000-0000-0000000000a6'),
  'active', 'owner unaffected by plain member''s attempt'
);

-- Owner suspends alda: her permissions die instantly
select test_login('00000000-0000-0000-0000-0000000000a6', 'zeca@example.com', 'aal2');
select lives_ok(
  $$update public.company_members set status = 'suspended' where id = '61000000-0000-0000-0000-000000000001'$$,
  'owner suspends a member'
);
select test_logout();
select is(
  (select status from public.company_members where id = '61000000-0000-0000-0000-000000000001'),
  'suspended', 'member suspended'
);

-- invitation rows cannot be flipped to active through the update path
select test_login('00000000-0000-0000-0000-0000000000a6', 'zeca@example.com', 'aal2');
select lives_ok(
  $$update public.company_members set status = 'active'
    where company_id = (select id from cc) and user_id is null$$,
  'invitation-flip attempt runs (RLS filters to 0 rows)'
);
select test_logout();
select is(
  (select status from public.company_members
   where company_id = (select id from cc) and user_id is null and invited_email = 'ghost@example.com'),
  'invited', 'invitation row untouched — accept flow is the only door'
);

select * from finish();
rollback;
