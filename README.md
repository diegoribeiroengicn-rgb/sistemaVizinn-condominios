# Vizinn — Gestão de Condomínio Inteligente

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

**Boletos**: a tela existe mas continua um placeholder — emitir boletos de
verdade (código de barras/PIX) exige integração com um banco ou gateway de
pagamento, que ainda não está configurada.

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
| `WHATSAPP_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID` | [developers.facebook.com/apps](https://developers.facebook.com/apps) → seu app → WhatsApp → API Setup |
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

## Notificações automáticas (e-mail + WhatsApp)

`lib/notificacoes.js` + `/api/notificar` disparam e-mail (Resend) e WhatsApp
(Meta Cloud API) para dois eventos hoje:

- **Encomenda chegou**: ao registrar uma Ocorrência marcando "avisar o
  morador", todo condômino daquela unidade/bloco recebe a notificação.
- **Chamado atribuído**: ao definir um responsável (colaborador ou membro)
  num chamado, essa pessoa recebe a notificação.

Cada tentativa fica registrada em `notificacoes_log` (visível em quem tem
acesso a Auditoria).

### Configurar o Resend (e-mail)

1. Crie uma conta grátis em [resend.com](https://resend.com).
2. Gere uma API key e coloque em `RESEND_API_KEY`.
3. Sem domínio próprio verificado, deixe `EMAIL_FROM=onboarding@resend.dev`
   (funciona pra testar, mas mostra "via resend.dev" pro destinatário —
   verifique seu domínio no Resend quando for pra produção).

### Configurar o WhatsApp (Meta Cloud API)

1. Crie um app em [developers.facebook.com/apps](https://developers.facebook.com/apps),
   adicione o produto "WhatsApp".
2. Em "API Setup", copie o **Temporary access token** (ou gere um permanente
   depois) e o **Phone number ID** — vão em `WHATSAPP_TOKEN` e
   `WHATSAPP_PHONE_NUMBER_ID`.
3. No modo de desenvolvimento, a Meta libera um número de teste grátis e até
   5 números de destino verificados — dá pra testar tudo sem pagar nada.
4. **Crie os dois templates de mensagem** em WhatsApp Manager → Message
   Templates (categoria "Utility"), com estes textos exatos (as variáveis
   `{{1}}`, `{{2}}`... viram os dados reais na hora do envio):

   - **Nome:** `encomenda_chegou`
     **Corpo:** `Olá {{1}}, chegou uma encomenda para você em {{2}}. {{3}}`

   - **Nome:** `chamado_atribuido`
     **Corpo:** `Olá {{1}}, um novo chamado foi atribuído a você: {{2}} (prioridade: {{3}}).`

   A aprovação da Meta costuma levar de minutos a cerca de um dia. Enquanto
   não estiver aprovado, o envio de WhatsApp falha (fica registrado como
   "erro" em `notificacoes_log`) — o e-mail continua funcionando normalmente.
5. Pra produção (enviar pra qualquer número, não só os 5 de teste), é
   preciso verificar a empresa no Meta Business Manager.

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
    layout.jsx                # AdminGuard + AdminHeader
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
