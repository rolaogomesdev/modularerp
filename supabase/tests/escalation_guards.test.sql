-- Tests: escalation guards — self-promotion and last-Owner lockout attacks
-- Personas: bea (Owner), carlos (limited manager — the attacker)
begin;
create extension if not exists pgtap with schema extensions;

select plan(16);

insert into auth.users (id, email)
values
  ('00000000-0000-0000-0000-0000000000a7', 'bea@example.com'),
  ('00000000-0000-0000-0000-0000000000b7', 'carlos@example.com');

-- ADR-0004: company creation requires platform_admin - promote the founder persona
update public.profiles set app_role = 'platform_admin'
where id = '00000000-0000-0000-0000-0000000000a7';

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

-- throwaway catalog key with all scopes (rolled back with the transaction)
insert into public.permissions (key, module, resource, action, allowed_scopes, description)
values ('test.doc.read', 'test', 'doc', 'read', '{own,team,company}', 'test fixture');

-- guards must not break company creation (bootstrap bypass works)
select test_login('00000000-0000-0000-0000-0000000000a7', 'aal2');
select lives_ok(
  $$select * from public.create_company('Vidraria Bea', 'vidraria-bea')$$,
  'create_company still works with guards active (bootstrap bypass)'
);
select test_logout();

create temp table f as
  select c.id as company,
         (select id from public.teams t where t.company_id = c.id and t.name = 'Geral') as team,
         (select id from public.company_roles r where r.company_id = c.id and r.template_key = 'owner') as owner_role
  from public.companies c where c.slug = 'vidraria-bea';
grant select on f to authenticated;

insert into public.company_members (id, company_id, user_id, status, joined_at)
values ('71000000-0000-0000-0000-000000000001', (select company from f), '00000000-0000-0000-0000-0000000000b7', 'active', now());

-- bea (Owner) builds carlos a limited manager role: role.manage + member.manage + test.doc.read:team
select test_login('00000000-0000-0000-0000-0000000000a7', 'aal2');
select lives_ok(
  $$insert into public.company_roles (id, company_id, name)
    values ('72000000-0000-0000-0000-000000000001', (select company from f), 'Gestor')$$,
  'owner creates a custom role'
);
select lives_ok(
  $$insert into public.role_permissions (company_role_id, permission_key, scope) values
    ('72000000-0000-0000-0000-000000000001', 'platform.role.manage', 'company'),
    ('72000000-0000-0000-0000-000000000001', 'platform.member.manage', 'company'),
    ('72000000-0000-0000-0000-000000000001', 'test.doc.read', 'team')$$,
  'owner grants what she holds (holds everything)'
);
select lives_ok(
  $$insert into public.team_memberships (company_id, team_id, member_id, company_role_id, created_by)
    values ((select company from f), (select team from f), '71000000-0000-0000-0000-000000000001',
            '72000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a7')$$,
  'owner assigns the role (holds a superset)'
);
select test_logout();

-- ATTACK 1: carlos (role.manage holder) grants himself something he lacks
select test_login('00000000-0000-0000-0000-0000000000b7', 'aal2');
select throws_ok(
  $$insert into public.role_permissions (company_role_id, permission_key, scope)
    values ('72000000-0000-0000-0000-000000000001', 'platform.company.update', 'company')$$,
  '42501', null,
  'ATTACK: cannot grant a permission you do not hold'
);
-- ATTACK 2: scope upgrade — holds test.doc.read:team, grants :company
select throws_ok(
  $$insert into public.role_permissions (company_role_id, permission_key, scope)
    values ('72000000-0000-0000-0000-000000000001', 'test.doc.read', 'company')$$,
  '42501', null,
  'ATTACK: cannot upgrade a scope beyond what you hold'
);
-- held permission at held scope is fine (new role he manages)
select lives_ok(
  $$insert into public.company_roles (id, company_id, name)
    values ('72000000-0000-0000-0000-000000000002', (select company from f), 'Leitor')$$,
  'limited manager can create roles'
);
select lives_ok(
  $$insert into public.role_permissions (company_role_id, permission_key, scope)
    values ('72000000-0000-0000-0000-000000000002', 'test.doc.read', 'team')$$,
  'granting what you hold at the scope you hold is allowed'
);
-- ATTACK 3: assign himself the Owner role (member.manage holder)
select throws_ok(
  $$insert into public.team_memberships (company_id, team_id, member_id, company_role_id, created_by)
    values ((select company from f), (select team from f), '71000000-0000-0000-0000-000000000001',
            (select owner_role from f), '00000000-0000-0000-0000-0000000000b7')$$,
  '42501', null,
  'ATTACK: cannot assign a role whose permissions exceed yours (Owner)'
);
-- ATTACK 4: weaken the Owner role itself
select throws_ok(
  $$delete from public.role_permissions
    where company_role_id = (select owner_role from f) and permission_key = 'platform.role.manage'$$,
  'PT001', null,
  'ATTACK: the Owner role''s grants are immutable'
);
select test_logout();

-- ATTACK 5: last-Owner lockout paths (bea is the only Owner)
select test_login('00000000-0000-0000-0000-0000000000a7', 'aal2');
select throws_ok(
  $$delete from public.team_memberships
    where company_role_id = (select owner_role from f)$$,
  'PT001', null,
  'ATTACK: deleting the last Owner membership is refused'
);
select throws_ok(
  $$update public.team_memberships set valid_to = now() - interval '1 hour'
    where company_role_id = (select owner_role from f)$$,
  'PT001', null,
  'ATTACK: expiring the last Owner membership is refused'
);
select throws_ok(
  $$update public.company_roles set deleted_at = now()
    where id = (select owner_role from f)$$,
  'PT001', null,
  'ATTACK: soft-deleting the Owner role is refused'
);
select throws_ok(
  $$update public.company_members set status = 'suspended'
    where company_id = (select company from f) and user_id = '00000000-0000-0000-0000-0000000000a7'$$,
  'PT001', null,
  'ATTACK: suspending the last Owner is refused'
);

-- with a second Owner, handover works
select lives_ok(
  $$insert into public.team_memberships (company_id, team_id, member_id, company_role_id, created_by)
    values ((select company from f), (select team from f), '71000000-0000-0000-0000-000000000001',
            (select owner_role from f), '00000000-0000-0000-0000-0000000000a7')$$,
  'owner promotes a second Owner'
);
select lives_ok(
  $$delete from public.team_memberships tm
    using public.company_members cm
    where tm.member_id = cm.id
      and tm.company_role_id = (select owner_role from f)
      and cm.user_id = '00000000-0000-0000-0000-0000000000a7'$$,
  'first owner can now step down (not the last anymore)'
);
select test_logout();

select * from finish();
rollback;
