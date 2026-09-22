import { NextResponse } from "next/server";
import { requireCondominioAccess } from "@/lib/memberAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { notificarPessoa, normalizarTelefone, WHATSAPP_TEMPLATES } from "@/lib/notificacoes";

// Dispara as notificações automáticas de e-mail/WhatsApp. Cada evento
// segue o mesmo formato: valida acesso, busca destinatário(s), chama
// notificarPessoa() — que tenta os dois canais disponíveis e nunca
// lança erro pra quem chamou.
export async function POST(request) {
  const body = await request.json();
  const { condominioId, evento } = body;

  if (evento === "ocorrencia_entrega") return handleOcorrenciaEntrega(request, condominioId, body);
  if (evento === "ocorrencia_aviso_geral") return handleAvisoGeralMoradores(request, condominioId, body, "ocorrencias");
  if (evento === "manutencao_aviso") return handleAvisoGeralMoradores(request, condominioId, body, "manutencao");
  if (evento === "aviso_publicado") return handleAvisoGeralMoradores(request, condominioId, body, "avisos");
  if (evento === "chamado_atribuido") return handleChamadoAtribuido(request, condominioId, body);
  if (evento === "chamado_morador") return handleChamadoMorador(request, condominioId, body);
  if (evento === "chamado_concluido") return handleChamadoConcluido(request, condominioId, body);
  if (evento === "acesso_login") return handleAcessoLogin(request, condominioId, body);
  return NextResponse.json({ error: "Evento de notificação desconhecido." }, { status: 400 });
}

// Todos os moradores do condomínio (cadastro em Moradores + quem tem
// login com papel=condomino), deduplicados por e-mail/telefone/nome —
// mesma lógica já usada por handleOcorrenciaEntrega, só sem o filtro
// de unidade.
async function buscarTodosMoradores(supabaseAdmin, condominioId) {
  const [{ data: cadastro, error: cadastroError }, { data: membrosCondominos, error: membrosError }] = await Promise.all([
    supabaseAdmin.from("moradores").select("nome, email, telefone").eq("condominio_id", condominioId),
    supabaseAdmin.from("membros").select("nome, email, telefone").eq("condominio_id", condominioId).eq("papel", "condomino"),
  ]);
  if (cadastroError) throw new Error(cadastroError.message);
  if (membrosError) throw new Error(membrosError.message);

  const vistos = new Set();
  const moradores = [];
  for (const pessoa of [...(cadastro || []), ...(membrosCondominos || [])]) {
    const chave = (pessoa.email || "").toLowerCase() || normalizarTelefone({ telefone: pessoa.telefone }) || pessoa.nome;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    moradores.push(pessoa);
  }
  return moradores;
}

async function handleOcorrenciaEntrega(request, condominioId, { ocorrenciaId, unidade, bloco, descricao }) {
  const auth = await requireCondominioAccess(request, condominioId, "ocorrencias", "criar");
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!unidade) return NextResponse.json({ error: "Informe a unidade para notificar o morador." }, { status: 400 });

  const { supabaseAdmin } = auth;

  const [{ data: condominio }, { data: cadastro, error: cadastroError }, { data: membrosCondominos, error: membrosError }] =
    await Promise.all([
      supabaseAdmin.from("condominios").select("nome").eq("id", condominioId).maybeSingle(),
      (() => {
        let query = supabaseAdmin
          .from("moradores")
          .select("nome, email, telefone")
          .eq("condominio_id", condominioId)
          .eq("unidade", unidade);
        if (bloco) query = query.eq("bloco", bloco);
        return query;
      })(),
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

  if (cadastroError) return NextResponse.json({ error: cadastroError.message }, { status: 500 });
  if (membrosError) return NextResponse.json({ error: membrosError.message }, { status: 500 });

  const vistos = new Set();
  const moradores = [];
  for (const pessoa of [...(cadastro || []), ...(membrosCondominos || [])]) {
    const chave = (pessoa.email || "").toLowerCase() || normalizarTelefone({ telefone: pessoa.telefone }) || pessoa.nome;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    moradores.push(pessoa);
  }

  if (moradores.length === 0) {
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
      fromName: nomeCondominio,
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

// Compartilhado por Ocorrências (aviso geral), Manutenção e Avisos:
// manda pra TODOS os moradores do condomínio, sem filtro de unidade.
// `origem` decide o módulo/ação exigidos e o texto do e-mail.
const AVISO_GERAL_CONFIG = {
  ocorrencias: { modulo: "ocorrencias", acao: "criar", evento: "ocorrencia_aviso_geral", template: WHATSAPP_TEMPLATES.ocorrencia_aviso_geral, tituloPadrao: "Ocorrência registrada" },
  manutencao: { modulo: "manutencao", acao: "criar", evento: "manutencao_aviso", template: WHATSAPP_TEMPLATES.manutencao_aviso, tituloPadrao: "Manutenção programada" },
  avisos: { modulo: "avisos", acao: "criar", evento: "aviso_publicado", template: WHATSAPP_TEMPLATES.aviso_publicado, tituloPadrao: "Novo aviso" },
};

async function handleAvisoGeralMoradores(request, condominioId, { referenciaId, titulo, mensagem }, origem) {
  const config = AVISO_GERAL_CONFIG[origem];
  const auth = await requireCondominioAccess(request, condominioId, config.modulo, config.acao);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { supabaseAdmin } = auth;

  let condominio, moradores;
  try {
    [{ data: condominio }, moradores] = await Promise.all([
      supabaseAdmin.from("condominios").select("nome").eq("id", condominioId).maybeSingle(),
      buscarTodosMoradores(supabaseAdmin, condominioId),
    ]);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }

  if (moradores.length === 0) {
    return NextResponse.json({ success: true, notificados: 0, aviso: "Nenhum morador cadastrado com contato." });
  }

  const nomeCondominio = condominio?.nome || "seu condomínio";
  const tituloFinal = titulo?.trim() || config.tituloPadrao;
  const mensagemFinal = mensagem?.trim() || "";

  const resultados = [];
  for (const morador of moradores) {
    const whatsapp = normalizarTelefone({ telefone: morador.telefone });
    const r = await notificarPessoa(supabaseAdmin, {
      condominioId,
      evento: config.evento,
      referenciaId: referenciaId || null,
      nome: morador.nome,
      email: morador.email,
      whatsapp,
      template: config.template,
      fromName: nomeCondominio,
      parametrosEmail: {
        subject: `${tituloFinal} — ${nomeCondominio}`,
        html: `<p>Olá, ${morador.nome}!</p><p><strong>${tituloFinal}</strong></p>${mensagemFinal ? `<p>${mensagemFinal}</p>` : ""}`,
      },
      parametrosWhatsapp: [morador.nome, tituloFinal, mensagemFinal],
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

  const { data: condominio } = await supabaseAdmin.from("condominios").select("nome").eq("id", condominioId).maybeSingle();
  const nomeCondominio = condominio?.nome || "seu condomínio";

  const resultados = await notificarPessoa(supabaseAdmin, {
    condominioId,
    evento: "chamado_atribuido",
    referenciaId: chamadoId,
    nome: destinatario.nome,
    email: destinatario.email,
    whatsapp: destinatario.whatsapp,
    template: WHATSAPP_TEMPLATES.chamado_atribuido,
    fromName: nomeCondominio,
    parametrosEmail: {
      subject: `Novo chamado atribuído a você: ${titulo}`,
      html: `<p>Olá, ${destinatario.nome}!</p><p>Um novo chamado foi atribuído a você: <strong>${titulo}</strong> (prioridade: ${prioridade || "normal"}).</p>`,
    },
    parametrosWhatsapp: [destinatario.nome, titulo, prioridade || "normal"],
  });

  return NextResponse.json({ success: true, notificado: true, resultados });
}

// Ao criar o chamado com um morador vinculado (campo opcional — pra
// quando quem abre é a portaria/síndico registrando em nome de
// alguém), avisa direto pelo cadastro em Moradores — não depende da
// pessoa ter login no sistema.
async function handleChamadoMorador(request, condominioId, { chamadoId, titulo, moradorId }) {
  const auth = await requireCondominioAccess(request, condominioId, "chamados", "criar");
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!moradorId) return NextResponse.json({ success: true, notificado: false, aviso: "Chamado sem morador vinculado." });

  const { supabaseAdmin } = auth;

  const { data: morador, error } = await supabaseAdmin
    .from("moradores")
    .select("nome, email, telefone")
    .eq("id", moradorId)
    .eq("condominio_id", condominioId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!morador) return NextResponse.json({ success: true, notificado: false, aviso: "Morador não encontrado." });

  const { data: condominio } = await supabaseAdmin.from("condominios").select("nome").eq("id", condominioId).maybeSingle();
  const nomeCondominio = condominio?.nome || "seu condomínio";

  const resultados = await notificarPessoa(supabaseAdmin, {
    condominioId,
    evento: "chamado_morador",
    referenciaId: chamadoId,
    nome: morador.nome,
    email: morador.email,
    whatsapp: normalizarTelefone({ telefone: morador.telefone }),
    template: WHATSAPP_TEMPLATES.chamado_atribuido,
    fromName: nomeCondominio,
    parametrosEmail: {
      subject: `Chamado registrado: ${titulo}`,
      html: `<p>Olá, ${morador.nome}!</p><p>Um chamado foi registrado em seu nome: <strong>${titulo}</strong>. Você será avisado quando for concluído.</p>`,
    },
    parametrosWhatsapp: [morador.nome, titulo],
  });

  return NextResponse.json({ success: true, notificado: true, resultados });
}

// Quando um chamado é concluído, quem precisa saber é o MORADOR — não
// o colaborador que executou, que já sabe porque foi ele quem marcou
// como concluído. Prioriza o morador explicitamente vinculado
// (moradorId, funciona mesmo sem login); sem isso, cai no solicitante
// original SE ele for um condômino com login (fluxo de quando o
// próprio morador abre o chamado logado no sistema).
async function handleChamadoConcluido(request, condominioId, { chamadoId, titulo, moradorId, solicitanteId, resultado }) {
  const auth = await requireCondominioAccess(request, condominioId, "chamados", "editar");
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { supabaseAdmin } = auth;

  let destinatario = null;
  if (moradorId) {
    const { data: morador, error } = await supabaseAdmin
      .from("moradores")
      .select("nome, email, telefone")
      .eq("id", moradorId)
      .eq("condominio_id", condominioId)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (morador) destinatario = { nome: morador.nome, email: morador.email, whatsapp: normalizarTelefone({ telefone: morador.telefone }) };
  } else if (solicitanteId) {
    const { data: solicitante, error } = await supabaseAdmin
      .from("membros")
      .select("nome, email, telefone")
      .eq("user_id", solicitanteId)
      .eq("condominio_id", condominioId)
      .eq("papel", "condomino")
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (solicitante) destinatario = { nome: solicitante.nome, email: solicitante.email, whatsapp: normalizarTelefone({ telefone: solicitante.telefone }) };
  }

  if (!destinatario) {
    return NextResponse.json({ success: true, notificado: false, aviso: "Nenhum morador vinculado a este chamado." });
  }

  const { data: condominio } = await supabaseAdmin.from("condominios").select("nome").eq("id", condominioId).maybeSingle();
  const nomeCondominio = condominio?.nome || "seu condomínio";
  const resultadoTexto = resultado?.trim() || "";

  const resultados = await notificarPessoa(supabaseAdmin, {
    condominioId,
    evento: "chamado_concluido",
    referenciaId: chamadoId,
    nome: destinatario.nome,
    email: destinatario.email,
    whatsapp: destinatario.whatsapp,
    template: WHATSAPP_TEMPLATES.chamado_concluido,
    fromName: nomeCondominio,
    parametrosEmail: {
      subject: `Seu chamado foi concluído: ${titulo}`,
      html: `<p>Olá, ${destinatario.nome}!</p><p>O chamado <strong>${titulo}</strong> foi concluído.</p>${resultadoTexto ? `<p>${resultadoTexto}</p>` : ""}`,
    },
    parametrosWhatsapp: [destinatario.nome, titulo, resultadoTexto],
  });

  return NextResponse.json({ success: true, notificado: true, resultados });
}

// Alerta de login: opcional, controlado em Configurações
// (condominios.notificar_acessos_login). Não usa requireCondominioAccess
// porque um condômino comum não tem (nem precisa ter) permissão em
// nenhum módulo específico pra disparar isso — só precisa ser membro
// desse condomínio. Nunca dispara pro próprio síndico entrando na
// conta dele.
async function handleAcessoLogin(request, condominioId, { nome, papel }) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!condominioId) return NextResponse.json({ error: "condominioId é obrigatório." }, { status: 400 });

  const supabaseAdmin = getSupabaseAdmin();
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData?.user) return NextResponse.json({ error: "Sessão inválida ou expirada." }, { status: 401 });

  const { data: condominio, error: condoError } = await supabaseAdmin
    .from("condominios")
    .select("nome, owner_email, owner_id, notificar_acessos_login")
    .eq("id", condominioId)
    .maybeSingle();
  if (condoError) return NextResponse.json({ error: condoError.message }, { status: 500 });
  if (!condominio) return NextResponse.json({ error: "Condomínio não encontrado." }, { status: 404 });
  if (condominio.owner_id === userData.user.id) {
    return NextResponse.json({ success: true, notificado: false, aviso: "É o próprio síndico entrando." });
  }
  if (!condominio.notificar_acessos_login) {
    return NextResponse.json({ success: true, notificado: false, aviso: "Alerta de login desativado nas configurações." });
  }

  const { data: membro, error: membroError } = await supabaseAdmin
    .from("membros")
    .select("id")
    .eq("condominio_id", condominioId)
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (membroError) return NextResponse.json({ error: membroError.message }, { status: 500 });
  if (!membro) return NextResponse.json({ error: "Você não pertence a esse condomínio." }, { status: 403 });

  if (!condominio.owner_email) {
    return NextResponse.json({ success: true, notificado: false, aviso: "Síndico sem e-mail cadastrado." });
  }

  const nomeCondominio = condominio.nome || "seu condomínio";
  const agora = new Date().toLocaleString("pt-BR");
  const resultados = await notificarPessoa(supabaseAdmin, {
    condominioId,
    evento: "acesso_login",
    referenciaId: null,
    nome: "Síndico",
    email: condominio.owner_email,
    whatsapp: null,
    template: WHATSAPP_TEMPLATES.acesso_login,
    fromName: nomeCondominio,
    parametrosEmail: {
      subject: `Novo acesso ao sistema — ${nomeCondominio}`,
      html: `<p><strong>${nome || "Alguém"}</strong> (${papel || "membro"}) entrou no sistema em ${agora}.</p>`,
    },
    parametrosWhatsapp: [nome || "Alguém", papel || "membro", agora],
  });

  return NextResponse.json({ success: true, notificado: true, resultados });
}
