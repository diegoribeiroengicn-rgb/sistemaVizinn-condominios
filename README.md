# AquiHabitto — Gestão de Condomínio Inteligente

SaaS multi-tenant para administração condominial: landing page, cadastro com
cobrança via Stripe e dashboard do síndico, tudo em uma única URL.

- **Framework:** Next.js 14 (App Router)
- **Estilo:** Tailwind CSS
- **Autenticação e banco:** Supabase
- **Pagamentos:** Stripe (Elements embutido + assinaturas)

## Fluxo

1. Visitante não logado vê a landing page (`/`), com CTA "Começar".
2. Ao clicar em "Começar", abre o formulário de cadastro: dados pessoais,
   dados do condomínio e escolha de plano (Starter R$49 / Growth R$99 / Pro
   R$199).
3. É cobrada a taxa de adesão do plano escolhido (editável em `/admin/pagamentos`),
   com desconto de cupom se houver — a cobrança em si também valida o cartão
   (Stripe Elements embutido). Cupom de isenção total (100%) pula a cobrança.
4. Após a confirmação, o backend cria o cliente e a assinatura no Stripe (com
   14 dias de teste), cria o usuário no Supabase Auth e o registro na tabela
   `condominios`.
5. Login automático e redirecionamento para `/dashboard`.
6. Usuários já logados que acessam `/` são redirecionados direto para o
   dashboard.

## Dashboard do síndico e acessos delimitados

O síndico (dono do condomínio, `condominios.owner_id`) tem acesso total ao
dashboard: Chamados, Avisos, Ocorrências, Acessos e Configurações.

Em **`/dashboard/acessos`**, o síndico cria contas de login delimitadas
(e-mail + senha, sem convite por e-mail) para três papéis, cada um só
enxergando sua própria área:

- **Condômino**: só a aba Avisos (leitura). Consulta de boletos ainda não
  existe (depende de integração bancária — ver nota abaixo).
- **Porteiro**: só a aba Ocorrências (registra e vê o livro de ocorrências
  da portaria).
- **Conselheiro**: permissão "propostas" (visualizar/aprovar) — aprova ou
  rejeita as propostas comerciais dentro de cada registro de Manutenção ou
  de Obras e Melhorias; não é mais uma aba própria.

Essas contas (tabela `membros`) apontam para o mesmo condomínio, mas nunca
têm acesso a `/dashboard/acessos`, `/admin` ou aos dados de outro tenant —
isso é garantido por Row Level Security no Postgres, não só pela interface.

**Boletos**: emissão de boleto de verdade (linha digitável, pago pelo
morador) já existe via Asaas — ver seção "Cobrança via boleto (Asaas)"
mais abaixo. Cada condomínio tem sua própria subconta; o dinheiro do
morador cai direto nela, nunca numa conta da AquiHabitto.

## Painel do administrador (`/admin`)

Rota exclusiva do dono da plataforma (Diego), separada do dashboard de cada
síndico:

- **Todos os condomínios**: tabela com plano, unidades, status e responsável
  de cada tenant cadastrado.
- **Receita/MRR**: MRR de assinantes pagantes e MRR projetado (incluindo
  quem está em teste gratuito).
- **Gestão de assinaturas** (botão "Gerenciar" em cada linha):
  - **Suspender / Reativar**: pausa a cobrança no Stripe (se houver
    assinatura) e bloqueia o dashboard do síndico (tela de "Acesso
    suspenso"), sem cancelar de vez. Reativar volta ao normal.
  - **Liberar (promessa de pagamento)**: desbloqueia o acesso na confiança,
    sem cobrar — útil para liberar um cliente antes do pagamento cair.
  - **Dar cortesia**: acesso gratuito (com data opcional de validade), para
    testes ou parcerias — não gera cobrança no Stripe.
  - **Cancelar assinatura**: cancela no Stripe e bloqueia o dashboard
    (ação definitiva).
- **Analytics**: distribuição de condomínios por plano e cadastros por dia
  (últimos 14 dias com dados).

Status possíveis de um condomínio: os que vêm do Stripe (`active`,
`trialing`, `past_due`, `unpaid`, `canceled`, ...) e os definidos pelo
admin (`suspended`, `promessa`, `cortesia`). O dashboard do síndico
(`/dashboard`) bloqueia o acesso quando o status é `suspended`, `canceled`,
`unpaid` ou `incomplete_expired` — `promessa` e `cortesia` continuam com
acesso liberado normalmente. O webhook do Stripe nunca sobrescreve um
status definido manualmente pelo admin (`suspended`/`promessa`/`cortesia`).

O acesso ao painel é controlado por `ADMIN_EMAILS` (verificado no
servidor, em `/api/admin/*`, via token do Supabase) —
`NEXT_PUBLIC_ADMIN_EMAILS` só decide se o link "Admin" aparece no menu.
Como o painel lê via `SUPABASE_SERVICE_ROLE_KEY`, ele enxerga todos os
tenants mesmo com Row Level Security habilitada.

## Testar sem pagar (modo de teste)

Enquanto o produto ainda está em desenvolvimento, dá pra criar contas sem
passar pelo Stripe: com `ALLOW_TEST_SIGNUP=true` e `NEXT_PUBLIC_TEST_MODE=true`
configurados, o formulário de cadastro (passo "Dados") ganha um botão
**"Pular pagamento (ambiente de testes)"**. Ele cria o usuário no Supabase e
o registro em `condominios` (status `trialing`, sem Stripe) direto, sem
PaymentIntent nem assinatura — login automático em seguida, igual ao fluxo
normal.

`ALLOW_TEST_SIGNUP` é checado no servidor (`/api/dev-signup`) independente
do valor de `NEXT_PUBLIC_TEST_MODE`, que só controla se o botão aparece.
**Desligue os dois (ou remova as variáveis) antes de abrir para clientes
reais**, senão qualquer visitante consegue criar conta sem pagar.

## Configuração

### 1. Instalar dependências

```bash
npm install
```

### 2. Variáveis de ambiente

Copie o template e preencha com suas chaves:

```bash
cp .env.example .env.local
```

| Variável | Onde encontrar |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API (mantenha em segredo, só usada no servidor) |
| `NEXT_PUBLIC_STRIPE_PUBLIC_KEY` / `STRIPE_SECRET_KEY` | Stripe → Developers → API keys |
| `STRIPE_WEBHOOK_SECRET` | Stripe CLI (`stripe listen`) ou Dashboard → Webhooks |
| `STRIPE_PRICE_STARTER` / `STRIPE_PRICE_GROWTH` / `STRIPE_PRICE_PRO` | Stripe → Product catalog (crie um Price recorrente mensal para cada plano) |
| `ADMIN_EMAILS` / `NEXT_PUBLIC_ADMIN_EMAILS` | E-mail(s) com acesso ao painel `/admin` (defina os dois com o mesmo valor) |
| `RESEND_API_KEY` / `EMAIL_FROM` | [resend.com](https://resend.com) → API Keys (plano grátis, 3 mil e-mails/mês) |
| `ALLOW_TEST_SIGNUP` / `NEXT_PUBLIC_TEST_MODE` | `true` para liberar o cadastro sem Stripe (ver seção acima) — **desligue em produção** |

### 3. Banco de dados

Rode o script `supabase/schema.sql` no SQL editor do seu projeto Supabase.
Ele cria a tabela `condominios` com Row Level Security.

### 4. Rodar localmente

```bash
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

### 5. Deploy na Vercel

1. Suba o repositório para o GitHub.
2. Importe o projeto na Vercel.
3. Configure as mesmas variáveis de ambiente do `.env.local` no painel da
   Vercel.
4. Configure o endpoint de webhook do Stripe apontando para
   `https://SEU_DOMINIO/api/webhook`.

## Cadastro de Moradores

`/dashboard/moradores` — registro de unidade/bloco/nome/telefone de quem mora
no condomínio, sem precisar criar um login (isso é o que `Acessos` faz).
Dá pra cadastrar um por um ou importar uma planilha `.csv` de uma vez
(botão "Baixar modelo de planilha" mostra o formato esperado). É essa lista
que o sistema consulta para avisar o morador quando chega uma encomenda em
Ocorrências — sem cadastro aqui (ou um login com papel "Condômino" e a
mesma unidade), a notificação não tem para quem ir.

## Notificações automáticas (e-mail)

`lib/notificacoes.js` + `/api/notificar` disparam e-mail (Resend) para dez
eventos hoje. (WhatsApp já foi um canal aqui — removido por custo/complexidade
de manter os templates aprovados na Meta para o volume baixo de um
condomínio; dá pra ver como era no histórico do git deste arquivo.)

- **Acesso criado**: ao criar um acesso em Acessos (sem exigir aprovação
  de síndico), a pessoa recebe login e senha provisória automaticamente.
  Dispara direto de `app/api/members/create`, não de `/api/notificar`.
- **Encomenda chegou**: ao registrar uma Ocorrência marcando "avisar o
  morador" com motivo "Encomenda", todo condômino daquela unidade/bloco
  recebe a notificação.
- **Ocorrência com morador específico**: mesma coisa, mas com motivo
  "Outro" — usa o título/descrição livres da ocorrência em vez do texto
  fixo de encomenda (ex: barulho, visitante, manutenção no apartamento).
- **Chamado atribuído**: ao definir um responsável (colaborador ou membro)
  num chamado, essa pessoa recebe a notificação.
- **Chamado registrado em nome de morador**: ao criar um chamado vinculado
  a um morador cadastrado (mesmo sem login no sistema).
- **Chamado concluído**: ao marcar um chamado como concluído, o morador
  vinculado (ou o condômino que abriu, se logado) é avisado.
- **Aviso geral de Ocorrência / Manutenção programada / Aviso publicado**:
  mandam pra todos os moradores do condomínio.
- **Alerta de login**: avisa o síndico por e-mail quando outro membro
  entra no sistema (opcional, liga em Configurações).

Cada tentativa fica registrada em `notificacoes_log` (visível em quem tem
acesso a Auditoria).

### Configurar o Resend (e-mail)

1. Crie uma conta grátis em [resend.com](https://resend.com).
2. Gere uma API key e coloque em `RESEND_API_KEY`.
3. Sem domínio próprio verificado, deixe `EMAIL_FROM=onboarding@resend.dev`
   (funciona pra testar, mas mostra "via resend.dev" pro destinatário —
   verifique seu domínio no Resend quando for pra produção).

## Cobrança via boleto (Asaas)

Cada condomínio tem sua própria **subconta** no Asaas (`lib/asaas.js` +
`condominios_asaas` no schema) — o dinheiro do morador cai direto nela,
nunca numa conta da AquiHabitto. A mensalidade que o síndico paga pra
AquiHabitto continua separada, pelo Stripe.

A subconta é criada **automaticamente** assim que o condomínio é
cadastrado (`ativarCobrancaBoleto()`, chamada no fim de
`complete-signup` e `dev-signup`) — o CNPJ é **obrigatório** no
formulário de cadastro (validado no front e também no servidor)
justamente pra essa ativação nunca falhar por falta de dado. Mesmo
assim, nunca bloqueia o cadastro se o Asaas recusar por outro motivo
(fora do ar, dado rejeitado, etc.) — fica pendente pra ativação manual
depois: o botão "Ativar cobrança via boleto" em Financeiro
(`/api/financeiro/asaas-subconta`, POST) chama a mesma função e é
idempotente. Também é o caminho pra condomínios criados antes dessa
automação existir.

Fluxo: `/api/financeiro/asaas-subconta` (POST, manual/fallback) cria a
subconta do condomínio; `/api/financeiro/emitir-boleto` (POST, precisa de
`pagador_cpf_cnpj` e `data_vencimento` preenchidos na conta a receber)
emite o boleto de verdade; `/api/webhook-asaas` recebe a confirmação de
pagamento do Asaas e marca a conta como "recebida" automaticamente;
`/api/financeiro/saque` (só o síndico, nunca um membro delegado) transfere
o saldo da subconta pra fora, via PIX ou conta bancária.

**Margem da AquiHabitto por boleto**: ajustável em `/admin/pagamentos`
(aba "Boleto") — é um valor fixo, separado automaticamente a cada boleto
pago via split do Asaas (`config_boleto.margem_valor` no schema, lido em
`/api/financeiro/emitir-boleto`). Precisa de `ASAAS_WALLET_ID` configurado
(a wallet da conta-mãe) pra o split funcionar — sem isso, 100% do boleto
vai pro condomínio, sem split nenhum.

### Configurar

1. **Sandbox primeiro**: crie uma conta grátis em
   [sandbox.asaas.com](https://sandbox.asaas.com) — é um ambiente
   totalmente separado da produção, com boleto de teste (tem um botão
   "Confirmar pagamento" pra simular o morador pagando, sem banco de
   verdade). Gere a API key da conta-mãe ali e coloque em
   `ASAAS_API_KEY`, com `ASAAS_ENV=sandbox`.
2. Em Integrações → Webhooks (no painel do Asaas), cadastre
   `https://SEU_DOMINIO/api/webhook-asaas`, escolha um token de 32+
   caracteres (nunca a API key) e coloque o mesmo valor em
   `ASAAS_WEBHOOK_TOKEN`.
3. **Antes de trocar pra produção** (`ASAAS_ENV=production` + API key de
   produção), é preciso resolver duas coisas direto com o Asaas, fora do
   código:
   - A conta-mãe precisa ser pessoa jurídica (CNPJ) — subconta via API
     não funciona com conta pessoa física.
   - Toda subconta criada via API nasce num **período de avaliação
     regulatória** do Banco Central: limite de 10 subcontas, até
     R$ 2.000 cobrados por subconta, e 60 dias — depois disso, a emissão
     de boleto e a criação de subconta nova ficam bloqueadas até você
     pedir a **homologação regulatória** com o Asaas. Pra um condomínio
     de verdade cobrando mensalidade de vários moradores, esse limite
     esgota rápido — comece essa conversa com o Asaas com antecedência,
     não deixe pra última hora.

## Lembretes (`/dashboard/lembretes`)

Painel central de compromissos do síndico — reúne lembretes manuais e um
espelho (por referência, nunca cópia) dos alertas de Manutenção. Financeiro
nunca teve alerta automático agendado em nenhum condomínio; a tela só lê
`contas_pagar`/`contas_receber` em tempo real pra exibir junto, sem gerar
linha nem notificação nova.

- **Lembretes manuais**: título, descrição, data do alerta, data limite,
  prioridade, recorrência e um ou vários estágios de aviso (ex.: 2 meses /
  1 mês / 15 dias antes). Privado por padrão; o síndico pode compartilhar
  com membros específicos (só abre visualização daquele lembrete, nunca
  acesso a outro módulo).
- **Manutenção**: o formulário de criação agora aceita marcar vários dias
  de antecedência (em vez de só um). O cron (`/api/cron/lembretes`, 1x/dia)
  sincroniza um lembrete espelho por ordem aberta com `data_prevista`
  configurada, recalcula os estágios sempre que a data ou a configuração
  mudar, e fecha o espelho sozinho quando a ordem é concluída — sem nunca
  mexer na ordem de manutenção em si.
- **Sino de notificações**: no topo do dashboard, mostra quantos lembretes
  estão atrasados/vencendo em breve e um pop-up ao entrar (fechar o pop-up
  não conclui nada — só evita repetir no mesmo dia; o lembrete continua na
  lista central).
- **Permissão**: módulo concedível igual aos demais (`visualizar`, `criar`,
  `editar`, `excluir` em Acessos) — ninguém além do síndico vê por padrão.
- **E-mail**: o cron manda e-mail pro síndico (`condominios.owner_email`)
  em cada estágio configurado, e uma cutucada semanal (não diária) pra
  lembrete vencido ainda pendente. É o único canal — não há WhatsApp no
  sistema (ver seção de Notificações).
- **Push no app mobile (celular com app fechado)**: infraestrutura
  preparada mas **não implementada** — falta criar um projeto Firebase
  (FCM), instalar `@capacitor/push-notifications` e recompilar o app
  Android. A tabela `lembretes_dispositivos` já existe no banco pra isso,
  só não é usada ainda. Como o app hoje é a mesma página web dentro da
  WebView do Capacitor, a tela de Lembretes e o sino já aparecem
  normalmente no app — só não chega notificação com o app fechado.

## Estrutura

```
/app
  page.jsx                 # Landing page + modais de login/cadastro
  layout.jsx                # Layout raiz (fontes, AuthProvider)
  dashboard/
    layout.jsx               # Rota protegida + header/nav do dashboard
    page.jsx                 # Visão geral
    boletos/                 # Placeholder (depende de integração bancária)
    chamados/, avisos/       # CRUD real, síndico + papéis relevantes
    ocorrencias/              # Porteiro registra, síndico acompanha
    acessos/                  # Síndico cria/remove contas delimitadas (só síndico)
    configuracoes/
  admin/
    layout.jsx                # AdminGuard + AdminSidebar
    page.jsx                  # Painel do administrador (owner)
  api/
    create-payment-intent/   # Cria PaymentIntent de R$1 (validação do cartão)
    complete-signup/         # Cria cliente/assinatura Stripe + usuário/condomínio
    dev-signup/               # Cadastro sem Stripe (modo de teste, ALLOW_TEST_SIGNUP)
    webhook/                 # Sincroniza status da assinatura
    members/
      create/                  # Cria conta delimitada (condômino/porteiro/conselheiro)
      delete/                  # Remove acesso delimitado
    admin/
      overview/                # Todos os condomínios + MRR + analytics (owner only)
      cancel-subscription/     # Cancela assinatura de um tenant (owner only)
      suspend-subscription/    # Suspende acesso + pausa cobrança no Stripe (owner only)
      reactivate-subscription/ # Reativa acesso suspenso (owner only)
      grant-promise/           # Libera acesso por promessa de pagamento (owner only)
      grant-courtesy/          # Concede cortesia/acesso grátis (owner only)

/components                 # Header, LandingHero, Pricing, SignupForm, etc.
/hooks/useAuth.js            # Contexto de autenticação + papel (sindico/condomino/...)
/lib                         # Clientes Supabase/Stripe, definição dos planos, memberAuth
/supabase/schema.sql          # Schema: condominios, membros, chamados, avisos,
                               # ocorrencias, propostas — todos com RLS
```
