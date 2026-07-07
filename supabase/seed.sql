-- Local development seed (applied by `supabase db reset` — never runs on
-- staging/prod; deploys only push migrations).
-- Personas from docs/architecture/00-overview.md: Marta (HR Manager),
-- João (Supervisor), Rita (Employee) — roles become real in Phase 1.
--
-- All three sign in with password: demo-password-123
-- (they still have to enroll TOTP on first login — mandatory 2FA is real
-- even for demo accounts).

-- deterministic ids so tests/tools can reference them
do $$
declare
  demo_users constant jsonb := '[
    {"id": "d0000000-0000-0000-0000-000000000001", "email": "marta@demo.example.com", "name": "Marta Ferreira"},
    {"id": "d0000000-0000-0000-0000-000000000002", "email": "joao@demo.example.com",  "name": "João Santos"},
    {"id": "d0000000-0000-0000-0000-000000000003", "email": "rita@demo.example.com",  "name": "Rita Costa"}
  ]';
  u jsonb;
  demo_company_id constant uuid := 'd0000000-0000-0000-0000-00000000c001';
begin
  for u in select * from jsonb_array_elements(demo_users) loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      -- GoTrue chokes on NULLs in these ("Database error querying schema")
      confirmation_token, recovery_token, email_change, email_change_token_new,
      email_change_token_current, phone_change, phone_change_token,
      reauthentication_token
    ) values (
      '00000000-0000-0000-0000-000000000000',
      (u->>'id')::uuid,
      'authenticated',
      'authenticated',
      u->>'email',
      extensions.crypt('demo-password-123', extensions.gen_salt('bf')),
      now(),
      '{"provider": "email", "providers": ["email"]}',
      jsonb_build_object('display_name', u->>'name', 'locale', 'pt-PT'),
      now(),
      now(),
      '', '', '', '', '', '', '', ''
    );

    insert into auth.identities (
      id, user_id, provider_id, provider, identity_data,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(),
      (u->>'id')::uuid,
      u->>'id',
      'email',
      jsonb_build_object('sub', u->>'id', 'email', u->>'email', 'email_verified', true),
      now(),
      now(),
      now()
    );
  end loop;

  insert into public.companies (id, name, slug)
  values (demo_company_id, 'Demo Lda', 'demo');

  insert into public.company_members (company_id, user_id, status, joined_at)
  select demo_company_id, (du->>'id')::uuid, 'active', now()
  from jsonb_array_elements(demo_users) as du;
end;
$$;
