-- Phase 1 (admin UI support): suspend/reactivate members via RLS-gated update.
-- Suspension is instant revocation: authorize() checks cm.status = 'active',
-- so a suspended member loses every permission the moment the row flips.

-- Only real members (not invitation rows) can be updated, only between
-- active/suspended, and only by platform.member.manage holders.
create policy company_members_update_manage
  on public.company_members for update to authenticated
  using (
    user_id is not null
    and (select public.authorize('platform.member.manage', company_id))
  )
  with check (
    user_id is not null
    and status in ('active', 'suspended')
    and (select public.authorize('platform.member.manage', company_id))
  );

-- column-limited: status only (identity/email/token columns stay immutable)
grant update (status) on table public.company_members to authenticated;

-- Membership removal support for the admin UI is already covered by
-- team_memberships_delete_manage (permissions core migration).
