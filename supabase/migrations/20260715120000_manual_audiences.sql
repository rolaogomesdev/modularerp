-- /help audience resolver: which manual audiences apply to the calling user, so
-- the in-app manual can filter pages to what's relevant (04-module-system.md:
-- "assistant retrieval filters by the asking user's audience and permissions").
-- Pure read helper — no table, so no RLS surface; it only ever sees the caller's
-- own memberships (auth.uid()).

set check_function_bodies = off;

create or replace function public.my_manual_audiences()
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select array_remove(array[
    'member',
    case when exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.app_role = 'platform_admin'
    ) then 'platform-admin' end,
    case when exists (
      select 1
      from public.team_memberships tm
      join public.company_members cm on cm.id = tm.member_id
        and cm.user_id = (select auth.uid()) and cm.status = 'active'
      join public.role_permissions rp on rp.company_role_id = tm.company_role_id
      where rp.permission_key in
              ('platform.role.manage', 'platform.member.manage', 'platform.team.manage')
        and now() >= tm.valid_from and (tm.valid_to is null or now() < tm.valid_to)
    ) then 'company-admin' end,
    case when exists (
      select 1
      from public.team_memberships tm
      join public.company_members cm on cm.id = tm.member_id
        and cm.user_id = (select auth.uid()) and cm.status = 'active'
      join public.role_permissions rp on rp.company_role_id = tm.company_role_id
      where rp.scope = 'team'
        and now() >= tm.valid_from and (tm.valid_to is null or now() < tm.valid_to)
    ) then 'team-manager' end
  ], null);
$$;

revoke execute on function public.my_manual_audiences() from anon, public;
grant execute on function public.my_manual_audiences() to authenticated;
