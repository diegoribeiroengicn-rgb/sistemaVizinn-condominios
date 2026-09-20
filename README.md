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
3. O cartão é validado com uma cobrança de R$ 1,00 (Stripe Elements embutido).
4. Após a confirmação, o backend cria o cliente e a assinatura no Stripe (com
   14 dias de teste), cria o usuário no Supabase Auth e o registro na tabela
   `condominios`.
5. Login automático e redirecionamento para `/dashboard`.
6. Usuários já logados que acessam `/` são redirecionados direto para o
   dashboard.

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

## Estrutura

```
/app
  page.jsx                 # Landing page + modais de login/cadastro
  layout.jsx                # Layout raiz (fontes, AuthProvider)
  dashboard/
    layout.jsx               # Rota protegida + header/nav do dashboard
    page.jsx                 # Visão geral
    boletos/, chamados/, avisos/, configuracoes/
  api/
    create-payment-intent/   # Cria PaymentIntent de R$1 (validação do cartão)
    complete-signup/         # Cria cliente/assinatura Stripe + usuário/condomínio
    webhook/                 # Sincroniza status da assinatura

/components                 # Header, LandingHero, Pricing, SignupForm, etc.
/hooks/useAuth.js            # Contexto de autenticação (Supabase)
/lib                         # Clientes Supabase/Stripe e definição dos planos
/supabase/schema.sql          # Schema da tabela condominios
```
