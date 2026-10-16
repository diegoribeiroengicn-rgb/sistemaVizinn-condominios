import { test, expect } from "@playwright/test";
import crypto from "node:crypto";

// Smoke tests mínimos pedidos no relatório de auditoria do sistema:
// login, cadastro de pessoa, portaria e lançamento financeiro. Não
// cobrem edge case nenhum — só confirmam que o caminho feliz de cada
// fluxo crítico não quebrou. Precisam de um servidor com
// ALLOW_TEST_SIGNUP=true (cria conta sem passar pelo Stripe, ver
// app/api/dev-signup/route.js) e variáveis reais do Supabase — ver
// E2E_SETUP.md.
function contaUnica() {
  const sufixo = crypto.randomBytes(4).toString("hex");
  return {
    email: `smoke-${sufixo}@aquihabitto.test`,
    password: `Senha!${sufixo}123`,
    fullName: "Smoke Test",
    condominioNome: `Condomínio Smoke ${sufixo}`,
    planId: "starter",
  };
}

let conta;

test.beforeAll(async ({ request }) => {
  conta = contaUnica();
  const resp = await request.post("/api/dev-signup", { data: conta });
  if (!resp.ok()) {
    throw new Error(
      `Não consegui criar a conta de teste (HTTP ${resp.status()}). Confirme que o servidor usado pelos testes tem ALLOW_TEST_SIGNUP=true e as variáveis do Supabase configuradas. Resposta: ${await resp.text()}`
    );
  }
});

async function login(page) {
  await page.goto("/login");
  await page.getByTestId("login-email").fill(conta.email);
  await page.getByTestId("login-senha").fill(conta.password);
  await page.getByTestId("login-submit").click();
  await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
}

test("login entra no dashboard", async ({ page }) => {
  await login(page);
  await expect(page).toHaveURL(/\/dashboard/);
});

test("cadastro de morador aparece na lista", async ({ page }) => {
  await login(page);
  await page.goto("/dashboard/moradores");

  const nome = `Morador Smoke ${Date.now()}`;
  await page.getByTestId("morador-unidade").fill("101");
  await page.getByTestId("morador-nome").fill(nome);
  await page.getByTestId("morador-submit").click();

  await expect(page.getByText(nome)).toBeVisible({ timeout: 10_000 });
});

test("registrar entrada na portaria aparece no histórico", async ({ page }) => {
  await login(page);
  await page.goto("/dashboard/portaria");

  const nome = `Visitante Smoke ${Date.now()}`;
  const documento = String(Date.now()).slice(-9);
  await page.getByTestId("portaria-documento").fill(documento);
  await page.getByTestId("portaria-nome").fill(nome);
  await page.getByTestId("portaria-submit").click();

  await expect(page.getByText(nome)).toBeVisible({ timeout: 10_000 });
});

test("lançamento financeiro aparece na lista", async ({ page }) => {
  await login(page);
  await page.goto("/dashboard/financeiro?aba=pagar");

  const descricao = `Lançamento Smoke ${Date.now()}`;
  await page.getByTestId("financeiro-descricao").fill(descricao);
  await page.getByTestId("financeiro-valor").fill("123.45");
  await page.getByTestId("financeiro-submit").click();

  await expect(page.getByText(descricao)).toBeVisible({ timeout: 10_000 });
});
