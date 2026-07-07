-- RLS tests: profiles, companies, company_members, member_directory
-- Personas: ana (member of acme), bruno (member of other), carla (INVITED to acme, not active)
begin;
create extension if not exists pgtap with schema extensions;

select plan(20);

-- ---------------------------------------------------------------------------
-- Fixtures (as postgres — bypasses RLS)
-- ---------------------------------------------------------------------------

insert into auth.users (id, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-00000000000a', 'ana@example.com',   '{"display_name": "Ana", "locale": "pt-PT"}'),
  ('00000000-0000-0000-0000-00000000000b', 'bruno@example.com', '{"locale": "xx-INVALID"}'),
  ('00000000-0000-0000-0000-00000000000c', 'carla@example.com', '{}');

insert into public.companies (id, name, slug)
values
  ('10000000-0000-0000-0000-000000000001', 'Acme',  'acme'),
  ('10000000-0000-0000-0000-000000000002', 'Other', 'other');

insert into public.company_members (company_id, user_id, status, joined_at)
values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'active',  now()),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000b', 'active',  now()),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000c', 'invited', null);

-- signup trigger sanity
select is(
  (select display_name from public.profiles where id = '00000000-0000-0000-0000-00000000000a'),
  'Ana',
  'trigger: profile created with display_name from metadata'
);
select is(
  (select locale from public.profiles where id = '00000000-0000-0000-0000-00000000000b'),
  'pt-PT',
  'trigger: invalid metadata locale falls back to pt-PT'
);

-- ---------------------------------------------------------------------------
-- Session helpers
-- ---------------------------------------------------------------------------

create function test_login(user_id uuid, aal text)
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', user_id, 'role', 'authenticated', 'aal', aal)::text,
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
-- ana @ AAL2: sees exactly her world
-- ---------------------------------------------------------------------------

select test_login('00000000-0000-0000-0000-00000000000a', 'aal2');

select results_eq(
  'select id from public.profiles',
  $$values ('00000000-0000-0000-0000-00000000000a'::uuid)$$,
  'ana@aal2: sees only her own profile row'
);
select results_eq(
  'select slug from public.companies',
  $$values ('acme')$$,
  'ana@aal2: sees only her company'
);
select is(
  (select count(*) from public.company_members),
  2::bigint,
  'ana@aal2: sees acme member list (ana + invited carla), nothing of other'
);
select results_eq(
  'select id from public.member_directory order by display_name',
  $$values ('00000000-0000-0000-0000-00000000000a'::uuid)$$,
  'ana@aal2: directory shows only ACTIVE co-members (carla invited -> hidden, bruno other company -> hidden)'
);

-- writes
select lives_ok(
  $$update public.profiles set display_name = 'Ana Silva' where id = '00000000-0000-0000-0000-00000000000a'$$,
  'ana@aal2: can update her own display_name'
);
select throws_ok(
  $$update public.profiles set app_role = 'platform_admin' where id = '00000000-0000-0000-0000-00000000000a'$$,
  '42501',
  null,
  'ana@aal2: CANNOT escalate her own app_role (column grant)'
);
-- updating someone else's row: RLS filters it out -> 0 rows affected, no error
select lives_ok(
  $$update public.profiles set display_name = 'hacked' where id = '00000000-0000-0000-0000-00000000000b'$$,
  'ana@aal2: update of another profile runs (RLS silently filters to 0 rows)'
);

select throws_ok(
  $$insert into public.companies (name, slug) values ('Evil', 'evil')$$,
  '42501',
  null,
  'ana@aal2: cannot insert companies directly'
);
select throws_ok(
  $$insert into public.company_members (company_id, user_id, status) values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'active')$$,
  '42501',
  null,
  'ana@aal2: cannot insert memberships directly'
);

select test_logout();

-- back as postgres: prove the cross-user update above really did nothing
select is(
  (select display_name from public.profiles where id = '00000000-0000-0000-0000-00000000000b'),
  'bruno',
  'bruno''s profile untouched by ana''s update attempt'
);

-- ---------------------------------------------------------------------------
-- ana @ AAL1: company data reads NOTHING (Phase 0 exit criterion)
-- ---------------------------------------------------------------------------

select test_login('00000000-0000-0000-0000-00000000000a', 'aal1');

select is((select count(*) from public.companies), 0::bigint, 'ana@aal1: zero companies');
select is((select count(*) from public.company_members), 0::bigint, 'ana@aal1: zero memberships');
select is((select count(*) from public.member_directory), 0::bigint, 'ana@aal1: empty directory');
select is(
  (select count(*) from public.profiles),
  1::bigint,
  'ana@aal1: own profile still reachable (needed for the 2FA enrollment screen)'
);

select test_logout();

-- ---------------------------------------------------------------------------
-- carla (INVITED, not active) @ AAL2: membership grants nothing yet
-- ---------------------------------------------------------------------------

select test_login('00000000-0000-0000-0000-00000000000c', 'aal2');

select is((select count(*) from public.companies), 0::bigint, 'carla@aal2 (invited): zero companies');
select is((select count(*) from public.company_members), 0::bigint, 'carla@aal2 (invited): zero memberships');

select test_logout();

-- ---------------------------------------------------------------------------
-- anon: nothing, ever
-- ---------------------------------------------------------------------------

set local role anon;
select throws_ok(
  'select count(*) from public.profiles',
  '42501',
  null,
  'anon: no grant on profiles at all'
);
select throws_ok(
  'select count(*) from public.member_directory',
  '42501',
  null,
  'anon: no grant on member_directory'
);
set local role postgres;

select * from finish();
rollback;
