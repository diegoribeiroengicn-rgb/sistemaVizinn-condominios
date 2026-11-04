// Integração com o Asaas (gateway de pagamento) — emite boleto em nome do
// condomínio via subconta própria (o dinheiro do morador cai direto nela,
// nunca numa conta da AquiHabitto) e faz a transferência (saque) pro
// síndico quando ele pedir. Server-only: usa ASAAS_API_KEY (chave da
// conta-mãe) e a api_key de cada subconta, que nunca podem chegar ao
// navegador.
//
// Autenticação do Asaas é por header `access_token` (não é Bearer).
// Sandbox e produção têm base URLs diferentes — ver ASAAS_ENV.

function baseUrl() {
  return process.env.ASAAS_ENV === "production" ? "https://api.asaas.com/v3" : "https://api-sandbox.asaas.com/v3";
}

async function asaasRequest(apiKey, method, path, body) {
  if (!apiKey) throw new Error("Chave de API do Asaas ausente.");
  const res = await fetch(`${baseUrl()}${path}`, {
    method,
    headers: {
      access_token: apiKey,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.errors?.map((e) => e.description).join("; ") || `Asaas respondeu ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

// Cria a subconta do condomínio na conta-mãe (ASAAS_API_KEY). O apiKey da
// subconta só vem nessa resposta — precisa salvar imediatamente
// (condominios_asaas.api_key), não tem como recuperar depois.
export async function criarSubconta({ nome, email, cpfCnpj, telefone, endereco }) {
  const apiKeyMae = process.env.ASAAS_API_KEY;
  const data = await asaasRequest(apiKeyMae, "POST", "/accounts", {
    name: nome,
    email,
    cpfCnpj: (cpfCnpj || "").replace(/\D/g, ""),
    companyType: "LIMITED",
    mobilePhone: telefone ? telefone.replace(/\D/g, "") : undefined,
    address: endereco || undefined,
  });
  return { accountId: data.id, apiKey: data.apiKey, walletId: data.walletId };
}

// Cria (ou garante que existe) o "cliente" do Asaas correspondente ao
// morador/pagador, usando a chave da SUBCONTA do condomínio — fica
// isolado por condomínio, não se mistura entre tenants.
export async function garantirClienteAsaas(apiKeySubconta, { nome, cpfCnpj, email }) {
  const cpfCnpjLimpo = (cpfCnpj || "").replace(/\D/g, "");
  const existentes = await asaasRequest(apiKeySubconta, "GET", `/customers?cpfCnpj=${cpfCnpjLimpo}`);
  if (existentes?.data?.length > 0) return existentes.data[0].id;

  const criado = await asaasRequest(apiKeySubconta, "POST", "/customers", {
    name: nome,
    cpfCnpj: cpfCnpjLimpo,
    email: email || undefined,
  });
  return criado.id;
}

// Emite o boleto em si (uma cobrança do tipo BOLETO) pela subconta do
// condomínio. `boleto_url`/`linha_digitavel` ficam disponíveis pro
// síndico mandar pro morador ou pro próprio sistema mostrar.
//
// `margemAquihabitto` (opcional): quando informado junto com
// ASAAS_WALLET_ID (a carteira da conta-mãe, não da subconta), separa
// esse valor fixo pra AquiHabitto automaticamente a cada boleto PAGO —
// o resto cai inteiro na subconta do condomínio. Sem isso, 100% vai pro
// condomínio (só o Asaas desconta a taxa dele).
export async function emitirBoleto(apiKeySubconta, { customerId, valor, vencimento, descricao, margemAquihabitto }) {
  const walletPlataforma = process.env.ASAAS_WALLET_ID;
  const split = margemAquihabitto > 0 && walletPlataforma ? [{ walletId: walletPlataforma, fixedValue: margemAquihabitto }] : undefined;

  const cobranca = await asaasRequest(apiKeySubconta, "POST", "/payments", {
    customer: customerId,
    billingType: "BOLETO",
    value: valor,
    dueDate: vencimento,
    description: descricao,
    split,
  });
  return {
    chargeId: cobranca.id,
    boletoUrl: cobranca.bankSlipUrl || cobranca.invoiceUrl || null,
    // Nem toda resposta de criação já traz a linha digitável pronta —
    // se vier vazio aqui, dá pra buscar depois em GET /payments/{id}/billingInfo.
    linhaDigitavel: cobranca.identificationField || null,
    status: cobranca.status,
  };
}

// Transferência (saque) do saldo da subconta pra fora do Asaas — via
// chave PIX ou dados bancários. Um dos dois é obrigatório.
export async function criarTransferencia(apiKeySubconta, { valor, pixAddressKey, contaBancaria }) {
  const body = { value: valor };
  if (pixAddressKey) {
    body.pixAddressKey = pixAddressKey;
  } else if (contaBancaria) {
    body.bankAccount = contaBancaria;
  } else {
    throw new Error("Informe uma chave PIX ou os dados da conta bancária pra sacar.");
  }
  const data = await asaasRequest(apiKeySubconta, "POST", "/transfers", body);
  return { transferId: data.id, status: data.status };
}

// Consulta o saldo disponível da subconta (pra mostrar antes do saque).
export async function consultarSaldo(apiKeySubconta) {
  const data = await asaasRequest(apiKeySubconta, "GET", "/finance/balance");
  return data.balance;
}

// Confere o header `asaas-access-token` do webhook contra o token
// configurado no painel do Asaas (ASAAS_WEBHOOK_TOKEN) — sem isso,
// qualquer um poderia simular um "pagamento recebido" falso.
export function verificarTokenWebhook(request) {
  const token = request.headers.get("asaas-access-token");
  const esperado = process.env.ASAAS_WEBHOOK_TOKEN;
  return Boolean(esperado) && token === esperado;
}
