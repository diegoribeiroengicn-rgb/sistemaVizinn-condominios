# Smoke tests (Playwright)

Cobrem só o caminho feliz dos 4 fluxos mais críticos: login, cadastro de
morador, registrar entrada na portaria e lançar uma conta no financeiro.
Não substituem teste manual — servem pra pegar "quebrei o básico" antes
de um push, não pra cobrir casos de borda.

## Como rodar

Precisam de um servidor rodando de verdade (local ou staging) com:

- Variáveis reais do Supabase (`NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).
- `ALLOW_TEST_SIGNUP=true` — os testes criam uma conta de condomínio nova
  a cada execução via `/api/dev-signup` (sem tocar no Stripe), pra não
  depender de uma conta fixa pré-cadastrada.

```bash
npm run dev          # num terminal, com o .env configurado
E2E_BASE_URL=http://localhost:3000 npm run test:e2e   # noutro terminal
```

Sem `E2E_BASE_URL`, o padrão já é `http://localhost:3000`.

**Nunca rode isso contra produção** com `ALLOW_TEST_SIGNUP=true` — essa
flag também libera o botão "pular pagamento" no cadastro público. Use
local ou um ambiente de staging isolado.
