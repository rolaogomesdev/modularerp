-- Personal profile: avatar storage (02-tenancy-and-identity.md — the profile,
-- including the avatar, belongs to the person).
-- Bucket is public-read (avatars render in directories without signed URLs);
-- writes are locked to the owner's folder: avatars/<auth.uid()>/...

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152, -- 2 MB
  array['image/png', 'image/jpeg', 'image/webp', 'image/avif']
)
on conflict (id) do nothing;

-- NO select policy on purpose: the public-bucket flag serves objects by URL
-- without RLS, and a bucket-wide select policy would let anyone LIST the
-- bucket — enumerating every user's UUID (folder names). Listing stays closed.

create policy avatars_insert_own_folder
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy avatars_update_own_folder
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy avatars_delete_own_folder
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
