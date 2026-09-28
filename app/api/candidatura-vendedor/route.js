import { NextResponse } from "next/server";
import { enviarEmail } from "@/lib/notificacoes";
import { parseEmailList } from "@/lib/emailList";

// Endpoint público da landing page — alguém interessado em ser
// representante comercial Habittum manda os dados de contato e a gente
// só avisa por e-mail (mesmo padrão simples do "Fale Conosco" em
// /api/contato — sem cadastro automático de vendedor: quem decide
// aprovar e criar o acesso é o admin, em /admin/pagamentos).
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
  const telefone = body?.telefone?.trim();
  const mensagem = body?.mensagem?.trim();

  if (!nome || !email || !telefone) {
    return NextResponse.json({ error: "Preencha nome, e-mail e telefone." }, { status: 400 });
  }

  const destinatario = process.env.CONTATO_EMAIL || parseEmailList(process.env.ADMIN_EMAILS)[0];
  if (!destinatario) {
    return NextResponse.json({ error: "Contato não configurado." }, { status: 500 });
  }

  try {
    await enviarEmail({
      to: destinatario,
      subject: `Candidatura a representante comercial — ${nome}`,
      html: `<p><strong>Nome:</strong> ${escapeHtml(nome)}</p><p><strong>E-mail:</strong> ${escapeHtml(email)}</p><p><strong>Telefone/WhatsApp:</strong> ${escapeHtml(telefone)}</p>${mensagem ? `<p><strong>Mensagem:</strong></p><p>${escapeHtml(mensagem).replace(/\n/g, "<br/>")}</p>` : ""}`,
      fromName: "Habittum — Candidatura a representante",
      replyTo: email,
    });
  } catch (err) {
    console.error("Erro ao enviar candidatura de representante:", err.message);
    return NextResponse.json({ error: "Não foi possível enviar. Tente novamente." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
