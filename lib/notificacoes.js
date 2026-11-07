// Envio de notificações automáticas — e-mail via Resend. Server-only: usa
// chaves secretas (RESEND_API_KEY) que nunca podem chegar ao navegador —
// só é importado de dentro de app/api/notificar.
//
// WhatsApp foi removido do fluxo de notificação (ficava caro/complexo de
// manter aprovado na Meta pro volume baixo de um condomínio). Se quiser
// reativar no futuro, dá pra olhar o histórico do git deste arquivo.

const RESEND_API_URL = "https://api.resend.com/emails";

// Normaliza um telefone brasileiro pra E.164 (só dígitos, com DDI 55) —
// usado hoje só como chave de deduplicação de morador (e-mail/telefone/nome)
// quando não há e-mail cadastrado. Aceita tanto o campo único "telefone"
// (membros) quanto DDI/DDD/número separados (colaboradores).
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

// Envia por e-mail e registra a tentativa — nunca lança erro pra quem
// chamou: uma notificação que falha não pode derrubar o fluxo principal
// (criar ocorrência, atribuir chamado). Retorna um resumo pra quem quiser
// exibir/depurar. `canais` continua aceito (hoje só "email" tem efeito)
// pra não exigir mudança nos chamadores existentes.
export async function notificarPessoa(supabaseAdmin, { condominioId, evento, referenciaId, nome, email, parametrosEmail, fromName, canais }) {
  const resultados = [];
  const permiteEmail = !canais || canais.includes("email");

  if (email && permiteEmail) {
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

  return resultados;
}
