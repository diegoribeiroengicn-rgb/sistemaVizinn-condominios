// Envio de notificações automáticas — e-mail via Resend, WhatsApp via
// Meta Cloud API (WhatsApp Business Platform). Server-only: usa chaves
// secretas (RESEND_API_KEY, WHATSAPP_TOKEN) que nunca podem chegar ao
// navegador — só é importado de dentro de app/api/notificar.
//
// O WhatsApp exige que toda mensagem iniciada pela empresa (fora de uma
// janela de atendimento de 24h) use um "template" pré-aprovado pela Meta.
// Os nomes abaixo (WHATSAPP_TEMPLATES) precisam existir, aprovados, no
// WhatsApp Manager da conta — ver README para o texto exato de cada um.
export const WHATSAPP_TEMPLATES = {
  encomenda_chegou: "encomenda_chegou",
  chamado_atribuido: "chamado_atribuido",
  chamado_morador: "chamado_morador",
  chamado_concluido: "chamado_concluido",
  manutencao_aviso: "manutencao_aviso",
  ocorrencia_aviso_geral: "ocorrencia_aviso_geral",
  aviso_publicado: "aviso_publicado",
  acesso_login: "acesso_login",
};

const RESEND_API_URL = "https://api.resend.com/emails";
const WHATSAPP_API_VERSION = "v20.0";

function whatsappApiUrl(phoneNumberId) {
  return `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${phoneNumberId}/messages`;
}

// Normaliza um telefone brasileiro pra E.164 (só dígitos, com DDI 55) —
// aceita tanto o campo único "telefone" (membros) quanto DDI/DDD/número
// separados (colaboradores).
export function normalizarTelefone({ telefone, ddi, ddd, numero } = {}) {
  if (telefone) {
    const digitos = telefone.replace(/\D/g, "");
    if (!digitos) return null;
    return digitos.startsWith("55") ? digitos : `55${digitos}`;
  }
  if (numero) {
    const digitosDdi = (ddi || "55").replace(/\D/g, "") || "55";
    const digitosDdd = (ddd || "").replace(/\D/g, "");
    const digitosNumero = numero.replace(/\D/g, "");
    if (!digitosNumero) return null;
    return `${digitosDdi}${digitosDdd}${digitosNumero}`;
  }
  return null;
}

// `fromName` é o nome que aparece na caixa de entrada do destinatário
// (ex: "Condomínio Jardim das Flores <onboarding@resend.dev>") — o
// endereço em si continua sendo o mesmo (EMAIL_FROM), só o nome de
// exibição muda por condomínio. Funciona mesmo sem domínio próprio
// verificado no Resend.
export async function enviarEmail({ to, subject, html, fromName, replyTo }) {
  const apiKey = process.env.RESEND_API_KEY;
  const enderecoFrom = process.env.EMAIL_FROM || "onboarding@resend.dev";
  const from = fromName ? `${fromName} <${enderecoFrom}>` : enderecoFrom;
  if (!apiKey) throw new Error("RESEND_API_KEY não configurada.");
  if (!to) throw new Error("Destinatário de e-mail ausente.");

  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html, ...(replyTo ? { reply_to: replyTo } : {}) }),
  });

  if (!res.ok) {
    const corpo = await res.text().catch(() => "");
    throw new Error(`Resend respondeu ${res.status}: ${corpo}`);
  }
}

// `parametros` = lista de strings, na ordem das variáveis {{1}}, {{2}}...
// do corpo do template aprovado.
export async function enviarWhatsapp({ to, template, parametros = [] }) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) throw new Error("WHATSAPP_TOKEN/WHATSAPP_PHONE_NUMBER_ID não configurados.");
  if (!to) throw new Error("Destinatário de WhatsApp ausente.");

  const res = await fetch(whatsappApiUrl(phoneNumberId), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: template,
        language: { code: "pt_BR" },
        components:
          parametros.length > 0
            ? [{ type: "body", parameters: parametros.map((texto) => ({ type: "text", text: String(texto) })) }]
            : undefined,
      },
    }),
  });

  if (!res.ok) {
    const corpo = await res.text().catch(() => "");
    throw new Error(`WhatsApp API respondeu ${res.status}: ${corpo}`);
  }
}

export async function registrarNotificacao(supabaseAdmin, { condominioId, evento, referenciaId, canal, destinatarioNome, destinatarioContato, status, erroMensagem }) {
  const { error } = await supabaseAdmin.from("notificacoes_log").insert({
    condominio_id: condominioId,
    evento,
    referencia_id: referenciaId || null,
    canal,
    destinatario_nome: destinatarioNome || null,
    destinatario_contato: destinatarioContato || null,
    status,
    erro_mensagem: erroMensagem || null,
  });
  if (error) console.error("Erro ao registrar notificacoes_log:", error.message);
}

// Envia por e-mail e WhatsApp (o que houver disponível) e registra cada
// tentativa — nunca lança erro pra quem chamou: uma notificação que falha
// não pode derrubar o fluxo principal (criar ocorrência, atribuir
// chamado). Retorna um resumo pra quem quiser exibir/depurar.
export async function notificarPessoa(supabaseAdmin, { condominioId, evento, referenciaId, nome, email, whatsapp, template, parametrosEmail, parametrosWhatsapp, fromName }) {
  const resultados = [];

  if (email) {
    try {
      await enviarEmail({ to: email, subject: parametrosEmail.subject, html: parametrosEmail.html, fromName });
      resultados.push({ canal: "email", status: "enviado" });
      await registrarNotificacao(supabaseAdmin, {
        condominioId,
        evento,
        referenciaId,
        canal: "email",
        destinatarioNome: nome,
        destinatarioContato: email,
        status: "enviado",
      });
    } catch (err) {
      resultados.push({ canal: "email", status: "erro", erro: err.message });
      await registrarNotificacao(supabaseAdmin, {
        condominioId,
        evento,
        referenciaId,
        canal: "email",
        destinatarioNome: nome,
        destinatarioContato: email,
        status: "erro",
        erroMensagem: err.message,
      });
    }
  }

  if (whatsapp) {
    try {
      await enviarWhatsapp({ to: whatsapp, template, parametros: parametrosWhatsapp });
      resultados.push({ canal: "whatsapp", status: "enviado" });
      await registrarNotificacao(supabaseAdmin, {
        condominioId,
        evento,
        referenciaId,
        canal: "whatsapp",
        destinatarioNome: nome,
        destinatarioContato: whatsapp,
        status: "enviado",
      });
    } catch (err) {
      resultados.push({ canal: "whatsapp", status: "erro", erro: err.message });
      await registrarNotificacao(supabaseAdmin, {
        condominioId,
        evento,
        referenciaId,
        canal: "whatsapp",
        destinatarioNome: nome,
        destinatarioContato: whatsapp,
        status: "erro",
        erroMensagem: err.message,
      });
    }
  }

  return resultados;
}
