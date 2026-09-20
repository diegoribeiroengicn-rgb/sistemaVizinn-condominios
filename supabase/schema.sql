-- Vizinn: full schema, run this in the Supabase SQL editor for your project.
--
-- IMPORTANT: tables created via the SQL editor (unlike the Table Editor UI)
-- do NOT automatically get base privileges for Supabase's "authenticated"
-- role — only RLS policies. Without the GRANTs below, every query from a
-- logged-in user fails with "permission denied for table X" even when RLS
-- would otherwise allow it. This script grants exactly what each table's
-- policies need, nothing more (e.g. no DELETE grant on a table nothing
-- ever deletes from).

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
  access_note text,
  courtesy_until date,
  created_at timestamptz not null default now()
);

-- status is intentionally free-form (not a check constraint) so the admin
-- panel can use platform-specific values alongside Stripe's own
-- subscription statuses:
--   Stripe-driven:  active, trialing, past_due, unpaid, incomplete,
--                    incomplete_expired, canceled
--   Admin-driven:   suspended  — access paused by the owner (Stripe
--                                subscription collection paused too, if any)
--                   promessa   — manually released, payment pending/trusted
--                   cortesia   — free complimentary access (see courtesy_until)

-- Safe to re-run: adds the columns if this script already ran before they existed.
alter table public.condominios add column if not exists owner_email text;
alter table public.condominios add column if not exists access_note text;
alter table public.condominios add column if not exists courtesy_until date;

create unique index if not exists condominios_owner_id_key on public.condominios (owner_id);
create index if not exists condominios_stripe_subscription_id_idx
  on public.condominios (stripe_subscription_id);

alter table public.condominios enable row level security;

-- Owners can read and update their own condominio.
-- Row creation on signup is done server-side with the service role key
-- (see /app/api/complete-signup), which bypasses RLS by design.
-- Drop-then-create makes this script safe to run more than once.
drop policy if exists "Owners can view their condominio" on public.condominios;
create policy "Owners can view their condominio"
  on public.condominios for select
  using (auth.uid() = owner_id);

drop policy if exists "Owners can update their condominio" on public.condominios;
create policy "Owners can update their condominio"
  on public.condominios for update
  using (auth.uid() = owner_id);

-- The platform admin dashboard (/admin) reads through the service role key
-- server-side (see /app/api/admin), which bypasses RLS by design — no
-- extra policy is needed for the owner to see every condominio.

grant select, update on public.condominios to authenticated;

-- Chamados (support tickets), scoped to one condominio.
create table if not exists public.chamados (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios (id) on delete cascade,
  titulo text not null,
  descricao text,
  unidade text,
  status text not null default 'aberto' check (status in ('aberto', 'em_andamento', 'resolvido')),
  created_at timestamptz not null default now()
);

create index if not exists chamados_condominio_id_idx on public.chamados (condominio_id);

alter table public.chamados enable row level security;

drop policy if exists "Owners can view their chamados" on public.chamados;
create policy "Owners can view their chamados"
  on public.chamados for select
  using (exists (
    select 1 from public.condominios c
    where c.id = chamados.condominio_id and c.owner_id = auth.uid()
  ));

drop policy if exists "Owners can insert their chamados" on public.chamados;
create policy "Owners can insert their chamados"
  on public.chamados for insert
  with check (exists (
    select 1 from public.condominios c
    where c.id = chamados.condominio_id and c.owner_id = auth.uid()
  ));

drop policy if exists "Owners can update their chamados" on public.chamados;
create policy "Owners can update their chamados"
  on public.chamados for update
  using (exists (
    select 1 from public.condominios c
    where c.id = chamados.condominio_id and c.owner_id = auth.uid()
  ));

grant select, insert, update on public.chamados to authenticated;

-- Avisos (announcements), scoped to one condominio.
create table if not exists public.avisos (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios (id) on delete cascade,
  titulo text not null,
  mensagem text not null,
  created_at timestamptz not null default now()
);

create index if not exists avisos_condominio_id_idx on public.avisos (condominio_id);

alter table public.avisos enable row level security;

drop policy if exists "Owners can view their avisos" on public.avisos;
create policy "Owners can view their avisos"
  on public.avisos for select
  using (exists (
    select 1 from public.condominios c
    where c.id = avisos.condominio_id and c.owner_id = auth.uid()
  ));

drop policy if exists "Owners can insert their avisos" on public.avisos;
create policy "Owners can insert their avisos"
  on public.avisos for insert
  with check (exists (
    select 1 from public.condominios c
    where c.id = avisos.condominio_id and c.owner_id = auth.uid()
  ));

drop policy if exists "Owners can delete their avisos" on public.avisos;
create policy "Owners can delete their avisos"
  on public.avisos for delete
  using (exists (
    select 1 from public.condominios c
    where c.id = avisos.condominio_id and c.owner_id = auth.uid()
  ));

grant select, insert, delete on public.avisos to authenticated;

-- Membros: delimited sub-accounts the síndico grants access to. The
-- condominio owner (condominios.owner_id) already has full access and is
-- NOT a row here — this table is only for roles the síndico explicitly
-- creates: condômino (read-only, own unit), porteiro (ocorrências),
-- conselheiro (approve/reject propostas).
create table if not exists public.membros (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  nome text not null,
  email text not null,
  papel text not null check (papel in ('condomino', 'porteiro', 'conselheiro')),
  unidade text,
  created_at timestamptz not null default now()
);

create unique index if not exists membros_user_id_key on public.membros (user_id);
create index if not exists membros_condominio_id_idx on public.membros (condominio_id);

alter table public.membros enable row level security;

drop policy if exists "Owners can view their membros" on public.membros;
create policy "Owners can view their membros"
  on public.membros for select
  using (
    exists (
      select 1 from public.condominios c
      where c.id = membros.condominio_id and c.owner_id = auth.uid()
    )
    or user_id = auth.uid()
  );

drop policy if exists "Owners can delete their membros" on public.membros;
create policy "Owners can delete their membros"
  on public.membros for delete
  using (exists (
    select 1 from public.condominios c
    where c.id = membros.condominio_id and c.owner_id = auth.uid()
  ));

grant select, delete on public.membros to authenticated;

-- Members (não-owners) also need to read the condominio they belong to.
-- Postgres OR's multiple permissive policies for the same command, so this
-- adds to (doesn't replace) "Owners can view their condominio" above.
drop policy if exists "Members can view their condominio" on public.condominios;
create policy "Members can view their condominio"
  on public.condominios for select
  using (exists (
    select 1 from public.membros m
    where m.condominio_id = condominios.id and m.user_id = auth.uid()
  ));

-- Every member (any papel) can read avisos — same idea, additive policy.
drop policy if exists "Members can view avisos" on public.avisos;
create policy "Members can view avisos"
  on public.avisos for select
  using (exists (
    select 1 from public.membros m
    where m.condominio_id = avisos.condominio_id and m.user_id = auth.uid()
  ));

-- Ocorrências: portaria log. Registered by porteiro (or the síndico),
-- visible to the síndico and porteiros of that condominio.
create table if not exists public.ocorrencias (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios (id) on delete cascade,
  titulo text not null,
  descricao text,
  registrado_por text,
  created_at timestamptz not null default now()
);

create index if not exists ocorrencias_condominio_id_idx on public.ocorrencias (condominio_id);

alter table public.ocorrencias enable row level security;

drop policy if exists "Owners and porteiros can view ocorrencias" on public.ocorrencias;
create policy "Owners and porteiros can view ocorrencias"
  on public.ocorrencias for select
  using (
    exists (
      select 1 from public.condominios c
      where c.id = ocorrencias.condominio_id and c.owner_id = auth.uid()
    )
    or exists (
      select 1 from public.membros m
      where m.condominio_id = ocorrencias.condominio_id
        and m.user_id = auth.uid() and m.papel = 'porteiro'
    )
  );

drop policy if exists "Owners and porteiros can insert ocorrencias" on public.ocorrencias;
create policy "Owners and porteiros can insert ocorrencias"
  on public.ocorrencias for insert
  with check (
    exists (
      select 1 from public.condominios c
      where c.id = ocorrencias.condominio_id and c.owner_id = auth.uid()
    )
    or exists (
      select 1 from public.membros m
      where m.condominio_id = ocorrencias.condominio_id
        and m.user_id = auth.uid() and m.papel = 'porteiro'
    )
  );

grant select, insert on public.ocorrencias to authenticated;

-- Propostas comerciais: created by the síndico, decided (aprovar/reprovar)
-- by the síndico or a conselheiro.
create table if not exists public.propostas (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios (id) on delete cascade,
  titulo text not null,
  descricao text,
  valor numeric,
  status text not null default 'pendente' check (status in ('pendente', 'aprovada', 'reprovada')),
  decidido_por text,
  decidido_em timestamptz,
  comentario text,
  created_at timestamptz not null default now()
);

create index if not exists propostas_condominio_id_idx on public.propostas (condominio_id);

alter table public.propostas enable row level security;

drop policy if exists "Owners and conselheiros can view propostas" on public.propostas;
create policy "Owners and conselheiros can view propostas"
  on public.propostas for select
  using (
    exists (
      select 1 from public.condominios c
      where c.id = propostas.condominio_id and c.owner_id = auth.uid()
    )
    or exists (
      select 1 from public.membros m
      where m.condominio_id = propostas.condominio_id
        and m.user_id = auth.uid() and m.papel = 'conselheiro'
    )
  );

drop policy if exists "Owners can insert propostas" on public.propostas;
create policy "Owners can insert propostas"
  on public.propostas for insert
  with check (exists (
    select 1 from public.condominios c
    where c.id = propostas.condominio_id and c.owner_id = auth.uid()
  ));

drop policy if exists "Owners and conselheiros can update propostas" on public.propostas;
create policy "Owners and conselheiros can update propostas"
  on public.propostas for update
  using (
    exists (
      select 1 from public.condominios c
      where c.id = propostas.condominio_id and c.owner_id = auth.uid()
    )
    or exists (
      select 1 from public.membros m
      where m.condominio_id = propostas.condominio_id
        and m.user_id = auth.uid() and m.papel = 'conselheiro'
    )
  );

grant select, insert, update on public.propostas to authenticated;
