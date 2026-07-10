-- Tests: role templates at company creation + Owner bootstrap + backfill idempotency
begin;
create extension if not exists pgtap with schema extensions;

select plan(10);

insert into auth.users (id, email)
values
  ('00000000-0000-0000-0000-0000000000a4', 'ugo@example.com'),
  ('00000000-0000-0000-0000-0000000000b4', 'rui@example.com');

-- ADR-0004: company creation requires platform_admin - promote the founder persona
update public.profiles set app_role = 'platform_admin'
where id = '00000000-0000-0000-0000-0000000000a4';

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

-- ugo creates a company: templates + team + Owner assignment happen atomically
select test_login('00000000-0000-0000-0000-0000000000a4', 'aal2');
select lives_ok(
  $$select * from public.create_company('Talho Ugo', 'talho-ugo')$$,
  'create_company succeeds'
);

create temp table cc as select id from public.companies where slug = 'talho-ugo';
grant select on cc to authenticated;

select is(
  (select count(*) from public.company_roles where company_id = (select id from cc) and template_key is not null),
  5::bigint, 'five template roles created with the company'
);
select is(
  (select count(*) from public.teams where company_id = (select id from cc) and name = 'Geral'),
  1::bigint, 'default team created'
);
select is(
  (select public.authorize('platform.role.manage', (select id from cc))),
  true, 'creator holds platform.role.manage (Owner)'
);
select is(
  (select public.authorize('platform.company.update', (select id from cc))),
  true, 'creator holds platform.company.update (Owner)'
);
select cmp_ok(
  (select count(*) from public.role_permissions rp
   join public.company_roles r on r.id = rp.company_role_id
   where r.company_id = (select id from cc) and r.template_key = 'owner'),
  '>=', 6::bigint,
  'Owner granted every company-scopable catalog permission'
);
select test_logout();

-- a second active member has no powers until assigned
insert into public.company_members (company_id, user_id, status, joined_at)
values ((select id from cc), '00000000-0000-0000-0000-0000000000b4', 'active', now());

select test_login('00000000-0000-0000-0000-0000000000b4', 'aal2');
select is(
  (select public.authorize('platform.role.manage', (select id from cc))),
  false, 'plain member holds nothing until a role is assigned'
);
select is(
  (select count(*) from public.company_roles where company_id = (select id from cc)),
  5::bigint, 'plain member can still SEE the roles (matrix UI)'
);
select test_logout();

-- bootstrap is idempotent (backfill can run over an already-seeded company)
select lives_ok(
  $$select public.bootstrap_company_owner(
      (select id from cc),
      (select id from public.company_members where company_id = (select id from cc) and user_id = '00000000-0000-0000-0000-0000000000a4'),
      '00000000-0000-0000-0000-0000000000a4')$$,
  'bootstrap runs again without error'
);
select is(
  (select count(*) from public.company_roles where company_id = (select id from cc)),
  5::bigint, 'no duplicate roles after re-bootstrap'
);

select * from finish();
rollback;
