-- Vizinn: full schema, run this in the Supabase SQL editor for your project.
--
-- IMPORTANT #1: tables created via the SQL editor (unlike the Table Editor
-- UI) do NOT automatically get base privileges for Supabase's
-- "authenticated" role — only RLS policies. Without the GRANTs below,
-- every query from a logged-in user fails with "permission denied for
-- table X" even when RLS would otherwise allow it.
--
-- IMPORTANT #2: condominios and membros each have a policy that checks the
-- OTHER table (an owner needs to see their membros; a membro needs to see
-- their condominio). A plain `exists (select 1 from other_table ...)`
-- subquery re-triggers RLS on that other table, and if IT also queries
-- back, Postgres detects the cycle and raises "infinite recursion
-- detected in policy". The two helper functions below break that cycle:
-- they're SECURITY DEFINER, so Postgres does not re-apply RLS inside
-- them, and every policy below calls them instead of writing the
-- cross-table subquery directly.

create or replace function public.is_condominio_owner(p_condominio_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.condominios c
    where c.id = p_condominio_id and c.owner_id = auth.uid()
  );
$$;

create or replace function public.membro_papel(p_condominio_id uuid)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select papel from public.membros
  where condominio_id = p_condominio_id and user_id = auth.uid()
  limit 1;
$$;

-- Nota: a função membro_tem_modulo() (usada por chamados/avisos/
-- ocorrências/manutenções/propostas) só é criada mais abaixo, DEPOIS da
-- tabela membros e da coluna membros.modulos — Postgres valida as colunas
-- referenciadas no corpo de uma function SQL contra a tabela já existente
-- na hora do CREATE FUNCTION, e falha com "column does not exist" se a
-- tabela já existe (de uma execução anterior deste script) mas a coluna
-- ainda não. Ver a definição logo após "grant select, delete on public.membros".

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

-- Members (não-owners) also need to read the condominio they belong to.
-- Postgres OR's multiple permissive policies for the same command, so this
-- adds to (doesn't replace) "Owners can view their condominio" above.
-- Uses membro_papel() instead of a direct membros subquery — see note at
-- the top of this file about RLS recursion.
drop policy if exists "Members can view their condominio" on public.condominios;
create policy "Members can view their condominio"
  on public.condominios for select
  using (public.membro_papel(id) is not null);

-- The platform admin dashboard (/admin) reads through the service role key
-- server-side (see /app/api/admin), which bypasses RLS by design — no
-- extra policy is needed for the owner to see every condominio.

grant select, update on public.condominios to authenticated;

-- Membros: delimited sub-accounts the síndico grants access to. The
-- condominio owner (condominios.owner_id) already has full access and is
-- NOT a row here — this table is only for roles the síndico explicitly
-- creates: condômino (read-only, own unit), porteiro (ocorrências),
-- conselheiro (approve/reject propostas), zelador (manutenção + ocorrências).
-- This block runs before chamados/avisos/etc below because their RLS
-- policies call membro_tem_modulo(), which reads membros.modulos and must
-- be created AFTER that column exists (see note near membro_papel above).
create table if not exists public.membros (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  nome text not null,
  email text not null,
  telefone text,
  papel text not null check (papel in ('condomino', 'porteiro', 'conselheiro', 'zelador')),
  unidade text,
  modulos text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- Safe to re-run: adds the column / widens the check constraint if this
-- script already ran before they existed.
alter table public.membros add column if not exists telefone text;
alter table public.membros add column if not exists modulos text[] not null default '{}';
alter table public.membros drop constraint if exists membros_papel_check;
alter table public.membros add constraint membros_papel_check
  check (papel in ('condomino', 'porteiro', 'conselheiro', 'zelador'));

-- Backfill: acessos criados antes de existir a customização por módulo
-- recebem o conjunto padrão do papel deles, senão perderiam o acesso que
-- já usavam quando este script rodar. Só toca quem ainda está vazio.
update public.membros set modulos = array['avisos']
  where papel = 'condomino' and modulos = '{}';
update public.membros set modulos = array['avisos', 'ocorrencias']
  where papel = 'porteiro' and modulos = '{}';
update public.membros set modulos = array['avisos', 'propostas']
  where papel = 'conselheiro' and modulos = '{}';
update public.membros set modulos = array['avisos', 'manutencao', 'ocorrencias']
  where papel = 'zelador' and modulos = '{}';

create unique index if not exists membros_user_id_key on public.membros (user_id);
create index if not exists membros_condominio_id_idx on public.membros (condominio_id);

alter table public.membros enable row level security;

drop policy if exists "Owners can view their membros" on public.membros;
create policy "Owners can view their membros"
  on public.membros for select
  using (public.is_condominio_owner(condominio_id) or user_id = auth.uid());

drop policy if exists "Owners can delete their membros" on public.membros;
create policy "Owners can delete their membros"
  on public.membros for delete
  using (public.is_condominio_owner(condominio_id));

grant select, delete on public.membros to authenticated;

-- Acesso por módulo: o síndico escolhe, pessoa por pessoa, quais módulos
-- (avisos, chamados, ocorrências, manutenção, propostas) aquele acesso
-- enxerga — independente do papel. O papel só define o conjunto padrão
-- sugerido na hora de criar o acesso (ver DEFAULT_MODULOS_BY_PAPEL no
-- front-end); daí em diante quem manda é a coluna membros.modulos.
-- O dono do condomínio sempre tem acesso a tudo (is_condominio_owner).
-- Precisa vir DEPOIS de membros.modulos existir (ver nota acima).
create or replace function public.membro_tem_modulo(p_condominio_id uuid, p_modulo text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_condominio_owner(p_condominio_id)
  or exists (
    select 1 from public.membros
    where condominio_id = p_condominio_id
      and user_id = auth.uid()
      and p_modulo = any(modulos)
  );
$$;

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
  using (public.membro_tem_modulo(condominio_id, 'chamados'));

drop policy if exists "Owners can insert their chamados" on public.chamados;
create policy "Owners can insert their chamados"
  on public.chamados for insert
  with check (public.membro_tem_modulo(condominio_id, 'chamados'));

drop policy if exists "Owners can update their chamados" on public.chamados;
create policy "Owners can update their chamados"
  on public.chamados for update
  using (public.membro_tem_modulo(condominio_id, 'chamados'));

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
  using (public.is_condominio_owner(condominio_id));

drop policy if exists "Owners can insert their avisos" on public.avisos;
create policy "Owners can insert their avisos"
  on public.avisos for insert
  with check (public.is_condominio_owner(condominio_id));

drop policy if exists "Owners can delete their avisos" on public.avisos;
create policy "Owners can delete their avisos"
  on public.avisos for delete
  using (public.is_condominio_owner(condominio_id));

-- Members with the "avisos" módulo can read avisos — same idea, additive
-- policy. (Every papel gets "avisos" by default when created; the síndico
-- can remove it per pessoa in Acessos.)
drop policy if exists "Members can view avisos" on public.avisos;
create policy "Members can view avisos"
  on public.avisos for select
  using (public.membro_tem_modulo(condominio_id, 'avisos'));

grant select, insert, delete on public.avisos to authenticated;

-- Ocorrências: portaria log. Registered by porteiro/zelador (or the
-- síndico), visible to the síndico, porteiros and zeladores of that
-- condominio.
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
drop policy if exists "Owners porteiros and zeladores can view ocorrencias" on public.ocorrencias;
create policy "Owners porteiros and zeladores can view ocorrencias"
  on public.ocorrencias for select
  using (public.membro_tem_modulo(condominio_id, 'ocorrencias'));

drop policy if exists "Owners and porteiros can insert ocorrencias" on public.ocorrencias;
drop policy if exists "Owners porteiros and zeladores can insert ocorrencias" on public.ocorrencias;
create policy "Owners porteiros and zeladores can insert ocorrencias"
  on public.ocorrencias for insert
  with check (public.membro_tem_modulo(condominio_id, 'ocorrencias'));

grant select, insert on public.ocorrencias to authenticated;
grant all on public.ocorrencias to service_role;

-- Manutenção: work orders for the zelador/funcionário. Síndico and
-- zeladores can create/view/edit; only the zelador role closes them (but
-- the síndico can too, since owners can do everything a member can).
create table if not exists public.manutencoes (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios (id) on delete cascade,
  titulo text not null,
  descricao text,
  unidade text,
  status text not null default 'aberta' check (status in ('aberta', 'em_andamento', 'concluida')),
  created_at timestamptz not null default now()
);

create index if not exists manutencoes_condominio_id_idx on public.manutencoes (condominio_id);

alter table public.manutencoes enable row level security;

drop policy if exists "Owners and zeladores can view manutencoes" on public.manutencoes;
create policy "Owners and zeladores can view manutencoes"
  on public.manutencoes for select
  using (public.membro_tem_modulo(condominio_id, 'manutencao'));

drop policy if exists "Owners and zeladores can insert manutencoes" on public.manutencoes;
create policy "Owners and zeladores can insert manutencoes"
  on public.manutencoes for insert
  with check (public.membro_tem_modulo(condominio_id, 'manutencao'));

drop policy if exists "Owners and zeladores can update manutencoes" on public.manutencoes;
create policy "Owners and zeladores can update manutencoes"
  on public.manutencoes for update
  using (public.membro_tem_modulo(condominio_id, 'manutencao'));

grant select, insert, update on public.manutencoes to authenticated;
grant all on public.manutencoes to service_role;

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
  using (public.membro_tem_modulo(condominio_id, 'propostas'));

-- Cadastrar propostas continua exclusivo do síndico (não é um módulo
-- concedível) — só a decisão (aprovar/reprovar) é.
drop policy if exists "Owners can insert propostas" on public.propostas;
create policy "Owners can insert propostas"
  on public.propostas for insert
  with check (public.is_condominio_owner(condominio_id));

drop policy if exists "Owners and conselheiros can update propostas" on public.propostas;
create policy "Owners and conselheiros can update propostas"
  on public.propostas for update
  using (public.membro_tem_modulo(condominio_id, 'propostas'));

grant select, insert, update on public.propostas to authenticated;

-- The service_role key (used server-side by /app/api/* via
-- lib/supabaseAdmin.js) BYPASSES RLS POLICIES, but — same gotcha as the
-- "authenticated" GRANTs above — bypassing RLS is not the same as having
-- the base table privilege. Without these, every server-side admin/signup
-- route fails with "permission denied for table X" even though the
-- service_role key is supposed to have full access.
grant all on public.condominios to service_role;
grant all on public.chamados to service_role;
grant all on public.avisos to service_role;
grant all on public.membros to service_role;
grant all on public.propostas to service_role;
-- (ocorrencias and manutencoes already granted above, next to their tables)
