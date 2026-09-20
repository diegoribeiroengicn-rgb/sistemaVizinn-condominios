import { NextResponse } from "next/server";
import { requireCondominioAccess } from "@/lib/memberAuth";
import { notificarPessoa, normalizarTelefone, WHATSAPP_TEMPLATES } from "@/lib/notificacoes";

// Dispara as notificações automáticas de e-mail/WhatsApp. Dois eventos
// hoje — dá pra adicionar mais seguindo o mesmo formato (avisos
// publicados, manutenção com alerta, etc.), sem trocar essa estrutura.
export async function POST(request) {
  const body = await request.json();
  const { condominioId, evento } = body;

  if (evento === "ocorrencia_entrega") {
    return handleOcorrenciaEntrega(request, condominioId, body);
  }
  if (evento === "chamado_atribuido") {
    return handleChamadoAtribuido(request, condominioId, body);
  }
  return NextResponse.json({ error: "Evento de notificação desconhecido." }, { status: 400 });
}

async function handleOcorrenciaEntrega(request, condominioId, { ocorrenciaId, unidade, bloco, descricao }) {
  const auth = await requireCondominioAccess(request, condominioId, "ocorrencias", "criar");
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!unidade) return NextResponse.json({ error: "Informe a unidade para notificar o morador." }, { status: 400 });

  const { supabaseAdmin } = auth;

  const [{ data: condominio }, { data: moradores, error: moradoresError }] = await Promise.all([
    supabaseAdmin.from("condominios").select("nome").eq("id", condominioId).maybeSingle(),
    (() => {
      let query = supabaseAdmin
        .from("membros")
        .select("nome, email, telefone")
        .eq("condominio_id", condominioId)
        .eq("papel", "condomino")
        .eq("unidade", unidade);
      if (bloco) query = query.eq("bloco", bloco);
      return query;
    })(),
  ]);

  if (moradoresError) {
    return NextResponse.json({ error: moradoresError.message }, { status: 500 });
  }
  if (!moradores || moradores.length === 0) {
    return NextResponse.json({ success: true, notificados: 0, aviso: "Nenhum morador encontrado para essa unidade." });
  }

  const nomeCondominio = condominio?.nome || "seu condomínio";
  const resultados = [];
  for (const morador of moradores) {
    const whatsapp = normalizarTelefone({ telefone: morador.telefone });
    const mensagemTexto = descricao?.trim() || "Retire na portaria quando puder.";
    const r = await notificarPessoa(supabaseAdmin, {
      condominioId,
      evento: "ocorrencia_entrega",
      referenciaId: ocorrenciaId,
      nome: morador.nome,
      email: morador.email,
      whatsapp,
      template: WHATSAPP_TEMPLATES.encomenda_chegou,
      parametrosEmail: {
        subject: `📦 Chegou uma encomenda para você — ${nomeCondominio}`,
        html: `<p>Olá, ${morador.nome}!</p><p>Chegou uma encomenda para você em <strong>${nomeCondominio}</strong>.</p><p>${mensagemTexto}</p>`,
      },
      parametrosWhatsapp: [morador.nome, nomeCondominio, mensagemTexto],
    });
    resultados.push({ morador: morador.nome, resultados: r });
  }

  return NextResponse.json({ success: true, notificados: moradores.length, resultados });
}

async function handleChamadoAtribuido(request, condominioId, { chamadoId, titulo, prioridade, colaboradorId, membroUserId }) {
  const auth = await requireCondominioAccess(request, condominioId, "chamados", "editar");
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { supabaseAdmin } = auth;

  let destinatario = null;
  if (colaboradorId) {
    const { data: colaborador, error } = await supabaseAdmin
      .from("colaboradores")
      .select("nome, email, whatsapp_ddi, whatsapp_ddd, whatsapp_numero, tem_whatsapp")
      .eq("id", colaboradorId)
      .eq("condominio_id", condominioId)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (colaborador) {
      destinatario = {
        nome: colaborador.nome,
        email: colaborador.email,
        whatsapp: colaborador.tem_whatsapp
          ? normalizarTelefone({ ddi: colaborador.whatsapp_ddi, ddd: colaborador.whatsapp_ddd, numero: colaborador.whatsapp_numero })
          : null,
      };
    }
  } else if (membroUserId) {
    const { data: membro, error } = await supabaseAdmin
      .from("membros")
      .select("nome, email, telefone")
      .eq("user_id", membroUserId)
      .eq("condominio_id", condominioId)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (membro) {
      destinatario = { nome: membro.nome, email: membro.email, whatsapp: normalizarTelefone({ telefone: membro.telefone }) };
    }
  }

  if (!destinatario) {
    return NextResponse.json({ success: true, notificado: false, aviso: "Responsável sem contato cadastrado." });
  }

  const resultados = await notificarPessoa(supabaseAdmin, {
    condominioId,
    evento: "chamado_atribuido",
    referenciaId: chamadoId,
    nome: destinatario.nome,
    email: destinatario.email,
    whatsapp: destinatario.whatsapp,
    template: WHATSAPP_TEMPLATES.chamado_atribuido,
    parametrosEmail: {
      subject: `Novo chamado atribuído a você: ${titulo}`,
      html: `<p>Olá, ${destinatario.nome}!</p><p>Um novo chamado foi atribuído a você: <strong>${titulo}</strong> (prioridade: ${prioridade || "normal"}).</p>`,
    },
    parametrosWhatsapp: [destinatario.nome, titulo, prioridade || "normal"],
  });

  return NextResponse.json({ success: true, notificado: true, resultados });
}
