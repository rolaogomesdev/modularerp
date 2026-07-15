-- Tests: my_manual_audiences() — the /help audience resolver.
begin;
create extension if not exists pgtap with schema extensions;

select plan(7);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a7', 'xavi@example.com'),  -- platform_admin + Owner
  ('00000000-0000-0000-0000-0000000000b7', 'yara@example.com');  -- plain member

update public.profiles set app_role = 'platform_admin'
where id = '00000000-0000-0000-0000-0000000000a7';

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

-- xavi creates company A (Owner → holds platform.role.manage at company scope).
select test_login('00000000-0000-0000-0000-0000000000a7', 'xavi@example.com', 'aal2');
select lives_ok($$select * from public.create_company('Padel', 'padel-help')$$, 'fixture: company A');  -- 1
create temp table ca as select id from public.companies where slug = 'padel-help';
grant select on ca to authenticated;

select ok('platform-admin' = any (public.my_manual_audiences()),
  'platform_admin resolves the platform-admin audience');                                   -- 2
select ok('company-admin' = any (public.my_manual_audiences()),
  'an Owner (platform.role.manage) resolves company-admin');                                -- 3

-- yara joins as a plain member (no role).
select lives_ok($$select public.invite_member((select id from ca), 'yara@example.com')$$, 'fixture: invite yara'); -- 4
select test_logout();
create temp table tk as select invite_token from public.company_members
  where company_id = (select id from ca) and invited_email = 'yara@example.com';
grant select on tk to authenticated;

select test_login('00000000-0000-0000-0000-0000000000b7', 'yara@example.com', 'aal2');
select lives_ok($$select public.accept_invitation((select invite_token from tk))$$, 'fixture: yara joins'); -- 5
select is(public.my_manual_audiences(), array['member']::text[],
  'a plain member resolves member only');                                                   -- 6

-- Give yara a team-scoped grant → team-manager appears.
select test_logout();
insert into public.company_roles (id, company_id, name, template_key)
  values ('00000000-0000-0000-0000-00000000c001', (select id from ca), 'Lead', null);
insert into public.role_permissions (company_role_id, permission_key, scope)
  values ('00000000-0000-0000-0000-00000000c001', 'hr.absence.approve', 'team');
insert into public.team_memberships (company_id, team_id, member_id, company_role_id, created_by)
  select (select id from ca),
         (select id from public.teams where company_id = (select id from ca) and name = 'Geral'),
         (select id from public.company_members where company_id = (select id from ca)
            and user_id = '00000000-0000-0000-0000-0000000000b7'),
         '00000000-0000-0000-0000-00000000c001',
         '00000000-0000-0000-0000-0000000000a7';

select test_login('00000000-0000-0000-0000-0000000000b7', 'yara@example.com', 'aal2');
select ok('team-manager' = any (public.my_manual_audiences()),
  'a team-scoped grant resolves team-manager');                                             -- 7

select test_logout();
select * from finish();
rollback;
