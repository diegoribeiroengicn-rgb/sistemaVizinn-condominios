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
  bloco text,
  modulos text[] not null default '{}',
  permissoes jsonb not null default '{}'::jsonb,
  requer_aprovacao boolean not null default false,
  created_at timestamptz not null default now()
);

-- Safe to re-run: adds the column / widens the check constraint if this
-- script already ran before they existed.
alter table public.membros add column if not exists telefone text;
alter table public.membros add column if not exists bloco text;
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

-- Quem gerencia chamados (ação "editar") precisa ver a lista de pessoas
-- pra poder escolher um responsável — mesmo sem permissão em "acessos".
-- Fica aqui (depois de membro_tem_permissao existir) por causa da mesma
-- regra de ordenação explicada no topo do arquivo.
drop policy if exists "Members with chamados edit can view membros" on public.membros;
create policy "Members with chamados edit can view membros"
  on public.membros for select
  using (public.membro_tem_permissao(condominio_id, 'chamados', 'editar'));

-- Chamados (support tickets), scoped to one condominio. Distingue chamado
-- de condomínio (aberto por morador/síndico/equipe, sobre moradores/áreas
-- comuns) de chamado interno (entre responsáveis pela operação — nunca
-- visível pra quem tem o papel "condomino"). Solicitante, responsável e
-- executor são pessoas distintas (ver README): quem abriu, quem
-- acompanha, quem resolveu de fato.
create table if not exists public.chamados (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios (id) on delete cascade,
  tipo text not null default 'condominio' check (tipo in ('condominio', 'interno')),
  titulo text not null,
  descricao text,
  categoria text,
  prioridade text not null default 'normal' check (prioridade in ('baixa', 'normal', 'alta', 'urgente')),
  unidade text,
  bloco text,
  local text,
  solicitante_id uuid references auth.users (id) on delete set null,
  solicitante_nome text,
  responsavel_id uuid references auth.users (id) on delete set null,
  responsavel_nome text,
  executor_nome text,
  status text not null default 'aberto' check (
    status in (
      'aberto', 'em_analise', 'em_atendimento', 'aguardando_informacao',
      'aguardando_morador', 'aguardando_prestador', 'aguardando_aprovacao',
      'concluido', 'cancelado'
    )
  ),
  data_prevista date,
  data_conclusao timestamptz,
  resultado text,
  -- FK pra ocorrencias adicionada mais abaixo (chamados_ocorrencia_origem_id_fkey)
  -- porque a tabela ocorrencias só é criada depois de chamados neste script.
  ocorrencia_origem_id uuid,
  avaliacao_nota integer check (avaliacao_nota between 1 and 5),
  avaliacao_comentario text,
  created_at timestamptz not null default now()
);

-- Safe to re-run: adds the columns if this script already ran before a
-- chamado era só título/descrição/unidade/status.
alter table public.chamados add column if not exists tipo text not null default 'condominio';
alter table public.chamados add column if not exists categoria text;
alter table public.chamados add column if not exists prioridade text not null default 'normal';
alter table public.chamados add column if not exists bloco text;
alter table public.chamados add column if not exists local text;
alter table public.chamados add column if not exists solicitante_id uuid references auth.users (id) on delete set null;
alter table public.chamados add column if not exists solicitante_nome text;
alter table public.chamados add column if not exists responsavel_id uuid references auth.users (id) on delete set null;
alter table public.chamados add column if not exists responsavel_nome text;
alter table public.chamados add column if not exists executor_nome text;
alter table public.chamados add column if not exists data_prevista date;
alter table public.chamados add column if not exists data_conclusao timestamptz;
alter table public.chamados add column if not exists resultado text;
alter table public.chamados add column if not exists ocorrencia_origem_id uuid;
alter table public.chamados add column if not exists avaliacao_nota integer;
alter table public.chamados add column if not exists avaliacao_comentario text;

alter table public.chamados drop constraint if exists chamados_tipo_check;
alter table public.chamados add constraint chamados_tipo_check check (tipo in ('condominio', 'interno'));
alter table public.chamados drop constraint if exists chamados_prioridade_check;
alter table public.chamados add constraint chamados_prioridade_check
  check (prioridade in ('baixa', 'normal', 'alta', 'urgente'));
alter table public.chamados drop constraint if exists chamados_avaliacao_nota_check;
alter table public.chamados add constraint chamados_avaliacao_nota_check
  check (avaliacao_nota is null or avaliacao_nota between 1 and 5);

-- Migra os valores antigos de status (3 estados) pros novos (9 estados)
-- antes de trocar a constraint — senão linhas existentes quebrariam o
-- check novo.
update public.chamados set status = 'em_atendimento' where status = 'em_andamento';
update public.chamados set status = 'concluido' where status = 'resolvido';

alter table public.chamados drop constraint if exists chamados_status_check;
alter table public.chamados add constraint chamados_status_check
  check (
    status in (
      'aberto', 'em_analise', 'em_atendimento', 'aguardando_informacao',
      'aguardando_morador', 'aguardando_prestador', 'aguardando_aprovacao',
      'concluido', 'cancelado'
    )
  );

create index if not exists chamados_condominio_id_idx on public.chamados (condominio_id);

alter table public.chamados enable row level security;

-- Chamado interno nunca é visível pra quem tem o papel "condomino"; um
-- morador só vê os próprios chamados (não os de outros moradores) mesmo
-- quando tem permissão de "visualizar" em chamados — dono do condomínio e
-- os demais papéis (síndico, subsíndico, administrador, porteiro,
-- zelador, conselheiro) continuam vendo tudo normalmente.
drop policy if exists "Owners can view their chamados" on public.chamados;
create policy "Owners can view their chamados"
  on public.chamados for select
  using (
    public.membro_tem_modulo(condominio_id, 'chamados')
    and (
      public.membro_papel(condominio_id) is distinct from 'condomino'
      or solicitante_id = auth.uid()
    )
  );

drop policy if exists "Owners can insert their chamados" on public.chamados;
create policy "Owners can insert their chamados"
  on public.chamados for insert
  with check (
    public.membro_tem_permissao(condominio_id, 'chamados', 'criar')
    and (
      public.membro_papel(condominio_id) is distinct from 'condomino'
      or (tipo = 'condominio' and solicitante_id = auth.uid())
    )
  );

-- Além de quem tem a ação "editar" (status, responsável, conclusão...), o
-- próprio solicitante pode atualizar um chamado já concluído — só pra
-- registrar a avaliação do atendimento (o front só manda os campos de
-- avaliação nesse caso).
drop policy if exists "Owners can update their chamados" on public.chamados;
create policy "Owners can update their chamados"
  on public.chamados for update
  using (
    public.membro_tem_permissao(condominio_id, 'chamados', 'editar')
    or (solicitante_id = auth.uid() and status = 'concluido')
  );

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

-- FK adiada de chamados.ocorrencia_origem_id (Ocorrência → Chamado) — só
-- dá pra criar agora que a tabela ocorrencias já existe (ver nota lá).
alter table public.chamados drop constraint if exists chamados_ocorrencia_origem_id_fkey;
alter table public.chamados add constraint chamados_ocorrencia_origem_id_fkey
  foreign key (ocorrencia_origem_id) references public.ocorrencias (id) on delete set null;
create index if not exists chamados_ocorrencia_origem_id_idx on public.chamados (ocorrencia_origem_id);

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

-- Manutenção: work orders for the zelador/funcionário. chamado_origem_id
-- guarda o vínculo quando a manutenção nasceu de um "Gerar manutenção" em
-- cima de um chamado (Chamado → Manutenção).
create table if not exists public.manutencoes (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios (id) on delete cascade,
  titulo text not null,
  descricao text,
  unidade text,
  status text not null default 'aberta' check (status in ('aberta', 'em_andamento', 'concluida')),
  chamado_origem_id uuid references public.chamados (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.manutencoes add column if not exists chamado_origem_id uuid references public.chamados (id) on delete set null;

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
  manutencao_origem_id uuid references public.manutencoes (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.propostas add column if not exists manutencao_origem_id uuid references public.manutencoes (id) on delete set null;

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

-- Manutenção: colunas de categoria/tipo/recorrência, vínculo com
-- fornecedor e o que fica registrado na conclusão (data, quem concluiu,
-- resultado — igual ao já feito em chamados). ciclo_origem_id encadeia
-- uma manutenção recorrente com o ciclo anterior que a gerou.
alter table public.manutencoes add column if not exists categoria text;
alter table public.manutencoes add column if not exists tipo text not null default 'avulsa';
alter table public.manutencoes add column if not exists periodicidade text;
alter table public.manutencoes add column if not exists periodicidade_dias integer;
alter table public.manutencoes add column if not exists data_prevista date;
alter table public.manutencoes add column if not exists proxima_data date;
alter table public.manutencoes add column if not exists fornecedor_nome text;
alter table public.manutencoes add column if not exists concluido_em timestamptz;
alter table public.manutencoes add column if not exists concluido_por_nome text;
alter table public.manutencoes add column if not exists resultado text;
alter table public.manutencoes add column if not exists ciclo_origem_id uuid references public.manutencoes (id) on delete set null;

alter table public.manutencoes drop constraint if exists manutencoes_tipo_check;
alter table public.manutencoes add constraint manutencoes_tipo_check
  check (tipo in ('avulsa', 'preventiva', 'recorrente'));
alter table public.manutencoes drop constraint if exists manutencoes_periodicidade_check;
alter table public.manutencoes add constraint manutencoes_periodicidade_check
  check (
    periodicidade is null
    or periodicidade in ('semanal', 'quinzenal', 'mensal', 'trimestral', 'semestral', 'anual', 'personalizada')
  );

-- Fornecedores: cadastro único por condomínio (empresa ou profissional).
create table if not exists public.fornecedores (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios (id) on delete cascade,
  razao_social text not null,
  nome_fantasia text,
  documento text,
  tipo text not null default 'empresa' check (tipo in ('empresa', 'profissional')),
  categoria text,
  telefone text,
  whatsapp text,
  email text,
  endereco text,
  site text,
  contato_principal text,
  observacoes text,
  status text not null default 'ativo' check (status in ('ativo', 'inativo', 'em_avaliacao', 'bloqueado')),
  created_at timestamptz not null default now()
);

-- Vendedor/representante da empresa fornecedora, separado do contato
-- principal genérico já existente — usado no cadastro manual e na
-- importação por planilha (ver lib/fornecedores.js).
alter table public.fornecedores add column if not exists vendedor_nome text;
alter table public.fornecedores add column if not exists vendedor_contato text;

create index if not exists fornecedores_condominio_id_idx on public.fornecedores (condominio_id);

alter table public.fornecedores enable row level security;

drop policy if exists "Members with fornecedores can view" on public.fornecedores;
create policy "Members with fornecedores can view"
  on public.fornecedores for select
  using (public.membro_tem_modulo(condominio_id, 'fornecedores'));

drop policy if exists "Members with fornecedores can insert" on public.fornecedores;
create policy "Members with fornecedores can insert"
  on public.fornecedores for insert
  with check (public.membro_tem_permissao(condominio_id, 'fornecedores', 'criar'));

drop policy if exists "Members with fornecedores can update" on public.fornecedores;
create policy "Members with fornecedores can update"
  on public.fornecedores for update
  using (public.membro_tem_permissao(condominio_id, 'fornecedores', 'editar'));

drop policy if exists "Members with fornecedores can delete" on public.fornecedores;
create policy "Members with fornecedores can delete"
  on public.fornecedores for delete
  using (public.membro_tem_permissao(condominio_id, 'fornecedores', 'excluir'));

grant select, insert, update, delete on public.fornecedores to authenticated;
grant all on public.fornecedores to service_role;

-- Avaliações de fornecedor: 4 critérios de 1 a 5 (nota geral = média
-- simples na hora de exibir, calculada no front — sem ranking complexo).
create table if not exists public.avaliacoes_fornecedor (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios (id) on delete cascade,
  fornecedor_id uuid not null references public.fornecedores (id) on delete cascade,
  manutencao_id uuid references public.manutencoes (id) on delete set null,
  avaliador_id uuid references auth.users (id) on delete set null,
  avaliador_nome text,
  nota_qualidade integer not null check (nota_qualidade between 1 and 5),
  nota_prazo integer not null check (nota_prazo between 1 and 5),
  nota_custo integer not null check (nota_custo between 1 and 5),
  nota_atendimento integer not null check (nota_atendimento between 1 and 5),
  observacao text,
  created_at timestamptz not null default now()
);

create index if not exists avaliacoes_fornecedor_fornecedor_id_idx on public.avaliacoes_fornecedor (fornecedor_id);

alter table public.avaliacoes_fornecedor enable row level security;

drop policy if exists "Members with fornecedores can view avaliacoes" on public.avaliacoes_fornecedor;
create policy "Members with fornecedores can view avaliacoes"
  on public.avaliacoes_fornecedor for select
  using (public.membro_tem_modulo(condominio_id, 'fornecedores'));

drop policy if exists "Members with fornecedores can insert avaliacoes" on public.avaliacoes_fornecedor;
create policy "Members with fornecedores can insert avaliacoes"
  on public.avaliacoes_fornecedor for insert
  with check (public.membro_tem_permissao(condominio_id, 'fornecedores', 'editar'));

grant select, insert on public.avaliacoes_fornecedor to authenticated;
grant all on public.avaliacoes_fornecedor to service_role;

-- Agora que fornecedores existe, liga manutenções e propostas a ele.
alter table public.manutencoes add column if not exists fornecedor_id uuid references public.fornecedores (id) on delete set null;
-- Antecedência do alerta: por manutenção (substitui o padrão do
-- condomínio quando preenchida) e um padrão por condomínio, configurável
-- em Configurações. Ambos opcionais — sem nenhum dos dois, cai no valor
-- fixo de 7 dias usado hoje pela Visão Geral.
alter table public.manutencoes add column if not exists alerta_dias_antecedencia integer;
alter table public.condominios add column if not exists manutencao_alerta_dias_padrao integer not null default 7;
-- Distribuição automática de chamados (opcional, desligada por padrão):
-- quando ligada, um chamado de condomínio criado sem colaborador
-- escolhido manualmente é atribuído automaticamente a quem tem menos
-- chamados em aberto no momento — nunca obrigatório, o síndico liga em
-- Configurações.
alter table public.condominios add column if not exists chamados_distribuicao_automatica boolean not null default false;
alter table public.propostas add column if not exists fornecedor_id uuid references public.fornecedores (id) on delete set null;
alter table public.propostas add column if not exists fornecedor_nome text;

-- Colaboradores: pessoas que trabalham no condomínio (zelador, porteiro,
-- equipe de limpeza etc.), separado de `membros` (quem tem login no
-- Vizinn). Um colaborador pode não ter login algum — por isso
-- `membro_id` é opcional e só é preenchido quando `possui_acesso` = true.
create table if not exists public.colaboradores (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios (id) on delete cascade,
  nome text not null,
  cpf text,
  funcao text not null,
  setor text,
  telefone text,
  whatsapp_ddi text,
  whatsapp_ddd text,
  whatsapp_numero text,
  tem_whatsapp boolean not null default false,
  email text,
  data_inicio date,
  status text not null default 'ativo' check (status in ('ativo', 'inativo', 'ferias', 'afastado')),
  observacoes text,
  possui_acesso boolean not null default false,
  membro_id uuid references public.membros (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists colaboradores_condominio_id_idx on public.colaboradores (condominio_id);

alter table public.colaboradores enable row level security;

drop policy if exists "Members can view colaboradores" on public.colaboradores;
create policy "Members can view colaboradores"
  on public.colaboradores for select
  using (public.membro_tem_modulo(condominio_id, 'colaboradores'));

drop policy if exists "Members can insert colaboradores" on public.colaboradores;
create policy "Members can insert colaboradores"
  on public.colaboradores for insert
  with check (public.membro_tem_permissao(condominio_id, 'colaboradores', 'criar'));

drop policy if exists "Members can update colaboradores" on public.colaboradores;
create policy "Members can update colaboradores"
  on public.colaboradores for update
  using (public.membro_tem_permissao(condominio_id, 'colaboradores', 'editar'));

drop policy if exists "Members can delete colaboradores" on public.colaboradores;
create policy "Members can delete colaboradores"
  on public.colaboradores for delete
  using (public.membro_tem_permissao(condominio_id, 'colaboradores', 'excluir'));

grant select, insert, update, delete on public.colaboradores to authenticated;
grant all on public.colaboradores to service_role;

-- Liga chamados e manutenções a um colaborador (responsável), sem mexer
-- nos campos responsavel_id/responsavel_nome já existentes (que
-- continuam funcionando pra registros antigos) — é um vínculo adicional
-- opcional, preenchido quando o responsável escolhido é um colaborador
-- cadastrado (com ou sem login).
alter table public.chamados add column if not exists responsavel_colaborador_id uuid references public.colaboradores (id) on delete set null;
alter table public.manutencoes add column if not exists responsavel_colaborador_id uuid references public.colaboradores (id) on delete set null;

-- Contas a Pagar.
create table if not exists public.contas_pagar (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios (id) on delete cascade,
  descricao text not null,
  categoria text,
  fornecedor_id uuid references public.fornecedores (id) on delete set null,
  fornecedor_nome text,
  documento_numero text,
  data_competencia date,
  data_vencimento date,
  data_pagamento date,
  valor numeric not null,
  forma_pagamento text,
  status text not null default 'pendente' check (status in ('pendente', 'a_vencer', 'vencida', 'pago', 'cancelada')),
  observacoes text,
  parcela integer,
  qtd_parcelas integer,
  manutencao_origem_id uuid references public.manutencoes (id) on delete set null,
  proposta_origem_id uuid references public.propostas (id) on delete set null,
  chamado_origem_id uuid references public.chamados (id) on delete set null,
  -- Reservada pra quando o upload de documento existir (precisa de
  -- Supabase Storage, ainda não configurado) — por enquanto sempre nula.
  documento_url text,
  created_at timestamptz not null default now()
);

create index if not exists contas_pagar_condominio_id_idx on public.contas_pagar (condominio_id);

alter table public.contas_pagar enable row level security;

drop policy if exists "Members with financeiro can view contas_pagar" on public.contas_pagar;
create policy "Members with financeiro can view contas_pagar"
  on public.contas_pagar for select
  using (public.membro_tem_modulo(condominio_id, 'financeiro'));

drop policy if exists "Members with financeiro can insert contas_pagar" on public.contas_pagar;
create policy "Members with financeiro can insert contas_pagar"
  on public.contas_pagar for insert
  with check (public.membro_tem_permissao(condominio_id, 'financeiro', 'criar'));

drop policy if exists "Members with financeiro can update contas_pagar" on public.contas_pagar;
create policy "Members with financeiro can update contas_pagar"
  on public.contas_pagar for update
  using (public.membro_tem_permissao(condominio_id, 'financeiro', 'editar'));

drop policy if exists "Members with financeiro can delete contas_pagar" on public.contas_pagar;
create policy "Members with financeiro can delete contas_pagar"
  on public.contas_pagar for delete
  using (public.membro_tem_permissao(condominio_id, 'financeiro', 'excluir'));

grant select, insert, update, delete on public.contas_pagar to authenticated;
grant all on public.contas_pagar to service_role;

-- Contas a Receber.
create table if not exists public.contas_receber (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios (id) on delete cascade,
  descricao text not null,
  unidade text,
  responsavel_financeiro text,
  categoria text,
  data_competencia date,
  data_vencimento date,
  data_recebimento date,
  valor numeric not null,
  valor_recebido numeric,
  desconto numeric,
  juros_multa numeric,
  forma_pagamento text,
  status text not null default 'pendente' check (status in ('pendente', 'a_vencer', 'vencida', 'recebida', 'cancelada')),
  observacoes text,
  boleto_referencia text,
  created_at timestamptz not null default now()
);

create index if not exists contas_receber_condominio_id_idx on public.contas_receber (condominio_id);

alter table public.contas_receber enable row level security;

drop policy if exists "Members with financeiro can view contas_receber" on public.contas_receber;
create policy "Members with financeiro can view contas_receber"
  on public.contas_receber for select
  using (public.membro_tem_modulo(condominio_id, 'financeiro'));

drop policy if exists "Members with financeiro can insert contas_receber" on public.contas_receber;
create policy "Members with financeiro can insert contas_receber"
  on public.contas_receber for insert
  with check (public.membro_tem_permissao(condominio_id, 'financeiro', 'criar'));

drop policy if exists "Members with financeiro can update contas_receber" on public.contas_receber;
create policy "Members with financeiro can update contas_receber"
  on public.contas_receber for update
  using (public.membro_tem_permissao(condominio_id, 'financeiro', 'editar'));

drop policy if exists "Members with financeiro can delete contas_receber" on public.contas_receber;
create policy "Members with financeiro can delete contas_receber"
  on public.contas_receber for delete
  using (public.membro_tem_permissao(condominio_id, 'financeiro', 'excluir'));

grant select, insert, update, delete on public.contas_receber to authenticated;
grant all on public.contas_receber to service_role;

-- Migra quem já tinha permissão no antigo módulo "boletos" pro novo
-- módulo "financeiro" (Boletos virou uma aba dentro de Financeiro).
update public.membros set permissoes = (permissoes - 'boletos') || jsonb_build_object('financeiro', permissoes -> 'boletos')
  where permissoes ? 'boletos' and not (permissoes ? 'financeiro');

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

drop trigger if exists trg_auditoria_fornecedores on public.fornecedores;
create trigger trg_auditoria_fornecedores
  after insert or update or delete on public.fornecedores
  for each row execute function public.registrar_auditoria_generica();

drop trigger if exists trg_auditoria_avaliacoes_fornecedor on public.avaliacoes_fornecedor;
create trigger trg_auditoria_avaliacoes_fornecedor
  after insert or update or delete on public.avaliacoes_fornecedor
  for each row execute function public.registrar_auditoria_generica();

drop trigger if exists trg_auditoria_contas_pagar on public.contas_pagar;
create trigger trg_auditoria_contas_pagar
  after insert or update or delete on public.contas_pagar
  for each row execute function public.registrar_auditoria_generica();

drop trigger if exists trg_auditoria_contas_receber on public.contas_receber;
create trigger trg_auditoria_contas_receber
  after insert or update or delete on public.contas_receber
  for each row execute function public.registrar_auditoria_generica();

drop trigger if exists trg_auditoria_colaboradores on public.colaboradores;
create trigger trg_auditoria_colaboradores
  after insert or update or delete on public.colaboradores
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

-- Storage: documentos financeiros (nota fiscal, etc.) anexados a uma conta
-- a pagar — opcional, nunca obrigatório. Bucket privado; cada arquivo é
-- salvo em "<condominio_id>/<nome-do-arquivo>", e a política de RLS usa
-- esse primeiro segmento do caminho pra checar a mesma permissão de
-- "financeiro" já usada em contas_pagar (nada de sistema documental à
-- parte). O app gera uma signed URL sob demanda pra exibir o arquivo.
insert into storage.buckets (id, name, public)
values ('financeiro-documentos', 'financeiro-documentos', false)
on conflict (id) do nothing;

drop policy if exists "Members with financeiro can view documentos" on storage.objects;
create policy "Members with financeiro can view documentos"
  on storage.objects for select
  using (
    bucket_id = 'financeiro-documentos'
    and public.membro_tem_modulo(((storage.foldername(name))[1])::uuid, 'financeiro')
  );

drop policy if exists "Members with financeiro can upload documentos" on storage.objects;
create policy "Members with financeiro can upload documentos"
  on storage.objects for insert
  with check (
    bucket_id = 'financeiro-documentos'
    and public.membro_tem_permissao(((storage.foldername(name))[1])::uuid, 'financeiro', 'criar')
  );

drop policy if exists "Members with financeiro can delete documentos" on storage.objects;
create policy "Members with financeiro can delete documentos"
  on storage.objects for delete
  using (
    bucket_id = 'financeiro-documentos'
    and public.membro_tem_permissao(((storage.foldername(name))[1])::uuid, 'financeiro', 'excluir')
  );

-- Notificações automáticas (e-mail via Resend, WhatsApp via Meta Cloud
-- API) — ver /app/api/notificar. "unidade"/"bloco" em ocorrencias e
-- "notificar_morador" permitem à portaria marcar "isso é uma entrega,
-- avisar o morador" sem criar um módulo à parte.
alter table public.ocorrencias add column if not exists unidade text;
alter table public.ocorrencias add column if not exists bloco text;
alter table public.ocorrencias add column if not exists notificar_morador boolean not null default false;

-- Log das tentativas de envio (auditoria própria, além da tabela
-- `auditoria` genérica) — guarda o que foi mandado, pra quem e se deu
-- certo, sem guardar o conteúdo da mensagem (só o evento e a referência).
create table if not exists public.notificacoes_log (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios (id) on delete cascade,
  evento text not null,
  referencia_id uuid,
  canal text not null check (canal in ('email', 'whatsapp')),
  destinatario_nome text,
  destinatario_contato text,
  status text not null check (status in ('enviado', 'erro')),
  erro_mensagem text,
  created_at timestamptz not null default now()
);

create index if not exists notificacoes_log_condominio_id_idx on public.notificacoes_log (condominio_id, created_at desc);

alter table public.notificacoes_log enable row level security;

drop policy if exists "Owners and auditoria can view notificacoes_log" on public.notificacoes_log;
create policy "Owners and auditoria can view notificacoes_log"
  on public.notificacoes_log for select
  using (public.membro_tem_modulo(condominio_id, 'auditoria'));

grant select on public.notificacoes_log to authenticated;
grant all on public.notificacoes_log to service_role;

-- Moradores: cadastro simples de quem mora em cada unidade (unidade,
-- bloco, nome, telefone), separado de `membros` (quem tem login no
-- Vizinn) — a maioria dos moradores nunca vai ter login, mas ainda
-- assim precisa ser encontrada quando a portaria avisa "chegou uma
-- encomenda". Alimenta as notificações de Ocorrências (ver
-- /app/api/notificar) além de `membros` com papel=condomino.
create table if not exists public.moradores (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios (id) on delete cascade,
  unidade text not null,
  bloco text,
  nome text not null,
  telefone text,
  email text,
  observacoes text,
  created_at timestamptz not null default now()
);

create index if not exists moradores_condominio_id_idx on public.moradores (condominio_id);
create index if not exists moradores_unidade_idx on public.moradores (condominio_id, unidade);

alter table public.moradores enable row level security;

drop policy if exists "Members can view moradores" on public.moradores;
create policy "Members can view moradores"
  on public.moradores for select
  using (public.membro_tem_modulo(condominio_id, 'moradores'));

drop policy if exists "Members can insert moradores" on public.moradores;
create policy "Members can insert moradores"
  on public.moradores for insert
  with check (public.membro_tem_permissao(condominio_id, 'moradores', 'criar'));

drop policy if exists "Members can update moradores" on public.moradores;
create policy "Members can update moradores"
  on public.moradores for update
  using (public.membro_tem_permissao(condominio_id, 'moradores', 'editar'));

drop policy if exists "Members can delete moradores" on public.moradores;
create policy "Members can delete moradores"
  on public.moradores for delete
  using (public.membro_tem_permissao(condominio_id, 'moradores', 'excluir'));

grant select, insert, update, delete on public.moradores to authenticated;
grant all on public.moradores to service_role;

drop trigger if exists trg_auditoria_moradores on public.moradores;
create trigger trg_auditoria_moradores
  after insert or update or delete on public.moradores
  for each row execute function public.registrar_auditoria_generica();

-- Obras e Melhorias: registro e acompanhamento de obras, reformas e
-- intervenções no condomínio — separado de Manutenção (que é sobre
-- manutenção recorrente/corretiva de rotina), com orçamento e prazo
-- próprios. Reaproveita colaboradores/fornecedores já cadastrados pra
-- responsável e empresa, no mesmo padrão de chamados/manutenções.
create table if not exists public.obras (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios (id) on delete cascade,
  titulo text not null,
  descricao text,
  local text,
  responsavel_colaborador_id uuid references public.colaboradores (id) on delete set null,
  responsavel_nome text,
  fornecedor_id uuid references public.fornecedores (id) on delete set null,
  fornecedor_nome text,
  data_prevista_inicio date,
  data_prevista_conclusao date,
  data_real_inicio date,
  data_real_conclusao date,
  valor_previsto numeric,
  valor_realizado numeric,
  status text not null default 'planejada' check (
    status in ('planejada', 'em_orcamento', 'aprovada', 'em_andamento', 'pausada', 'concluida', 'cancelada')
  ),
  observacoes text,
  created_at timestamptz not null default now()
);

create index if not exists obras_condominio_id_idx on public.obras (condominio_id);

alter table public.obras enable row level security;

drop policy if exists "Members can view obras" on public.obras;
create policy "Members can view obras"
  on public.obras for select
  using (public.membro_tem_modulo(condominio_id, 'obras'));

drop policy if exists "Members can insert obras" on public.obras;
create policy "Members can insert obras"
  on public.obras for insert
  with check (public.membro_tem_permissao(condominio_id, 'obras', 'criar'));

drop policy if exists "Members can update obras" on public.obras;
create policy "Members can update obras"
  on public.obras for update
  using (public.membro_tem_permissao(condominio_id, 'obras', 'editar'));

drop policy if exists "Members can delete obras" on public.obras;
create policy "Members can delete obras"
  on public.obras for delete
  using (public.membro_tem_permissao(condominio_id, 'obras', 'excluir'));

grant select, insert, update, delete on public.obras to authenticated;
grant all on public.obras to service_role;

drop trigger if exists trg_auditoria_obras on public.obras;
create trigger trg_auditoria_obras
  after insert or update or delete on public.obras
  for each row execute function public.registrar_auditoria_generica();

-- Propostas deixa de ser um módulo/página independente e passa a viver
-- dentro de Manutenção e Obras (várias propostas por registro). Os
-- dados existentes são preservados — só o status ganha dois valores
-- novos (migra o que já existe antes de trocar a restrição) e a
-- tabela ganha o vínculo com Obras, data da proposta e o anexo.
update public.propostas set status = 'recebida' where status = 'pendente';
update public.propostas set status = 'rejeitada' where status = 'reprovada';
alter table public.propostas drop constraint if exists propostas_status_check;
alter table public.propostas add constraint propostas_status_check
  check (status in ('recebida', 'em_analise', 'aprovada', 'rejeitada'));
alter table public.propostas alter column status set default 'recebida';

alter table public.propostas add column if not exists obra_origem_id uuid references public.obras (id) on delete set null;
alter table public.propostas add column if not exists data_proposta date;
alter table public.propostas add column if not exists anexo_url text;
alter table public.propostas add column if not exists anexo_nome text;

-- RLS: como não existe mais módulo próprio "Propostas" navegável, quem
-- pode mexer numa proposta segue a MESMA permissão de "propostas" de
-- antes (visualizar/criar/editar/aprovar) — só o update passa a
-- aceitar tanto quem edita quanto quem aprova (antes só quem aprovava
-- conseguia atualizar a linha, o que impedia por exemplo anexar um
-- arquivo sem ser o aprovador).
drop policy if exists "Owners and conselheiros can view propostas" on public.propostas;
create policy "Members can view propostas"
  on public.propostas for select
  using (public.membro_tem_modulo(condominio_id, 'propostas'));

drop policy if exists "Owners can insert propostas" on public.propostas;
create policy "Members can insert propostas"
  on public.propostas for insert
  with check (public.membro_tem_permissao(condominio_id, 'propostas', 'criar'));

drop policy if exists "Owners and conselheiros can update propostas" on public.propostas;
create policy "Members can update propostas"
  on public.propostas for update
  using (
    public.membro_tem_permissao(condominio_id, 'propostas', 'editar')
    or public.membro_tem_permissao(condominio_id, 'propostas', 'aprovar')
  );

-- Anexo de cada proposta (documento/planilha/imagem) — mesmo mecanismo
-- de Storage já usado em financeiro-documentos, com política própria.
insert into storage.buckets (id, name, public)
values ('propostas-anexos', 'propostas-anexos', false)
on conflict (id) do nothing;

drop policy if exists "Members can view anexos de propostas" on storage.objects;
create policy "Members can view anexos de propostas"
  on storage.objects for select
  using (
    bucket_id = 'propostas-anexos'
    and public.membro_tem_modulo(((storage.foldername(name))[1])::uuid, 'propostas')
  );

drop policy if exists "Members can upload anexos de propostas" on storage.objects;
create policy "Members can upload anexos de propostas"
  on storage.objects for insert
  with check (
    bucket_id = 'propostas-anexos'
    and (
      public.membro_tem_permissao(((storage.foldername(name))[1])::uuid, 'propostas', 'editar')
      or public.membro_tem_permissao(((storage.foldername(name))[1])::uuid, 'propostas', 'criar')
    )
  );

drop policy if exists "Members can delete anexos de propostas" on storage.objects;
create policy "Members can delete anexos de propostas"
  on storage.objects for delete
  using (
    bucket_id = 'propostas-anexos'
    and (
      public.membro_tem_permissao(((storage.foldername(name))[1])::uuid, 'propostas', 'editar')
      or public.membro_tem_permissao(((storage.foldername(name))[1])::uuid, 'propostas', 'criar')
    )
  );

-- Ecossistema de Fornecedores Vizinn: identidade global por CNPJ,
-- compartilhada entre condomínios — 100% aditivo. `fornecedores.id`
-- continua sendo exatamente o que já era (o cadastro daquele
-- condomínio, referenciado por avaliacoes_fornecedor/manutencoes/
-- propostas/contas_pagar/obras — nenhuma dessas tabelas muda). O
-- vínculo novo é só `fornecedores.fornecedor_global_id`, preenchido
-- quando o CNPJ já existe na base (reaproveita o global) ou quando é a
-- primeira vez que aquele CNPJ aparece (cria o global e já vincula).
create table if not exists public.fornecedores_globais (
  id uuid primary key default gen_random_uuid(),
  cnpj text unique,
  razao_social text not null,
  nome_fantasia text,
  endereco text,
  categoria text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists fornecedores_globais_cnpj_idx on public.fornecedores_globais (cnpj);

alter table public.fornecedores add column if not exists fornecedor_global_id uuid references public.fornecedores_globais (id) on delete set null;
create index if not exists fornecedores_fornecedor_global_id_idx on public.fornecedores (fornecedor_global_id);

alter table public.fornecedores_globais enable row level security;

-- Leitura: qualquer pessoa autenticada que tenha acesso a Fornecedores
-- em pelo menos um condomínio (site ou dono de condomínio) pode
-- pesquisar a base inteira — é a rede compartilhada, esse é o objetivo.
drop policy if exists "Members with fornecedores access can view globais" on public.fornecedores_globais;
create policy "Members with fornecedores access can view globais"
  on public.fornecedores_globais for select
  using (
    exists (
      select 1 from public.membros m
      where m.user_id = auth.uid() and m.permissoes -> 'fornecedores' ? 'visualizar'
    )
    or exists (select 1 from public.condominios c where c.owner_id = auth.uid())
  );

-- Criação: só quando o CNPJ ainda não existe (dedupe fica garantido
-- pelo unique de verdade na coluna, não só pela checagem da aplicação
-- antes de inserir — evita duplicata mesmo em caso de corrida).
drop policy if exists "Members with fornecedores access can insert globais" on public.fornecedores_globais;
create policy "Members with fornecedores access can insert globais"
  on public.fornecedores_globais for insert
  with check (
    exists (
      select 1 from public.membros m
      where m.user_id = auth.uid() and m.permissoes -> 'fornecedores' ? 'criar'
    )
    or exists (select 1 from public.condominios c where c.owner_id = auth.uid())
  );

-- Sem policy de update/delete pra "authenticated": nenhum síndico pode
-- alterar ou apagar a identidade global (mesmo a que ele mesmo criou) —
-- só o painel admin (service_role) corrige/gerencia a base geral. Isso
-- é o que impede um condomínio de sobrescrever dado usado por outros.
grant select, insert on public.fornecedores_globais to authenticated;
grant all on public.fornecedores_globais to service_role;

-- Reputação agregada de um fornecedor global (usada na busca da Rede
-- de Fornecedores Vizinn) — só números agregados, nunca linha crua de
-- outro condomínio: não vaza nome de condomínio, comentário ou
-- avaliação individual de ninguém, só "nota média", "quantas
-- avaliações" e "quantos condomínios" (contagem, não identidade).
-- SECURITY DEFINER pra poder somar dados de todos os condomínios sem
-- abrir uma policy de leitura cruzada em `fornecedores`/
-- `avaliacoes_fornecedor` (que continuam isoladas por tenant).
create or replace function public.reputacao_fornecedor_global(p_fornecedor_global_id uuid)
returns table (nota_media numeric, total_avaliacoes bigint, total_condominios bigint)
language sql
security definer
set search_path = public
stable
as $$
  select
    round(avg((av.nota_qualidade + av.nota_prazo + av.nota_custo + av.nota_atendimento) / 4.0), 1) as nota_media,
    count(av.id) as total_avaliacoes,
    count(distinct f.condominio_id) as total_condominios
  from public.fornecedores f
  left join public.avaliacoes_fornecedor av on av.fornecedor_id = f.id
  where f.fornecedor_global_id = p_fornecedor_global_id;
$$;

grant execute on function public.reputacao_fornecedor_global(uuid) to authenticated;

-- Status do fornecedor global — inativar/reativar pelo painel admin
-- (não é apagar; excluir continua sendo uma ação à parte, sempre
-- disponível só pro owner da plataforma).
alter table public.fornecedores_globais add column if not exists status text not null default 'ativo' check (status in ('ativo', 'inativo'));

-- Academia Vizinn: vídeos administrados pelo painel admin, consumidos
-- por qualquer condomínio logado conforme o nível de acesso de cada
-- vídeo. Implementação inicial simples (sem certificado, prova,
-- gamificação, trilha ou fórum) — só cadastro e controle de acesso.
create table if not exists public.academia_videos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descricao text,
  categoria text,
  thumbnail_path text,
  video_path text,
  ordem integer not null default 0,
  status text not null default 'rascunho' check (status in ('rascunho', 'publicado')),
  ativo boolean not null default true,
  nivel_acesso text not null default 'assinante' check (nivel_acesso in ('publico', 'teste_14_dias', 'assinante')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists academia_videos_ordem_idx on public.academia_videos (ordem);

alter table public.academia_videos enable row level security;

-- Qualquer pessoa autenticada vê os metadados (título, descrição,
-- capa, nível de acesso) de vídeos publicados e ativos — inclusive de
-- vídeos que ela ainda não tem acesso pra assistir, pra poder mostrar
-- "conteúdo exclusivo para assinantes" como chamada. O arquivo de
-- vídeo em si é que fica de verdade bloqueado (ver policy do bucket
-- academia-videos abaixo) — aqui é só a vitrine.
drop policy if exists "Authenticated can view published academia videos" on public.academia_videos;
create policy "Authenticated can view published academia videos"
  on public.academia_videos for select
  using (auth.uid() is not null and status = 'publicado' and ativo = true);

-- Sem policy de insert/update/delete pra "authenticated": só o painel
-- admin (service_role, via /api/admin/academia) cadastra/edita vídeo.
grant select on public.academia_videos to authenticated;
grant all on public.academia_videos to service_role;

-- Verifica se quem está logado tem acesso a um nível de vídeo —
-- "público" é sempre livre; os outros dois olham o status de QUALQUER
-- condomínio ao qual a pessoa pertença (dono ou membro), reaproveitando
-- o mesmo campo condominios.status que já controla assinatura/teste em
-- todo o resto do sistema (nenhum sistema de assinatura paralelo).
-- SECURITY DEFINER porque precisa juntar condominios + membros pra
-- decidir, sem abrir policy de leitura cruzada nessas tabelas.
create or replace function public.usuario_tem_acesso_academia(p_nivel_acesso text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    p_nivel_acesso = 'publico'
    or exists (
      select 1 from public.condominios c
      where c.owner_id = auth.uid()
        and (
          (p_nivel_acesso = 'teste_14_dias' and c.status in ('trialing', 'active', 'promessa', 'cortesia'))
          or (p_nivel_acesso = 'assinante' and c.status in ('active', 'promessa', 'cortesia'))
        )
    )
    or exists (
      select 1 from public.membros m
      join public.condominios c on c.id = m.condominio_id
      where m.user_id = auth.uid()
        and (
          (p_nivel_acesso = 'teste_14_dias' and c.status in ('trialing', 'active', 'promessa', 'cortesia'))
          or (p_nivel_acesso = 'assinante' and c.status in ('active', 'promessa', 'cortesia'))
        )
    );
$$;

grant execute on function public.usuario_tem_acesso_academia(text) to authenticated;

-- Bucket privado pro arquivo de vídeo — o acesso de leitura é decidido
-- vídeo a vídeo (nível de acesso x status do condomínio da pessoa),
-- então precisa ficar fora do bucket público. Thumbnail fica num bucket
-- público à parte (é só uma imagem de vitrine, sem motivo pra travar).
insert into storage.buckets (id, name, public)
values ('academia-videos', 'academia-videos', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('academia-thumbnails', 'academia-thumbnails', true)
on conflict (id) do nothing;

drop policy if exists "Access academia videos by tier" on storage.objects;
create policy "Access academia videos by tier"
  on storage.objects for select
  using (
    bucket_id = 'academia-videos'
    and exists (
      select 1 from public.academia_videos v
      where v.id = ((storage.foldername(name))[1])::uuid
        and v.status = 'publicado'
        and v.ativo = true
        and public.usuario_tem_acesso_academia(v.nivel_acesso)
    )
  );

drop policy if exists "Anyone can view academia thumbnails" on storage.objects;
create policy "Anyone can view academia thumbnails"
  on storage.objects for select
  using (bucket_id = 'academia-thumbnails');

-- Sem policy de insert/update/delete pra "authenticated" em nenhum dos
-- dois buckets: upload é sempre via signed upload URL emitida pelo
-- painel admin (service_role, ver /api/admin/academia/upload-url) —
-- é assim que o administrador sobe o vídeo direto pelo Dashboard sem
-- precisar de uma policy ampla de escrita nesses buckets.
