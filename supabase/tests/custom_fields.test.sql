-- Tests: custom_field_defs — member reads, manager writes, identity immutable,
-- cross-company isolation, Owner backfill.
-- Personas: zed (platform_admin → Owner of his company), yan (plain member).
begin;
create extension if not exists pgtap with schema extensions;

select plan(9);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000c01', 'zed@example.com'),
  ('00000000-0000-0000-0000-000000000c02', 'yan@example.com');

update public.profiles set app_role = 'platform_admin'
where id = '00000000-0000-0000-0000-000000000c01';

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

-- zed creates a company (becomes Owner) — backfill means Owner holds the perm
select test_login('00000000-0000-0000-0000-000000000c01', 'aal2');
select lives_ok(
  $$select * from public.create_company('Fields Co', 'fields-co')$$,
  'fixture: company created, creator is Owner');
select is(
  (select public.authorize('platform.customfield.manage',
    (select id from public.companies where slug = 'fields-co'))),
  true, 'Owner holds platform.customfield.manage (seeded into the template)');
select test_logout();

create temp table f as select id as company from public.companies where slug = 'fields-co';
grant select on f to authenticated;

insert into public.company_members (company_id, user_id, status, joined_at)
values ((select company from f), '00000000-0000-0000-0000-000000000c02', 'active', now());

-- Owner defines a field
select test_login('00000000-0000-0000-0000-000000000c01', 'aal2');
select lives_ok(
  $$insert into public.custom_field_defs (company_id, entity, key, label, type, config)
    values ((select company from f), 'hr_employees', 'cost_center',
            jsonb_build_object('en', 'Cost centre', 'pt-PT', 'Centro de custo'),
            'text', jsonb_build_object('required', true))$$,
  'manager defines a custom field');
-- can edit label/config/position
select lives_ok(
  $$update public.custom_field_defs set position = 5
    where company_id = (select company from f) and key = 'cost_center'$$,
  'manager edits mutable attributes');
-- CANNOT change identity (key/entity/type frozen)
select throws_ok(
  $$update public.custom_field_defs set key = 'renamed'
    where company_id = (select company from f) and key = 'cost_center'$$,
  '42501', null,
  'a field''s key is immutable');
select throws_ok(
  $$update public.custom_field_defs set type = 'number'
    where company_id = (select company from f) and key = 'cost_center'$$,
  '42501', null,
  'a field''s type is immutable');
select test_logout();

-- plain member: can READ defs, cannot WRITE
select test_login('00000000-0000-0000-0000-000000000c02', 'aal2');
select is((select count(*) from public.custom_field_defs), 1::bigint,
  'active member reads the field defs (forms need them)');
select throws_ok(
  $$insert into public.custom_field_defs (company_id, entity, key, label, type)
    values ((select company from f), 'hr_employees', 'secret',
            jsonb_build_object('en', 'x'), 'text')$$,
  '42501', null,
  'a member without the permission cannot define fields');
select test_logout();

-- another company cannot see these defs
insert into public.companies (id, name, slug)
values ('c0000000-0000-0000-0000-000000000009', 'Other Co', 'other-co');
insert into public.company_members (company_id, user_id, status, joined_at)
values ('c0000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000c02', 'active', now());
-- yan is a member of Other Co but the def belongs to Fields Co
select test_login('00000000-0000-0000-0000-000000000c02', 'aal2');
select is(
  (select count(*) from public.custom_field_defs
   where company_id = 'c0000000-0000-0000-0000-000000000009'),
  0::bigint, 'no field defs leak across companies');
select test_logout();

select * from finish();
rollback;
