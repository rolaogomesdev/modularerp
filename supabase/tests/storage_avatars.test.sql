-- Tests: avatars bucket — public read, writes locked to the owner's folder
begin;
create extension if not exists pgtap with schema extensions;

select plan(6);

insert into auth.users (id, email)
values
  ('00000000-0000-0000-0000-0000000000a9', 'ivo@example.com'),
  ('00000000-0000-0000-0000-0000000000b9', 'lia@example.com');

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

select test_login('00000000-0000-0000-0000-0000000000a9', 'aal2');
select lives_ok(
  $$insert into storage.objects (bucket_id, name, owner_id)
    values ('avatars', '00000000-0000-0000-0000-0000000000a9/avatar.png', '00000000-0000-0000-0000-0000000000a9')$$,
  'user can write into their own avatar folder'
);
select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id)
    values ('avatars', '00000000-0000-0000-0000-0000000000b9/avatar.png', '00000000-0000-0000-0000-0000000000a9')$$,
  '42501', null,
  'writing into someone else''s folder is denied'
);
select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id)
    values ('avatars', 'avatar.png', '00000000-0000-0000-0000-0000000000a9')$$,
  '42501', null,
  'writing outside a folder is denied'
);
select test_logout();

-- listing is CLOSED: no select policy — anon (or anyone via the list API)
-- cannot enumerate user folders; object delivery uses the public-bucket URL
-- path, which bypasses RLS by design.
set local role anon;
select is(
  (select count(*) from storage.objects
   where bucket_id = 'avatars'
     and name = '00000000-0000-0000-0000-0000000000a9/avatar.png'),
  0::bigint,
  'bucket listing is not enumerable (no select policy)'
);
set local role postgres;

-- lia cannot delete ivo's avatar (direct SQL deletes are blocked platform-wide;
-- the Storage API is the only delete door and it consults our delete policy)
select test_login('00000000-0000-0000-0000-0000000000b9', 'aal2');
select throws_ok(
  $$delete from storage.objects where bucket_id = 'avatars' and name = '00000000-0000-0000-0000-0000000000a9/avatar.png'$$,
  '42501', null,
  'direct SQL deletes on storage are blocked for everyone'
);
select test_logout();
select is(
  (select count(*) from storage.objects
   where bucket_id = 'avatars'
     and name = '00000000-0000-0000-0000-0000000000a9/avatar.png'),
  1::bigint,
  'the object survived the foreign delete attempt'
);

select * from finish();
rollback;
