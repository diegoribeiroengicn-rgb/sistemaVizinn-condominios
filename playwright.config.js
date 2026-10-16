import { defineConfig } from "@playwright/test";

// Smoke tests mínimos — não substituem teste manual, só garantem que o
// básico (login, cadastro de pessoa, portaria, lançamento financeiro)
// não quebrou antes de um push. Precisam de um servidor rodando com
// variáveis reais do Supabase e ALLOW_TEST_SIGNUP=true (cria conta de
// teste sem passar pelo Stripe — ver lib/dev-signup).
const baseURL = process.env.E2E_BASE_URL || "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    headless: true,
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
});
