import { NextResponse } from "next/server";
import { enviarEmail } from "@/lib/notificacoes";
import { parseEmailList } from "@/lib/emailList";

// Endpoint público do formulário "Fale Conosco" da landing page — sem
// autenticação, envia direto pro e-mail do dono do sistema (CONTATO_EMAIL,
// ou o primeiro de ADMIN_EMAILS se não configurado).
function escapeHtml(texto) {
  return String(texto)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function POST(request) {
  const body = await request.json().catch(() => null);
  const nome = body?.nome?.trim();
  const email = body?.email?.trim();
  const mensagem = body?.mensagem?.trim();

  if (!nome || !email || !mensagem) {
    return NextResponse.json({ error: "Preencha nome, e-mail e mensagem." }, { status: 400 });
  }

  const destinatario = process.env.CONTATO_EMAIL || parseEmailList(process.env.ADMIN_EMAILS)[0];
  if (!destinatario) {
    return NextResponse.json({ error: "Contato não configurado." }, { status: 500 });
  }

  try {
    await enviarEmail({
      to: destinatario,
      subject: `Fale Conosco — ${nome}`,
      html: `<p><strong>Nome:</strong> ${escapeHtml(nome)}</p><p><strong>E-mail:</strong> ${escapeHtml(email)}</p><p><strong>Mensagem:</strong></p><p>${escapeHtml(mensagem).replace(/\n/g, "<br/>")}</p>`,
      fromName: "Vizinn — Fale Conosco",
      replyTo: email,
    });
  } catch (err) {
    console.error("Erro ao enviar contato:", err.message);
    return NextResponse.json({ error: "Não foi possível enviar sua mensagem. Tente novamente." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
