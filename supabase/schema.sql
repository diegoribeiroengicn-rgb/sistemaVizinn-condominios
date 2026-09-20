-- Vizinn: schema for the "condominios" table.
-- Run this in the Supabase SQL editor for your project.

create table if not exists public.condominios (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  owner_email text,
  nome text not null,
  cnpj text,
  endereco text,
  responsavel_nome text,
  responsavel_telefone text,
  plano text not null default 'growth' check (plano in ('starter', 'growth', 'pro')),
  unidades_limite integer not null default 100,
  unidades_ativas integer not null default 0,
  stripe_customer_id text,
  stripe_subscription_id text,
  status text not null default 'trialing',
  created_at timestamptz not null default now()
);

-- Safe to re-run: adds the column if this script already ran before it existed.
alter table public.condominios add column if not exists owner_email text;

create unique index if not exists condominios_owner_id_key on public.condominios (owner_id);
create index if not exists condominios_stripe_subscription_id_idx
  on public.condominios (stripe_subscription_id);

alter table public.condominios enable row level security;

-- Owners can read and update their own condominio.
-- Row creation on signup is done server-side with the service role key
-- (see /app/api/complete-signup), which bypasses RLS by design.
create policy "Owners can view their condominio"
  on public.condominios for select
  using (auth.uid() = owner_id);

create policy "Owners can update their condominio"
  on public.condominios for update
  using (auth.uid() = owner_id);

-- The platform admin dashboard (/admin) reads through the service role key
-- server-side (see /app/api/admin), which bypasses RLS by design — no
-- extra policy is needed for the owner to see every condominio.
