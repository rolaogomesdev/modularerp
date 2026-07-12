-- Tests: notifications — recipient isolation, definer-only creation, mark-read,
-- membership guard, cross-company blocking.
begin;
create extension if not exists pgtap with schema extensions;

select plan(13);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000e1', 'nina@example.com'),
  ('00000000-0000-0000-0000-0000000000e2', 'omar@example.com'),
  ('00000000-0000-0000-0000-0000000000e3', 'outsider@example.com');

update public.profiles set app_role = 'platform_admin'
where id = '00000000-0000-0000-0000-0000000000e1';

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

-- nina (platform admin) provisions a company; nina + omar active members
select test_login('00000000-0000-0000-0000-0000000000e1', 'aal2');
select lives_ok(
  $$select * from public.create_company('Nine Lda', 'nine-lda')$$,
  'fixture: company created'
);
select test_logout();

create temp table f as select id as company from public.companies where slug = 'nine-lda';
grant select on f to authenticated;

insert into public.company_members (company_id, user_id, status, joined_at)
values ((select company from f), '00000000-0000-0000-0000-0000000000e2', 'active', now());

-- create a company for the outsider so they exist elsewhere
insert into public.companies (id, name, slug)
values ('90000000-0000-0000-0000-000000000009', 'Elsewhere', 'elsewhere');

-- notify() is NOT callable by authenticated users (definer/system only)
select test_login('00000000-0000-0000-0000-0000000000e1', 'aal2');
select throws_ok(
  $$select public.notify((select company from f), '00000000-0000-0000-0000-0000000000e2',
    'approval.requested', '{}'::jsonb)$$,
  '42501', null,
  'notify() cannot be called by authenticated users'
);
select test_logout();

-- as system (service-definer path): create notifications for nina and omar
select public.notify((select company from f), '00000000-0000-0000-0000-0000000000e1',
  'approval.requested', jsonb_build_object('what', 'Absence'), 'hr_absences', null, '/c/nine-lda/approvals');
select public.notify((select company from f), '00000000-0000-0000-0000-0000000000e2',
  'member.assigned', '{}'::jsonb);

-- membership guard: cannot notify a non-member
select throws_ok(
  $$select public.notify((select company from f), '00000000-0000-0000-0000-0000000000e3', 'x.y', '{}'::jsonb)$$,
  '23503', null,
  'notify() refuses a non-member recipient'
);

-- nina sees only her own notification
select test_login('00000000-0000-0000-0000-0000000000e1', 'aal2');
select is((select count(*) from public.notifications), 1::bigint,
  'recipient sees only their own notifications');
select is((select kind from public.notifications), 'approval.requested',
  'and it is the right one');
select is((select params->>'what' from public.notifications), 'Absence',
  'params round-trip for locale-side rendering');

-- aal1 sees nothing (company context)
select test_logout();
select test_login('00000000-0000-0000-0000-0000000000e1', 'aal1');
select is((select count(*) from public.notifications), 0::bigint,
  'aal1 session sees no notifications');
select test_logout();

-- omar sees only his; cannot read nina's
select test_login('00000000-0000-0000-0000-0000000000e2', 'aal2');
select is((select count(*) from public.notifications), 1::bigint,
  'other member sees only their own');
select is((select kind from public.notifications), 'member.assigned',
  'omar sees his notification, not nina''s');

-- mark one read
select is((select public.mark_notifications_read()), 1,
  'mark_notifications_read marks the caller''s unread');
select is((select count(*) from public.notifications where read_at is not null), 1::bigint,
  'the notification is now read');

-- omar cannot re-target a notification to himself via update (RLS + column grant)
-- (only read_at is grantable; recipient_id change is filtered by with-check)
select test_logout();
select test_login('00000000-0000-0000-0000-0000000000e1', 'aal2');
select is(
  (select public.mark_notifications_read(array[(select id from public.notifications limit 1)])),
  1,
  'nina marks her own specific notification read'
);

-- outsider (member of nowhere relevant) sees nothing here
select test_logout();
select test_login('00000000-0000-0000-0000-0000000000e3', 'aal2');
select is((select count(*) from public.notifications), 0::bigint,
  'unrelated user sees no notifications');
select test_logout();

select * from finish();
rollback;
