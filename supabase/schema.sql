-- Vizinn: full schema, run this in the Supabase SQL editor for your project.
--
-- IMPORTANT #1: tables created via the SQL editor (unlike the Table Editor
-- UI) do NOT automatically get base privileges for Supabase's
-- "authenticated" role — only RLS policies. Without the GRANTs below,
-- every query from a logged-in user fails with "permission denied for
-- table X" even when RLS would otherwise allow it.
--
-- IMPORTANT #2: condominios and membros each have a policy that checks the
-- OTHER table. The helper functions below are SECURITY DEFINER so they
-- don't re-trigger RLS, avoiding "infinite recursion detected in policy".
--
-- IMPORTANT #3: ordering matters. A SQL-language function is validated
-- against the columns it references AT CREATE TIME whenever the
-- referenced table already exists (e.g. on a re-run of this script on an
-- existing database) — so membro_tem_permissao()/membro_tem_modulo() (which
-- read membros.permissoes) are defined AFTER the membros table/column, and
-- every table whose RLS calls them (chamados, avisos, ocorrencias,
-- manutencoes, propostas, portaria_registros) comes after that too.

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
-- creates: condômino, porteiro, conselheiro, zelador, subsíndico e
-- administrador (pode representar uma administradora externa).
--
-- `permissoes` (jsonb) é a fonte de verdade de acesso: { modulo: [ações] }
-- — ex. {"chamados": ["visualizar","criar"], "propostas": ["visualizar"]}.
-- O papel só preenche um padrão sugerido na hora de criar (ver
-- DEFAULT_PERMISSOES_BY_PAPEL no front-end); dali em diante quem manda é
-- essa coluna, editável módulo a módulo, ação a ação, por pessoa.
--
-- `requer_aprovacao`: só relevante pra subsíndico/administrador — quando
-- true (padrão), alterações deles em Acessos (criar/editar/excluir acesso,
-- alterar permissões) ficam pendentes na tabela pendencias até o síndico
-- aprovar; quando false, valem na hora.
--
-- `modulos` (text[]) é um campo legado de uma versão anterior (módulo
-- sim/não, sem ação); nada mais lê ou grava nele — fica só pra não
-- arriscar apagar histórico à toa.
--
-- Este bloco roda antes de chamados/avisos/etc mais abaixo porque as
-- políticas de RLS deles chamam membro_tem_permissao()/membro_tem_modulo(),
-- que leem membros.permissoes e precisam ser criadas DEPOIS que essa
-- coluna existe (ver nota no topo do arquivo).
create table if not exists public.membros (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  nome text not null,
  email text not null,
  telefone text,
  papel text not null check (
    papel in ('condomino', 'porteiro', 'conselheiro', 'zelador', 'subsindico', 'administrador')
  ),
  unidade text,
  modulos text[] not null default '{}',
  permissoes jsonb not null default '{}'::jsonb,
  requer_aprovacao boolean not null default false,
  created_at timestamptz not null default now()
);

-- Safe to re-run: adds the column / widens the check constraint if this
-- script already ran before they existed.
alter table public.membros add column if not exists telefone text;
alter table public.membros add column if not exists modulos text[] not null default '{}';
alter table public.membros add column if not exists permissoes jsonb not null default '{}'::jsonb;
alter table public.membros add column if not exists requer_aprovacao boolean not null default false;
alter table public.membros drop constraint if exists membros_papel_check;
alter table public.membros add constraint membros_papel_check
  check (papel in ('condomino', 'porteiro', 'conselheiro', 'zelador', 'subsindico', 'administrador'));

-- Backfill (idempotente): quem já tinha módulos concedidos no formato
-- antigo (texto simples, sem nível de ação) recebe o equivalente em
-- permissoes — o mesmo nível de acesso que já usava, só que representado
-- no formato novo. Só toca módulo que a pessoa já tinha e que ainda não
-- foi migrado (evita sobrescrever uma edição feita já no formato novo).
update public.membros set permissoes = permissoes || jsonb_build_object('avisos', to_jsonb(array['visualizar']))
  where 'avisos' = any(modulos) and not (permissoes ? 'avisos');
update public.membros set permissoes = permissoes || jsonb_build_object('chamados', to_jsonb(array['visualizar','criar','editar']))
  where 'chamados' = any(modulos) and not (permissoes ? 'chamados');
update public.membros set permissoes = permissoes || jsonb_build_object('ocorrencias', to_jsonb(array['visualizar','criar']))
  where 'ocorrencias' = any(modulos) and not (permissoes ? 'ocorrencias');
update public.membros set permissoes = permissoes || jsonb_build_object('manutencao', to_jsonb(array['visualizar','criar','editar']))
  where 'manutencao' = any(modulos) and not (permissoes ? 'manutencao');
update public.membros set permissoes = permissoes || jsonb_build_object('propostas', to_jsonb(array['visualizar','aprovar']))
  where 'propostas' = any(modulos) and not (permissoes ? 'propostas');

create unique index if not exists membros_user_id_key on public.membros (user_id);
create index if not exists membros_condominio_id_idx on public.membros (condominio_id);

alter table public.membros enable row level security;

drop policy if exists "Owners can view their membros" on public.membros;
create policy "Owners can view their membros"
  on public.membros for select
  using (public.is_condominio_owner(condominio_id) or user_id = auth.uid());

-- Subsíndico/administrador com permissão em "acessos" também enxerga a
-- lista de acessos (a tela de Acessos em si). Criação/edição continuam
-- passando só pelas API routes (service role), então não precisam de
-- policy de insert/update aqui — só o GRANT de select/delete abaixo.
drop policy if exists "Members with acessos can view membros" on public.membros;
create policy "Members with acessos can view membros"
  on public.membros for select
  using (permissoes -> 'acessos' ? 'visualizar');

drop policy if exists "Owners can delete their membros" on public.membros;
create policy "Owners can delete their membros"
  on public.membros for delete
  using (public.is_condominio_owner(condominio_id));

grant select, delete on public.membros to authenticated;

-- Checagem de permissão por módulo + ação (ex.: 'chamados' + 'criar').
-- O dono do condomínio sempre tem tudo. Precisa vir DEPOIS de
-- membros.permissoes existir (ver nota no topo do arquivo).
create or replace function public.membro_tem_permissao(p_condominio_id uuid, p_modulo text, p_acao text)
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
      and permissoes -> p_modulo ? p_acao
  );
$$;

-- Atalho: "a pessoa enxerga esse módulo" = tem ao menos a ação
-- "visualizar" nele. Usado nas policies de SELECT de cada módulo.
create or replace function public.membro_tem_modulo(p_condominio_id uuid, p_modulo text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.membro_tem_permissao(p_condominio_id, p_modulo, 'visualizar');
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
  with check (public.membro_tem_permissao(condominio_id, 'chamados', 'criar'));

drop policy if exists "Owners can update their chamados" on public.chamados;
create policy "Owners can update their chamados"
  on public.chamados for update
  using (public.membro_tem_permissao(condominio_id, 'chamados', 'editar'));

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
drop policy if exists "Members can view avisos" on public.avisos;
create policy "Members can view avisos"
  on public.avisos for select
  using (public.membro_tem_modulo(condominio_id, 'avisos'));

drop policy if exists "Owners can insert their avisos" on public.avisos;
create policy "Owners can insert their avisos"
  on public.avisos for insert
  with check (public.membro_tem_permissao(condominio_id, 'avisos', 'criar'));

drop policy if exists "Owners can delete their avisos" on public.avisos;
create policy "Owners can delete their avisos"
  on public.avisos for delete
  using (public.membro_tem_permissao(condominio_id, 'avisos', 'excluir'));

grant select, insert, delete on public.avisos to authenticated;

-- Ocorrências: portaria log genérico (visitantes, encomendas, incidentes).
-- Distinto do módulo Portaria (entrada/saída com placa/unidade) abaixo.
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
  with check (public.membro_tem_permissao(condominio_id, 'ocorrencias', 'criar'));

grant select, insert on public.ocorrencias to authenticated;
grant all on public.ocorrencias to service_role;

-- Manutenção: work orders for the zelador/funcionário.
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
  with check (public.membro_tem_permissao(condominio_id, 'manutencao', 'criar'));

drop policy if exists "Owners and zeladores can update manutencoes" on public.manutencoes;
create policy "Owners and zeladores can update manutencoes"
  on public.manutencoes for update
  using (public.membro_tem_permissao(condominio_id, 'manutencao', 'editar'));

grant select, insert, update on public.manutencoes to authenticated;
grant all on public.manutencoes to service_role;

-- Propostas comerciais: cadastro (antes exclusivo do síndico) agora
-- também é uma ação concedível ("criar"); a decisão (aprovar/reprovar)
-- usa a ação "aprovar".
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

drop policy if exists "Owners can insert propostas" on public.propostas;
create policy "Owners can insert propostas"
  on public.propostas for insert
  with check (public.membro_tem_permissao(condominio_id, 'propostas', 'criar'));

drop policy if exists "Owners and conselheiros can update propostas" on public.propostas;
create policy "Owners and conselheiros can update propostas"
  on public.propostas for update
  using (public.membro_tem_permissao(condominio_id, 'propostas', 'aprovar'));

grant select, insert, update on public.propostas to authenticated;

-- Portaria: registro de entrada/saída de pessoas (visitantes, entregas,
-- prestadores) com forma de entrada (a pé / carro) e placa quando for
-- carro. "Quem está dentro" = saida_em is null.
create table if not exists public.portaria_registros (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios (id) on delete cascade,
  nome_pessoa text not null,
  tipo_acesso text not null default 'visitante'
    check (tipo_acesso in ('visitante', 'entregador', 'prestador_servico', 'morador', 'outro')),
  unidade text,
  forma_entrada text not null check (forma_entrada in ('a_pe', 'carro')),
  placa_veiculo text,
  observacoes text,
  entrada_em timestamptz not null default now(),
  entrada_por text,
  entrada_por_id uuid references auth.users (id) on delete set null,
  saida_em timestamptz,
  saida_por text,
  saida_por_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists portaria_registros_condominio_id_idx on public.portaria_registros (condominio_id);
create index if not exists portaria_registros_dentro_idx
  on public.portaria_registros (condominio_id, saida_em);

alter table public.portaria_registros enable row level security;

drop policy if exists "Members with portaria can view registros" on public.portaria_registros;
create policy "Members with portaria can view registros"
  on public.portaria_registros for select
  using (public.membro_tem_modulo(condominio_id, 'portaria'));

drop policy if exists "Members with portaria can insert registros" on public.portaria_registros;
create policy "Members with portaria can insert registros"
  on public.portaria_registros for insert
  with check (public.membro_tem_permissao(condominio_id, 'portaria', 'criar'));

drop policy if exists "Members with portaria can update registros" on public.portaria_registros;
create policy "Members with portaria can update registros"
  on public.portaria_registros for update
  using (public.membro_tem_permissao(condominio_id, 'portaria', 'editar'));

grant select, insert, update on public.portaria_registros to authenticated;
grant all on public.portaria_registros to service_role;

-- Auditoria: log de ações relevantes do sistema, pra rastreabilidade.
-- Alimentada de dois jeitos:
--  1) trigger automático (registrar_auditoria_generica, mais abaixo) em
--     cada tabela de módulo — cobre criar/editar/excluir, sempre.
--  2) inserts manuais feitos pelo próprio front/API pra ações que não são
--     uma linha de tabela (login; decisões de pendências; mudanças feitas
--     via service role, onde auth.uid() não existe pro trigger).
create table if not exists public.auditoria (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios (id) on delete cascade,
  usuario_id uuid references auth.users (id) on delete set null,
  usuario_nome text,
  papel text,
  acao text not null,
  modulo text not null,
  registro_id uuid,
  dados_anteriores jsonb,
  dados_novos jsonb,
  status text,
  created_at timestamptz not null default now()
);

create index if not exists auditoria_condominio_id_idx on public.auditoria (condominio_id, created_at desc);

alter table public.auditoria enable row level security;

drop policy if exists "Members with auditoria can view" on public.auditoria;
create policy "Members with auditoria can view"
  on public.auditoria for select
  using (public.membro_tem_modulo(condominio_id, 'auditoria'));

-- Insert manual só do próprio usuário autenticado, pro seu próprio
-- condomínio (login, por exemplo) — inserts automáticos (trigger) e de
-- rotas server-side usam a service role e ignoram esta policy.
drop policy if exists "Members can insert their own auditoria" on public.auditoria;
create policy "Members can insert their own auditoria"
  on public.auditoria for insert
  with check (
    usuario_id = auth.uid()
    and (public.is_condominio_owner(condominio_id) or public.membro_papel(condominio_id) is not null)
  );

grant select, insert on public.auditoria to authenticated;
grant all on public.auditoria to service_role;

-- Trigger genérico: registra automaticamente criar/editar/excluir em
-- qualquer tabela de módulo que o anexarmos (ver "create trigger" abaixo).
-- SECURITY DEFINER ignora a RLS de auditoria na hora de inserir (por isso
-- não depende da policy de insert acima) — mas continua rodando com
-- auth.uid() do usuário que fez a alteração, porque isso é resolvido antes
-- da troca de privilégio.
create or replace function public.registrar_auditoria_generica()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_condominio_id uuid;
  v_usuario_id uuid := auth.uid();
  v_usuario_nome text;
  v_papel text;
  v_acao text;
  v_registro_id uuid;
begin
  v_condominio_id := coalesce(NEW.condominio_id, OLD.condominio_id);

  select nome into v_usuario_nome from public.membros
    where user_id = v_usuario_id and condominio_id = v_condominio_id limit 1;
  if v_usuario_nome is null then
    select responsavel_nome into v_usuario_nome from public.condominios
      where owner_id = v_usuario_id and id = v_condominio_id;
  end if;

  v_papel := public.membro_papel(v_condominio_id);
  if v_papel is null and public.is_condominio_owner(v_condominio_id) then
    v_papel := 'sindico';
  end if;

  if TG_OP = 'INSERT' then
    v_acao := 'criar';
    v_registro_id := NEW.id;
  elsif TG_OP = 'UPDATE' then
    v_acao := 'editar';
    v_registro_id := NEW.id;
  elsif TG_OP = 'DELETE' then
    v_acao := 'excluir';
    v_registro_id := OLD.id;
  end if;

  insert into public.auditoria
    (condominio_id, usuario_id, usuario_nome, papel, acao, modulo, registro_id, dados_anteriores, dados_novos)
  values (
    v_condominio_id, v_usuario_id, v_usuario_nome, v_papel, v_acao, TG_TABLE_NAME, v_registro_id,
    case when TG_OP in ('UPDATE', 'DELETE') then to_jsonb(OLD) else null end,
    case when TG_OP in ('INSERT', 'UPDATE') then to_jsonb(NEW) else null end
  );

  if TG_OP = 'DELETE' then
    return OLD;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_auditoria_chamados on public.chamados;
create trigger trg_auditoria_chamados
  after insert or update or delete on public.chamados
  for each row execute function public.registrar_auditoria_generica();

drop trigger if exists trg_auditoria_avisos on public.avisos;
create trigger trg_auditoria_avisos
  after insert or update or delete on public.avisos
  for each row execute function public.registrar_auditoria_generica();

drop trigger if exists trg_auditoria_ocorrencias on public.ocorrencias;
create trigger trg_auditoria_ocorrencias
  after insert or update or delete on public.ocorrencias
  for each row execute function public.registrar_auditoria_generica();

drop trigger if exists trg_auditoria_manutencoes on public.manutencoes;
create trigger trg_auditoria_manutencoes
  after insert or update or delete on public.manutencoes
  for each row execute function public.registrar_auditoria_generica();

drop trigger if exists trg_auditoria_propostas on public.propostas;
create trigger trg_auditoria_propostas
  after insert or update or delete on public.propostas
  for each row execute function public.registrar_auditoria_generica();

drop trigger if exists trg_auditoria_portaria on public.portaria_registros;
create trigger trg_auditoria_portaria
  after insert or update or delete on public.portaria_registros
  for each row execute function public.registrar_auditoria_generica();

-- Nota: não há trigger de auditoria em `membros` — as mudanças ali passam
-- pelas API routes (service role, sem auth.uid() de sessão), que já
-- registram a auditoria explicitamente com o usuário certo (ver
-- /app/api/members/*). Um trigger aqui perderia "quem fez".

-- Pendências: fila de aprovação para alterações administrativas
-- (Acessos/Permissões) feitas por um subsíndico/administrador com
-- requer_aprovacao=true. Por enquanto cobre só a tabela membros — ver
-- README para o motivo desse recorte.
create table if not exists public.pendencias (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios (id) on delete cascade,
  solicitante_id uuid not null references auth.users (id) on delete cascade,
  solicitante_nome text not null,
  acao text not null check (acao in ('criar', 'editar', 'excluir')),
  tabela text not null default 'membros',
  registro_id uuid,
  dados_anteriores jsonb,
  dados_novos jsonb not null,
  status text not null default 'pendente' check (status in ('pendente', 'aprovada', 'rejeitada')),
  decidido_por_id uuid references auth.users (id) on delete set null,
  decidido_por_nome text,
  decidido_em timestamptz,
  motivo_rejeicao text,
  created_at timestamptz not null default now()
);

create index if not exists pendencias_condominio_id_idx on public.pendencias (condominio_id, status);

alter table public.pendencias enable row level security;

-- O síndico vê todas as pendências do seu condomínio; quem solicitou vê a
-- própria. Criar/decidir passa pelas API routes (service role) — só
-- select é liberado aqui.
drop policy if exists "Owners and requesters can view pendencias" on public.pendencias;
create policy "Owners and requesters can view pendencias"
  on public.pendencias for select
  using (public.is_condominio_owner(condominio_id) or solicitante_id = auth.uid());

grant select on public.pendencias to authenticated;
grant all on public.pendencias to service_role;

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
-- (ocorrencias, manutencoes, portaria_registros, auditoria e pendencias já
-- foram concedidas acima, junto de cada tabela.)
