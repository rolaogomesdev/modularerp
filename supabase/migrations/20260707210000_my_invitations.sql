-- my_invitations(): invitations addressed to the caller's email, visible in-app.
-- Closes the "lost invite link = stuck invitation" gap: the home screen lists
-- pending invitations so no link is required after the first sign-in.
-- The token is returned ONLY to its rightful invitee (email match) — the
-- column stays unreadable through the API for everyone else.

set check_function_bodies = off;

create or replace function public.my_invitations()
returns table (invite_token uuid, company_name text, invited_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select m.invite_token, c.name, m.created_at
  from public.company_members m
  join public.companies c on c.id = m.company_id
  where m.user_id is null
    and m.status = 'invited'
    and lower(m.invited_email) = lower(coalesce(auth.jwt()->>'email', ''))
    and public.auth_aal2()
    and c.deleted_at is null
  order by m.created_at desc
$$;

revoke execute on function public.my_invitations() from anon, public;
grant execute on function public.my_invitations() to authenticated;
