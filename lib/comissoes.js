// Motor central de comissões — fonte única de verdade pro cálculo.
// Não espalhar percentual/regra em outro lugar do código: toda rota
// que precisa gerar, recalcular ou explicar uma comissão importa
// daqui. Roda sempre server-side (service role), nunca no cliente.

export const TIPO_COMISSAO_LABELS = {
  venda_propria: "Venda própria",
  indicacao_primeira_venda: "Indicação — primeira venda",
  // Nome interno da coluna/tipo continua "lideranca" (não vale a pena
  // migrar banco só por causa do nome) — só o texto visível virou
  // "Patrocínio", porque não existe subordinação de verdade aqui.
  lideranca: "Patrocínio",
};

export const STATUS_COMISSAO_LABELS = {
  pendente: "Pendente",
  gerada: "Gerada",
  aprovada: "Aprovada",
  paga: "Paga",
  cancelada: "Cancelada",
};

export const STATUS_COMISSAO_STYLES = {
  pendente: "bg-amber-100 text-amber-700",
  gerada: "bg-sky-100 text-sky-700",
  aprovada: "bg-violet-100 text-violet-700",
  paga: "bg-emerald-100 text-emerald-700",
  cancelada: "bg-navy-100 text-navy-500",
};

export function gerarCodigoIndicacao() {
  const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem O/0/I/1, pra não confundir
  let codigo = "";
  for (let i = 0; i < 6; i++) codigo += alfabeto[Math.floor(Math.random() * alfabeto.length)];
  return codigo;
}

// 'YYYY-MM' a partir de uma data (string ISO ou Date) — competência é
// sempre o mês/ano em que a venda (created_at do condomínio) aconteceu.
export function competenciaDeData(data) {
  const d = new Date(data);
  const ano = d.getUTCFullYear();
  const mes = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${ano}-${mes}`;
}

function competenciaParaIntervalo(competencia) {
  const [ano, mes] = competencia.split("-").map(Number);
  const inicio = new Date(Date.UTC(ano, mes - 1, 1));
  const fim = new Date(Date.UTC(ano, mes, 1));
  return { inicioIso: inicio.toISOString(), fimIso: fim.toISOString() };
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

// Vendedores diretos de um patrocinador — só o nível 1, nunca segundo
// nível (nem pra indicação nem pra patrocínio, ver regras 6 e 9 do
// projeto).
async function buscarVendedoresDiretos(supabaseAdmin, liderId) {
  const { data, error } = await supabaseAdmin.from("vendedores").select("id").eq("lider_atual_id", liderId);
  if (error) throw new Error(error.message);
  return data || [];
}

async function contarVendasNoMes(supabaseAdmin, vendedorId, competencia) {
  const { inicioIso, fimIso } = competenciaParaIntervalo(competencia);
  const { count, error } = await supabaseAdmin
    .from("condominios")
    .select("id", { count: "exact", head: true })
    .eq("vendedor_id", vendedorId)
    .gte("created_at", inicioIso)
    .lt("created_at", fimIso);
  if (error) throw new Error(error.message);
  return count || 0;
}

// Motor de elegibilidade de patrocínio (Regra 2, revisada). Critério é
// só volume de vendas — não checa mais status "ativo" isoladamente,
// porque esse campo sozinho era fácil de burlar (conta "ativa" sem
// nunca ter vendido nada). Nunca lança exceção por falta de
// qualificação, só quando a consulta ao banco falha de fato.
export async function verificarElegibilidadeLideranca(supabaseAdmin, liderId, competencia, modelo) {
  const vendasLider = await contarVendasNoMes(supabaseAdmin, liderId, competencia);
  const metaLider = modelo?.meta_minima_lider ?? 2;

  if (vendasLider < metaLider) {
    return {
      qualificado: false,
      motivo: `Patrocinador vendeu ${vendasLider}, precisa de pelo menos ${metaLider} no mês.`,
      detalhes: { vendasLider, metaLider, totalDiretos: 0, comMeta: 0, necessario: 0 },
    };
  }

  const diretos = await buscarVendedoresDiretos(supabaseAdmin, liderId);
  const totalDiretos = diretos.length;

  if (totalDiretos === 0) {
    return {
      qualificado: false,
      motivo: "Patrocinador ainda não tem vendedores diretos.",
      detalhes: { vendasLider, metaLider, totalDiretos: 0, comMeta: 0, necessario: 0 },
    };
  }

  const metaEquipe = modelo?.meta_minima_equipe ?? 1;
  const limitePequena = modelo?.limite_equipe_pequena ?? 5;
  const percentualGrande = modelo?.percentual_equipe_grande ?? 20;

  const vendasPorDireto = await Promise.all(
    diretos.map(async (v) => ({ ...v, vendas: await contarVendasNoMes(supabaseAdmin, v.id, competencia) }))
  );
  const comMeta = vendasPorDireto.filter((v) => v.vendas >= metaEquipe).length;

  // Equipe pequena (≤ limite): precisa de 100% dos diretos com a meta —
  // na prática, "necessario = totalDiretos". Equipe grande: piso
  // absoluto de 5, ou o percentual configurado da equipe, o que for
  // maior — assim uma equipe de 50 não qualifica tão fácil quanto uma
  // de 6 só porque bateu o mesmo número fixo.
  const necessario =
    totalDiretos <= limitePequena ? totalDiretos : Math.max(5, Math.ceil(totalDiretos * (percentualGrande / 100)));

  const qualificado = comMeta >= necessario;

  return {
    qualificado,
    motivo: qualificado
      ? `${comMeta}/${totalDiretos} diretos com ${metaEquipe}+ venda(s) no mês (mínimo ${necessario}).`
      : `Só ${comMeta}/${totalDiretos} diretos com ${metaEquipe}+ venda(s) — precisa de pelo menos ${necessario}.`,
    detalhes: { vendasLider, metaLider, totalDiretos, comMeta, necessario },
  };
}

async function buscarModeloDoVendedor(supabaseAdmin, vendedor) {
  if (vendedor.modelo_comissionamento_id) {
    const { data, error } = await supabaseAdmin
      .from("modelos_comissionamento")
      .select("*")
      .eq("id", vendedor.modelo_comissionamento_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data) return data;
  }
  const { data: padrao, error: erroPadrao } = await supabaseAdmin
    .from("modelos_comissionamento")
    .select("*")
    .eq("padrao", true)
    .maybeSingle();
  if (erroPadrao) throw new Error(erroPadrao.message);
  return padrao;
}

async function inserirComissaoSeNaoExistir(supabaseAdmin, linha) {
  const { error } = await supabaseAdmin.from("comissoes").insert(linha);
  // 23505 = unique_violation no índice comissoes_dedupe_idx — já existe
  // comissão desse tipo pra essa venda, ignora silenciosamente
  // (idempotência: motor pode rodar mais de uma vez pra mesma venda).
  if (error && error.code !== "23505") throw new Error(error.message);
}

// Garante que as comissões de liderança do líder, pra todas as vendas
// da equipe direta dele nessa competência, existam — chamado depois
// de toda venda nova (a elegibilidade só pode subir ao longo do mês,
// nunca descer sozinha) e também sob demanda (recálculo manual do
// admin, que pode inclusive cancelar comissões geradas indevidamente
// se a elegibilidade não se confirmar — nunca mexe em comissão já paga).
export async function sincronizarComissoesLiderancaCompetencia(supabaseAdmin, liderId, competencia) {
  const { data: lider, error: erroLider } = await supabaseAdmin
    .from("vendedores").select("*").eq("id", liderId).maybeSingle();
  if (erroLider) throw new Error(erroLider.message);
  if (!lider) return { qualificado: false, motivo: "Líder não encontrado.", geradas: 0 };

  const modelo = await buscarModeloDoVendedor(supabaseAdmin, lider);
  if (!modelo?.permite_lideranca) {
    return { qualificado: false, motivo: "Modelo de comissionamento não inclui liderança.", geradas: 0 };
  }

  const elegibilidade = await verificarElegibilidadeLideranca(supabaseAdmin, liderId, competencia, modelo);

  if (!elegibilidade.qualificado) {
    // Recálculo manual pode ter perdido a elegibilidade — cancela só o
    // que ainda não foi pago (nunca mexe em comissão já paga).
    await supabaseAdmin
      .from("comissoes")
      .update({ status: "cancelada", observacao: `Recalculado: ${elegibilidade.motivo}`, updated_at: new Date().toISOString() })
      .eq("vendedor_beneficiario_id", liderId)
      .eq("tipo", "lideranca")
      .eq("competencia", competencia)
      .in("status", ["pendente", "gerada"]);
    return { ...elegibilidade, geradas: 0 };
  }

  const { inicioIso, fimIso } = competenciaParaIntervalo(competencia);
  const diretos = await buscarVendedoresDiretos(supabaseAdmin, liderId);
  let geradas = 0;

  for (const direto of diretos) {
    const { data: vendas, error } = await supabaseAdmin
      .from("condominios")
      .select("id, taxa_adesao_paga")
      .eq("vendedor_id", direto.id)
      .gte("created_at", inicioIso)
      .lt("created_at", fimIso);
    if (error) throw new Error(error.message);

    for (const venda of vendas || []) {
      const valorBase = Number(venda.taxa_adesao_paga) || 0;
      const percentual = Number(modelo.percentual_lideranca);
      await inserirComissaoSeNaoExistir(supabaseAdmin, {
        condominio_id: venda.id,
        vendedor_beneficiario_id: liderId,
        vendedor_venda_id: direto.id,
        tipo: "lideranca",
        modelo_comissionamento_id: modelo.id,
        modelo_versao: modelo.versao,
        percentual,
        valor_base: valorBase,
        valor: round2((valorBase * percentual) / 100),
        competencia,
        regra_aplicada: { motivo: elegibilidade.motivo, detalhes: elegibilidade.detalhes },
      });
      geradas++;
    }
  }

  return { ...elegibilidade, geradas };
}

// Orquestrador chamado logo depois de uma venda real (condomínio
// criado com vendedor_id preenchido, em complete-signup). Gera, na
// ordem: 1) venda própria; 2) indicação (só na primeira venda do
// vendedor, sem meta — regra 4); 3) sincroniza liderança do líder
// atual do vendedor pra essa competência.
export async function gerarComissoesParaVenda(supabaseAdmin, condominioId) {
  const { data: condominio, error: erroCondominio } = await supabaseAdmin
    .from("condominios")
    .select("id, vendedor_id, taxa_adesao_paga, created_at")
    .eq("id", condominioId)
    .maybeSingle();
  if (erroCondominio) throw new Error(erroCondominio.message);
  if (!condominio?.vendedor_id) return { geradas: [] };

  const { data: vendedor, error: erroVendedor } = await supabaseAdmin
    .from("vendedores").select("*").eq("id", condominio.vendedor_id).maybeSingle();
  if (erroVendedor) throw new Error(erroVendedor.message);
  if (!vendedor) return { geradas: [] };

  const modelo = await buscarModeloDoVendedor(supabaseAdmin, vendedor);
  const competencia = competenciaDeData(condominio.created_at);
  const valorBase = Number(condominio.taxa_adesao_paga) || 0;
  const geradas = [];

  // 1) Venda própria — sempre, sem meta.
  const percentualProprio = Number(modelo.percentual_venda_propria);
  await inserirComissaoSeNaoExistir(supabaseAdmin, {
    condominio_id: condominio.id,
    vendedor_beneficiario_id: vendedor.id,
    vendedor_venda_id: vendedor.id,
    tipo: "venda_propria",
    modelo_comissionamento_id: modelo.id,
    modelo_versao: modelo.versao,
    percentual: percentualProprio,
    valor_base: valorBase,
    valor: round2((valorBase * percentualProprio) / 100),
    competencia,
    regra_aplicada: { regra: "80% da adesão, sem meta." },
  });
  geradas.push("venda_propria");

  // 2) Indicação — só na primeira venda do vendedor, e só uma vez na
  // vida (regra 5). "Primeira venda" = nenhuma comissão venda_propria
  // anterior a esta pra esse vendedor.
  if (modelo.permite_indicacao && vendedor.indicador_original_id) {
    const { count, error: erroContagem } = await supabaseAdmin
      .from("comissoes")
      .select("id", { count: "exact", head: true })
      .eq("vendedor_beneficiario_id", vendedor.id)
      .eq("tipo", "venda_propria");
    if (erroContagem) throw new Error(erroContagem.message);

    // count aqui já inclui a comissão que acabamos de inserir — se for
    // 1, essa foi a primeira.
    if ((count || 0) === 1) {
      const percentualIndicacao = Number(modelo.percentual_indicacao);
      await inserirComissaoSeNaoExistir(supabaseAdmin, {
        condominio_id: condominio.id,
        vendedor_beneficiario_id: vendedor.indicador_original_id,
        vendedor_venda_id: vendedor.id,
        tipo: "indicacao_primeira_venda",
        modelo_comissionamento_id: modelo.id,
        modelo_versao: modelo.versao,
        percentual: percentualIndicacao,
        valor_base: valorBase,
        valor: round2((valorBase * percentualIndicacao) / 100),
        competencia,
        regra_aplicada: { regra: "5% pro indicador direto, só na primeira venda do indicado, sem meta.", vendedor_indicado: vendedor.id },
      });
      geradas.push("indicacao_primeira_venda");
    }
  }

  // 3) Patrocínio — recalcula pro patrocinador atual do vendedor (se
  // tiver), pra essa competência inteira (não só essa venda), porque a
  // elegibilidade depende do mês inteiro da equipe.
  if (modelo.permite_lideranca && vendedor.lider_atual_id) {
    const resultado = await sincronizarComissoesLiderancaCompetencia(supabaseAdmin, vendedor.lider_atual_id, competencia);
    if (resultado.geradas > 0) geradas.push("lideranca");
  }

  // 4) Desvinculação automática — essa venda pode ter sido a que fez o
  // PATROCINADOR do vendedor bater 5 diretos com venda própria. Checa
  // sempre, independente do resultado do passo 3.
  if (vendedor.lider_atual_id) {
    await verificarAutoEmancipacao(supabaseAdmin, vendedor.lider_atual_id);
  }

  return { geradas };
}

// Monta o detalhamento completo de um vendedor (seção 22/23 do
// projeto): dados, vendas, comissões por tipo, equipe direta com
// situação de cada um, e o painel de progresso de liderança do mês
// atual. Usado tanto pela rota admin (vê qualquer vendedor) quanto
// pela rota do próprio vendedor (vê só a si mesmo) — uma função só,
// sem duplicar a lógica em dois lugares.
export async function montarDetalheVendedor(supabaseAdmin, vendedorId) {
  const { data: vendedor, error: erroVendedor } = await supabaseAdmin
    .from("vendedores")
    .select("*, indicador:indicador_original_id(id, nome), lider:lider_atual_id(id, nome), modelo:modelo_comissionamento_id(*)")
    .eq("id", vendedorId)
    .maybeSingle();
  if (erroVendedor) throw new Error(erroVendedor.message);
  if (!vendedor) return null;

  const competenciaAtual = competenciaDeData(new Date());

  const [{ data: vendas, error: erroVendas }, { data: comissoes, error: erroComissoes }, { data: diretos, error: erroDiretos }] =
    await Promise.all([
      supabaseAdmin
        .from("condominios")
        .select("id, nome, taxa_adesao_paga, created_at, status")
        .eq("vendedor_id", vendedorId)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("comissoes")
        .select("*")
        .or(`vendedor_beneficiario_id.eq.${vendedorId},vendedor_venda_id.eq.${vendedorId}`)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("vendedores")
        .select("id, nome, ativo, status_cadastro")
        .eq("lider_atual_id", vendedorId),
    ]);
  if (erroVendas) throw new Error(erroVendas.message);
  if (erroComissoes) throw new Error(erroComissoes.message);
  if (erroDiretos) throw new Error(erroDiretos.message);

  const inicioMes = `${competenciaAtual}-01`;
  const vendasDoMes = (vendas || []).filter((v) => v.created_at >= inicioMes);

  const comissoesDoVendedor = (comissoes || []).filter((c) => c.vendedor_beneficiario_id === vendedorId && c.status !== "cancelada");
  const totaisComissao = { venda_propria: 0, indicacao_primeira_venda: 0, lideranca: 0, total: 0, paga: 0, pendente: 0 };
  for (const c of comissoesDoVendedor) {
    totaisComissao[c.tipo] += Number(c.valor) || 0;
    totaisComissao.total += Number(c.valor) || 0;
    if (c.status === "paga") totaisComissao.paga += Number(c.valor) || 0;
    else totaisComissao.pendente += Number(c.valor) || 0;
  }

  const metaEquipe = vendedor.modelo?.meta_minima_equipe ?? 1;
  const equipe = await Promise.all(
    (diretos || []).map(async (d) => {
      const { count } = await supabaseAdmin
        .from("condominios")
        .select("id", { count: "exact", head: true })
        .eq("vendedor_id", d.id)
        .gte("created_at", inicioMes);
      return { ...d, vendas_mes: count || 0 };
    })
  );

  const comMeta = equipe.filter((e) => e.vendas_mes >= metaEquipe).length;
  const com1ou2 = equipe.filter((e) => e.vendas_mes >= 1 && e.vendas_mes < metaEquipe).length;
  const semVenda = equipe.filter((e) => e.vendas_mes === 0).length;

  let situacaoLideranca = null;
  if (vendedor.modelo?.permite_lideranca) {
    situacaoLideranca = await verificarElegibilidadeLideranca(supabaseAdmin, vendedorId, competenciaAtual, vendedor.modelo);
  }

  const totalDiretos = equipe.length;
  const limitePequena = vendedor.modelo?.limite_equipe_pequena ?? 5;
  const percentualGrande = vendedor.modelo?.percentual_equipe_grande ?? 20;
  const necessariosComMeta =
    totalDiretos <= limitePequena ? totalDiretos : Math.max(5, Math.ceil(totalDiretos * (percentualGrande / 100)));

  return {
    vendedor: {
      ...vendedor,
      indicador_nome: vendedor.indicador?.nome || null,
      lider_nome: vendedor.lider?.nome || null,
    },
    vendas: {
      quantidade: (vendas || []).length,
      valorTotal: (vendas || []).reduce((s, v) => s + (Number(v.taxa_adesao_paga) || 0), 0),
      vendasDoMes: vendasDoMes.length,
      historico: vendas || [],
    },
    comissoes: {
      vendaPropria: totaisComissao.venda_propria,
      indicacao: totaisComissao.indicacao_primeira_venda,
      lideranca: totaisComissao.lideranca,
      total: totaisComissao.total,
      pago: totaisComissao.paga,
      pendente: totaisComissao.pendente,
      historico: comissoes || [],
    },
    equipe: {
      indicadorOriginal: vendedor.indicador?.nome || null,
      liderAtual: vendedor.lider?.nome || null,
      diretos: equipe,
      totalDiretos,
      comMeta,
      com1ou2,
      semVenda,
      metaEquipe,
    },
    painelProgresso: {
      competencia: competenciaAtual,
      minhasVendas: vendasDoMes.length,
      metaLider: vendedor.modelo?.meta_minima_lider ?? 3,
      totalDiretos,
      necessariosComMeta,
      atualmenteComMeta: comMeta,
      restantes: Math.max(0, necessariosComMeta - comMeta),
      situacao: situacaoLideranca,
    },
  };
}

// Emancipação: vendedor (e sua estrutura) deixa de estar sob o
// patrocinador atual e passa a ser patrocinador independente. Não
// apaga histórico — só fecha o vínculo atual e registra a data (regras
// 15-17). `automatica` marca se foi o sistema que fez isso sozinho
// (regra do ponto 2 abaixo) ou um admin manualmente.
export async function emanciparVendedor(supabaseAdmin, vendedorId, { automatica = false } = {}) {
  const agora = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("vendedores")
    .update({ lider_atual_id: null, data_emancipacao: agora, emancipacao_automatica: automatica })
    .eq("id", vendedorId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

// Desvinculação automática: um vendedor que já tem patrocinador
// (lider_atual_id) se torna independente sozinho assim que ele próprio
// recrutou pelo menos 5 vendedores diretos e CADA UM desses 5 já fez
// pelo menos 1 venda na vida (cumulativo, não é por mês — vira
// independente uma vez e pra sempre, não "oscila" mês a mês). Critério
// é só venda, não status "ativo" isolado — fecha a brecha de criar 5
// contas vazias só pra se desvincular (ver ponto 2 da revisão da
// regra). Quem nunca recrutar ninguém fica vinculado ao patrocinador
// original pra sempre, sem perder nada com isso.
export async function verificarAutoEmancipacao(supabaseAdmin, vendedorId) {
  const { data: vendedor, error: erroVendedor } = await supabaseAdmin
    .from("vendedores")
    .select("id, lider_atual_id, modelo_comissionamento_id")
    .eq("id", vendedorId)
    .maybeSingle();
  if (erroVendedor) throw new Error(erroVendedor.message);
  if (!vendedor || !vendedor.lider_atual_id) return { emancipado: false };

  const modelo = await buscarModeloDoVendedor(supabaseAdmin, vendedor);
  if (!modelo?.permite_emancipacao) return { emancipado: false };

  const diretos = await buscarVendedoresDiretos(supabaseAdmin, vendedorId);
  if (diretos.length < 5) return { emancipado: false, diretosComVenda: 0 };

  const comVenda = await Promise.all(
    diretos.map(async (d) => {
      const { count, error } = await supabaseAdmin
        .from("condominios")
        .select("id", { count: "exact", head: true })
        .eq("vendedor_id", d.id);
      if (error) throw new Error(error.message);
      return (count || 0) > 0;
    })
  );
  const diretosComVenda = comVenda.filter(Boolean).length;
  if (diretosComVenda < 5) return { emancipado: false, diretosComVenda };

  await emanciparVendedor(supabaseAdmin, vendedorId, { automatica: true });
  return { emancipado: true, diretosComVenda };
}
