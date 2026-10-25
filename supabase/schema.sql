-- =============================================================
-- Vault database schema (Supabase / Postgres)
-- Paste into Supabase → SQL Editor → New query → Run.
-- Safe to run again: uses IF NOT EXISTS / CREATE OR REPLACE / DROP ... IF EXISTS.
-- The server only ever stores ciphertext. Never add plaintext columns.
-- =============================================================

-- Helper schema for functions that must not be exposed through the Data API.
create schema if not exists private;
grant usage on schema private to authenticated;

-- ---------- Tables ----------

-- One row per user: KDF parameters + two wrapped copies of the vault key.
create table if not exists public.vault_keys (
  user_id                 uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  kdf_algorithm           text    not null default 'argon2id' check (kdf_algorithm = 'argon2id'),
  kdf_salt                text    not null check (char_length(kdf_salt) between 22 and 64),
  kdf_memory_kib          integer not null check (kdf_memory_kib between 19456 and 1048576),
  kdf_iterations          integer not null check (kdf_iterations between 2 and 50),
  kdf_parallelism         integer not null check (kdf_parallelism between 1 and 16),
  wrapped_key             text    not null check (char_length(wrapped_key) between 40 and 200),
  wrapped_key_iv          text    not null check (char_length(wrapped_key_iv) = 16),
  recovery_wrapped_key    text    not null check (char_length(recovery_wrapped_key) between 40 and 200),
  recovery_wrapped_key_iv text    not null check (char_length(recovery_wrapped_key_iv) = 16),
  key_version             integer not null default 1 check (key_version >= 1),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- One row per encrypted item. Everything readable lives inside ciphertext.
create table if not exists public.vault_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  ciphertext  text not null check (char_length(ciphertext) between 24 and 400000),
  iv          text not null check (char_length(iv) = 16),
  enc_version smallint not null default 1 check (enc_version >= 1),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists vault_items_user_updated_idx
  on public.vault_items (user_id, updated_at desc);

-- Optional passkey quick-unlock wrappers (one per enrolled device).
create table if not exists public.vault_passkeys (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  credential_id  text not null check (char_length(credential_id) between 16 and 1024),
  prf_salt       text not null check (char_length(prf_salt) between 40 and 64),
  wrapped_key    text not null check (char_length(wrapped_key) between 40 and 200),
  wrapped_key_iv text not null check (char_length(wrapped_key_iv) = 16),
  label          text not null default 'This device' check (char_length(label) between 1 and 60),
  created_at     timestamptz not null default now(),
  last_used_at   timestamptz,
  unique (user_id, credential_id)
);

-- ---------- Helper functions ----------

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Keeps one account from filling the free database.
create or replace function private.enforce_vault_item_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.vault_items where user_id = new.user_id) >= 5000 then
    raise exception 'Vault item limit reached (5000 items)';
  end if;
  return new;
end;
$$;

-- True when the user has no verified MFA factor, or has one and this session is aal2.
create or replace function private.mfa_requirement_met()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (
      select 1 from auth.mfa_factors f
      where f.user_id = auth.uid() and f.status = 'verified'
    )
    then coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
    else true
  end;
$$;

revoke all on function private.mfa_requirement_met() from public;
grant execute on function private.mfa_requirement_met() to authenticated;

-- ---------- Triggers ----------

drop trigger if exists vault_keys_set_updated_at on public.vault_keys;
create trigger vault_keys_set_updated_at
  before update on public.vault_keys
  for each row execute function private.set_updated_at();

drop trigger if exists vault_items_set_updated_at on public.vault_items;
create trigger vault_items_set_updated_at
  before update on public.vault_items
  for each row execute function private.set_updated_at();

drop trigger if exists vault_items_enforce_limit on public.vault_items;
create trigger vault_items_enforce_limit
  before insert on public.vault_items
  for each row execute function private.enforce_vault_item_limit();

-- ---------- Privileges ----------

revoke all on table public.vault_keys, public.vault_items, public.vault_passkeys from anon, authenticated;
grant select, insert, update, delete on table public.vault_keys, public.vault_items, public.vault_passkeys to authenticated;

-- ---------- Row Level Security ----------
-- Owner-only access, plus a restrictive policy: users who enabled two-factor
-- sign-in must have an aal2 session before they can read or write anything.

do $$
declare
  t text;
begin
  foreach t in array array['vault_keys', 'vault_items', 'vault_passkeys'] loop
    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists owner_select on public.%I', t);
    execute format('create policy owner_select on public.%I for select to authenticated using ((select auth.uid()) = user_id)', t);

    execute format('drop policy if exists owner_insert on public.%I', t);
    execute format('create policy owner_insert on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', t);

    execute format('drop policy if exists owner_update on public.%I', t);
    execute format('create policy owner_update on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);

    execute format('drop policy if exists owner_delete on public.%I', t);
    execute format('create policy owner_delete on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', t);

    execute format('drop policy if exists mfa_required on public.%I', t);
    execute format('create policy mfa_required on public.%I as restrictive for all to authenticated using ((select private.mfa_requirement_met())) with check ((select private.mfa_requirement_met()))', t);
  end loop;
end
$$;

-- ---------- Account deletion (called from Settings) ----------

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not signed in';
  end if;
  if not private.mfa_requirement_met() then
    raise exception 'Two-factor verification required';
  end if;
  -- Cascades to vault_keys, vault_items and vault_passkeys.
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
