// Motor central de comissões — fonte única de verdade pro cálculo.
// Não espalhar percentual/regra em outro lugar do código: toda rota
// que precisa gerar, recalcular ou explicar uma comissão importa
// daqui. Roda sempre server-side (service role), nunca no cliente.

export const TIPO_COMISSAO_LABELS = {
  venda_propria: "Venda própria",
  indicacao_primeira_venda: "Indicação — primeira venda",
  lideranca: "Liderança",
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

// Vendedores diretos de um líder — só o nível 1, nunca segundo nível
// (nem pra indicação nem pra liderança, ver regras 6 e 9 do projeto).
async function buscarVendedoresDiretos(supabaseAdmin, liderId) {
  const { data, error } = await supabaseAdmin
    .from("vendedores")
    .select("id, ativo, status_cadastro")
    .eq("lider_atual_id", liderId);
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

// Motor de elegibilidade de liderança (regra do projeto, seção 32).
// Retorna { qualificado, motivo, detalhes } — nunca lança exceção por
// falta de qualificação, só quando a consulta ao banco falha de fato.
export async function verificarElegibilidadeLideranca(supabaseAdmin, liderId, competencia, modelo) {
  const vendasLider = await contarVendasNoMes(supabaseAdmin, liderId, competencia);
  const metaLider = modelo?.meta_minima_lider ?? 3;

  if (vendasLider < metaLider) {
    return {
      qualificado: false,
      motivo: `Líder vendeu ${vendasLider}, precisa de pelo menos ${metaLider} no mês.`,
      detalhes: { vendasLider, metaLider, totalDiretos: 0, ativos: 0, com3Mais: 0, com1Mais: 0, minimoNecessario: 0 },
    };
  }

  const diretos = await buscarVendedoresDiretos(supabaseAdmin, liderId);
  const totalDiretos = diretos.length;

  if (totalDiretos === 0) {
    return {
      qualificado: false,
      motivo: "Líder ainda não tem vendedores diretos.",
      detalhes: { vendasLider, metaLider, totalDiretos: 0, ativos: 0, com3Mais: 0, com1Mais: 0, minimoNecessario: 0 },
    };
  }

  const metaEquipe = modelo?.meta_minima_equipe ?? 3;
  const metaSecundaria = modelo?.meta_minima_secundaria ?? 1;
  const limitePequena = modelo?.limite_equipe_pequena ?? 8;
  const percentualGrande = modelo?.percentual_equipe_grande ?? 80;

  const vendasPorDireto = await Promise.all(
    diretos.map(async (v) => ({ ...v, vendas: await contarVendasNoMes(supabaseAdmin, v.id, competencia) }))
  );

  const todosAtivos = vendasPorDireto.every((v) => v.ativo && v.status_cadastro === "ativo");
  const com3Mais = vendasPorDireto.filter((v) => v.vendas >= metaEquipe).length;
  const com1Mais = vendasPorDireto.filter((v) => v.vendas >= metaSecundaria).length;

  if (totalDiretos <= limitePequena) {
    // Equipe pequena: 100% dos diretos precisam estar ativos e vender
    // pelo menos a meta da equipe.
    const qualificado = todosAtivos && com3Mais === totalDiretos;
    return {
      qualificado,
      motivo: qualificado
        ? `Todos os ${totalDiretos} vendedores diretos ativos e com ${metaEquipe}+ vendas.`
        : `Nem todos os ${totalDiretos} vendedores diretos estão ativos e com ${metaEquipe}+ vendas (${com3Mais}/${totalDiretos} qualificados).`,
      detalhes: { vendasLider, metaLider, totalDiretos, ativos: todosAtivos ? totalDiretos : com3Mais, com3Mais, com1Mais, minimoNecessario: totalDiretos },
    };
  }

  // Equipe grande (> limite): pelo menos X% (arredondado pra cima)
  // precisam ter a meta da equipe; o restante precisa estar ativo e
  // vender pelo menos a meta secundária (normalmente 1).
  const minimoNecessario = Math.ceil(totalDiretos * (percentualGrande / 100));
  const restantesComMetaSecundaria = vendasPorDireto.filter((v) => v.vendas >= metaSecundaria && v.vendas < metaEquipe);
  const restantesOk = com3Mais >= minimoNecessario
    ? vendasPorDireto.filter((v) => v.vendas < metaEquipe).every((v) => v.ativo && v.status_cadastro === "ativo" && v.vendas >= metaSecundaria)
    : false;
  const qualificado = com3Mais >= minimoNecessario && restantesOk;

  return {
    qualificado,
    motivo: qualificado
      ? `${com3Mais}/${totalDiretos} diretos com ${metaEquipe}+ vendas (mínimo ${minimoNecessario}) e o restante ativo com ${metaSecundaria}+ venda.`
      : `Só ${com3Mais}/${totalDiretos} diretos com ${metaEquipe}+ vendas — precisa de pelo menos ${minimoNecessario}, com o restante ativo e ${metaSecundaria}+ venda.`,
    detalhes: { vendasLider, metaLider, totalDiretos, ativos: com1Mais, com3Mais, com1Mais, minimoNecessario, restantesComMetaSecundaria: restantesComMetaSecundaria.length },
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

  // 3) Liderança — recalcula pro líder atual do vendedor (se tiver),
  // pra essa competência inteira (não só essa venda), porque a
  // elegibilidade depende do mês inteiro da equipe.
  if (modelo.permite_lideranca && vendedor.lider_atual_id) {
    const resultado = await sincronizarComissoesLiderancaCompetencia(supabaseAdmin, vendedor.lider_atual_id, competencia);
    if (resultado.geradas > 0) geradas.push("lideranca");
  }

  return { geradas };
}

// Emancipação: vendedor (e sua estrutura) deixa de estar sob o líder
// atual e passa a ser líder independente. Não apaga histórico — só
// fecha o vínculo atual e registra a data (regras 15-17).
export async function emanciparVendedor(supabaseAdmin, vendedorId) {
  const agora = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("vendedores")
    .update({ lider_atual_id: null, data_emancipacao: agora })
    .eq("id", vendedorId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}
