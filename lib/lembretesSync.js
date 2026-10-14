// Núcleo do processamento de Lembretes — server-only (usa supabaseAdmin,
// service role). Chamado de dois lugares:
//   - app/api/cron/lembretes (Vercel Cron, 1x/dia, sem condominioId — roda
//     pra todos os condomínios);
//   - app/api/lembretes/sincronizar (botão "Sincronizar agora" na tela de
//     Lembretes, com condominioId travado no condomínio de quem chamou —
//     nunca deixa um síndico disparar/ver o processamento de outro).
//
// Faz 4 coisas, nessa ordem:
//   A) sincroniza o lembrete "espelho" de cada ordem de Manutenção aberta
//      com data_prevista configurada;
//   A2) idem pra contas a pagar/receber em aberto (Financeiro é automático,
//      sem precisar de caixinha nenhuma — ver DIAS_ALERTA_FINANCEIRO);
//   B) processa os estágios de alerta pendentes (manuais + espelhados),
//      de forma idempotente (processado_em marca "já disparei esse");
//   C) manda um lembrete semanal pros lembretes vencidos e ainda
//      pendentes, sem repetir todo dia.
// Todo espelho automático usa o índice único em
// lembretes(origem, referencia_id) — nunca duplica a mesma ordem/conta.
import { enviarEmail } from "@/lib/notificacoes";
import { calcularEstagios, DIAS_ALERTA_FINANCEIRO } from "@/lib/lembretes";
import { STATUS_PAGAR_FINAIS, STATUS_RECEBER_FINAIS } from "@/lib/financeiro";

const DIAS_ENTRE_AVISOS_ATRASO = 7;

// Cria ou atualiza o lembrete-espelho de um registro de origem, e
// reconcilia seus estágios de alerta com o conjunto desejado — removendo
// os que não fazem mais parte da configuração atual (só os ainda não
// disparados; um alerta já enviado não é desfeito) e inserindo os que
// faltam. Usado tanto pelo espelho de Manutenção quanto pelo de
// Financeiro — a única diferença entre eles são os dados de entrada.
async function sincronizarEspelho(supabaseAdmin, { condominioId, origem, referenciaId, titulo, dataPrevista, categoria, diasArray }) {
  const estagiosDesejados = calcularEstagios(dataPrevista, diasArray);

  const { data: existente } = await supabaseAdmin
    .from("lembretes")
    .select("id, status")
    .eq("origem", origem)
    .eq("referencia_id", referenciaId)
    .maybeSingle();

  let lembreteId = existente?.id;
  if (!lembreteId) {
    const { data: criado, error: errCriar } = await supabaseAdmin
      .from("lembretes")
      .insert({
        condominio_id: condominioId,
        origem,
        referencia_id: referenciaId,
        titulo,
        data_alerta: dataPrevista,
        data_limite: dataPrevista,
        prioridade: "normal",
        categoria,
        visibilidade: "condominio",
      })
      .select("id")
      .single();
    if (errCriar) throw new Error(errCriar.message);
    lembreteId = criado.id;
  } else {
    await supabaseAdmin.from("lembretes").update({ titulo, data_alerta: dataPrevista, data_limite: dataPrevista }).eq("id", lembreteId);
  }

  const { data: estagiosAtuais } = await supabaseAdmin
    .from("lembretes_estagios")
    .select("id, dias_antecedencia, processado_em")
    .eq("lembrete_id", lembreteId);

  const diasDesejados = new Set(estagiosDesejados.map((e) => e.dias_antecedencia));
  const idsParaRemover = (estagiosAtuais || [])
    .filter((e) => !e.processado_em && !diasDesejados.has(e.dias_antecedencia))
    .map((e) => e.id);
  if (idsParaRemover.length > 0) {
    await supabaseAdmin.from("lembretes_estagios").delete().in("id", idsParaRemover);
  }

  const diasExistentes = new Set((estagiosAtuais || []).map((e) => e.dias_antecedencia));
  const novos = estagiosDesejados.filter((e) => !diasExistentes.has(e.dias_antecedencia));
  if (novos.length > 0) {
    await supabaseAdmin.from("lembretes_estagios").insert(novos.map((e) => ({ lembrete_id: lembreteId, ...e })));
  }
}

// Fecha o espelho (marca "concluido") de qualquer origem automática cujos
// registros de origem (ids passados) já não estão mais em aberto —
// evita mostrar pendência de algo já resolvido (ordem concluída, conta
// paga/recebida/cancelada).
async function fecharEspelhosResolvidos(supabaseAdmin, origem, idsResolvidos, motivo) {
  if (idsResolvidos.length === 0) return;
  await supabaseAdmin
    .from("lembretes")
    .update({ status: "concluido", concluido_em: new Date().toISOString(), concluido_por_nome: motivo })
    .eq("origem", origem)
    .eq("status", "pendente")
    .in("referencia_id", idsResolvidos);
}

export async function sincronizarLembretes(supabaseAdmin, { condominioId } = {}) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const hojeStr = hoje.toISOString().slice(0, 10);

  const resultado = { espelhosSincronizados: 0, estagiosDisparados: 0, avisosAtrasoEnviados: 0, erros: [] };

  // --- A) sincroniza o espelho de Manutenção -----------------------------
  // `data_prevista` é o campo real usado em todo o app pro prazo de uma
  // ordem (avulsa, preventiva ou um ciclo de recorrente) — cada ciclo de
  // uma ordem recorrente vira uma linha NOVA com seu próprio
  // data_prevista quando o anterior é concluído (ver manutencao/page.jsx).
  let queryManutencoes = supabaseAdmin
    .from("manutencoes")
    .select("id, condominio_id, titulo, status, data_prevista, alertas_dias_antecedencia, alerta_dias_antecedencia")
    .neq("status", "concluida")
    .not("data_prevista", "is", null);
  if (condominioId) queryManutencoes = queryManutencoes.eq("condominio_id", condominioId);
  const { data: manutencoesAtivas, error: errManutencoes } = await queryManutencoes;

  if (errManutencoes) resultado.erros.push(`manutencoes: ${errManutencoes.message}`);

  const condominioIds = [...new Set((manutencoesAtivas || []).map((m) => m.condominio_id))];
  const { data: condominiosPadrao } = condominioIds.length
    ? await supabaseAdmin
        .from("condominios")
        .select("id, owner_email, manutencao_alerta_dias_padrao, nome")
        .in("id", condominioIds)
    : { data: [] };
  const padraoPorCondominio = new Map((condominiosPadrao || []).map((c) => [c.id, c]));

  for (const m of manutencoesAtivas || []) {
    try {
      const padrao = padraoPorCondominio.get(m.condominio_id);
      const diasArray =
        Array.isArray(m.alertas_dias_antecedencia) && m.alertas_dias_antecedencia.length > 0
          ? m.alertas_dias_antecedencia
          : [m.alerta_dias_antecedencia ?? padrao?.manutencao_alerta_dias_padrao ?? 7];
      await sincronizarEspelho(supabaseAdmin, {
        condominioId: m.condominio_id,
        origem: "manutencao",
        referenciaId: m.id,
        titulo: `Manutenção: ${m.titulo}`,
        dataPrevista: m.data_prevista,
        categoria: "manutencao",
        diasArray,
      });
      resultado.espelhosSincronizados++;
    } catch (err) {
      resultado.erros.push(`manutencao ${m.id}: ${err.message}`);
    }
  }

  let queryConcluidas = supabaseAdmin.from("manutencoes").select("id").eq("status", "concluida");
  if (condominioId) queryConcluidas = queryConcluidas.eq("condominio_id", condominioId);
  const { data: manutencoesConcluidas } = await queryConcluidas;
  await fecharEspelhosResolvidos(
    supabaseAdmin,
    "manutencao",
    (manutencoesConcluidas || []).map((m) => m.id),
    "Sistema (ordem concluída)"
  );

  // --- A2) sincroniza o espelho de Financeiro -----------------------------
  // Automático, sem caixinha nem configuração por conta — mesmos dias de
  // antecedência pra todo mundo (DIAS_ALERTA_FINANCEIRO).
  for (const [origem, tabela, statusFinais] of [
    ["financeiro_pagar", "contas_pagar", STATUS_PAGAR_FINAIS],
    ["financeiro_receber", "contas_receber", STATUS_RECEBER_FINAIS],
  ]) {
    let queryContas = supabaseAdmin
      .from(tabela)
      .select("id, condominio_id, descricao, data_vencimento, status")
      .not("data_vencimento", "is", null);
    if (condominioId) queryContas = queryContas.eq("condominio_id", condominioId);
    const { data: contas, error: errContas } = await queryContas;
    if (errContas) resultado.erros.push(`${tabela}: ${errContas.message}`);

    const idsResolvidos = [];
    for (const c of contas || []) {
      if (statusFinais.includes(c.status)) {
        idsResolvidos.push(c.id);
        continue;
      }
      try {
        await sincronizarEspelho(supabaseAdmin, {
          condominioId: c.condominio_id,
          origem,
          referenciaId: c.id,
          titulo: `${origem === "financeiro_pagar" ? "A pagar" : "A receber"}: ${c.descricao}`,
          dataPrevista: c.data_vencimento,
          categoria: "financeiro",
          diasArray: DIAS_ALERTA_FINANCEIRO,
        });
        resultado.espelhosSincronizados++;
      } catch (err) {
        resultado.erros.push(`${tabela} ${c.id}: ${err.message}`);
      }
    }
    await fecharEspelhosResolvidos(supabaseAdmin, origem, idsResolvidos, "Sistema (conta quitada)");
  }

  // --- B) processa estágios pendentes -------------------------------------
  let queryEstagios = supabaseAdmin
    .from("lembretes_estagios")
    .select(
      condominioId
        ? "id, lembrete_id, dias_antecedencia, data_disparo, lembretes!inner(id, condominio_id, titulo, descricao, status)"
        : "id, lembrete_id, dias_antecedencia, data_disparo, lembretes(id, condominio_id, titulo, descricao, status)"
    )
    .is("processado_em", null)
    .lte("data_disparo", hojeStr);
  if (condominioId) queryEstagios = queryEstagios.eq("lembretes.condominio_id", condominioId);
  const { data: estagiosPendentes, error: errEstagios } = await queryEstagios;

  if (errEstagios) resultado.erros.push(`estagios: ${errEstagios.message}`);

  const condominiosEmailCache = new Map(padraoPorCondominio);

  for (const estagio of estagiosPendentes || []) {
    const lembrete = estagio.lembretes;
    if (!lembrete || lembrete.status !== "pendente") {
      // Lembrete já concluído/cancelado — marca o estágio como
      // processado sem enviar nada, pra não ficar reprocessando à toa.
      await supabaseAdmin.from("lembretes_estagios").update({ processado_em: new Date().toISOString() }).eq("id", estagio.id);
      continue;
    }
    try {
      let condo = condominiosEmailCache.get(lembrete.condominio_id);
      if (!condo) {
        const { data } = await supabaseAdmin
          .from("condominios")
          .select("id, owner_email, nome")
          .eq("id", lembrete.condominio_id)
          .maybeSingle();
        condo = data;
        if (condo) condominiosEmailCache.set(lembrete.condominio_id, condo);
      }
      if (condo?.owner_email) {
        const quando = estagio.dias_antecedencia === 0 ? "é hoje" : `é em ${estagio.dias_antecedencia} dia(s)`;
        await enviarEmail({
          to: condo.owner_email,
          subject: `Lembrete: ${lembrete.titulo}`,
          fromName: condo.nome ? `${condo.nome} — AquiHabitto` : "AquiHabitto",
          html: `<p>Olá!</p><p>Um lembrete seu ${quando}: <strong>${lembrete.titulo}</strong></p>${
            lembrete.descricao ? `<p>${lembrete.descricao}</p>` : ""
          }<p>Veja os detalhes em <a href="https://www.aquihabitto.com.br/dashboard/lembretes">Lembretes</a> no AquiHabitto.</p>`,
        });
      }
      await supabaseAdmin.from("lembretes_estagios").update({ processado_em: new Date().toISOString() }).eq("id", estagio.id);
      resultado.estagiosDisparados++;
    } catch (err) {
      await supabaseAdmin.from("lembretes_estagios").update({ erro_mensagem: err.message }).eq("id", estagio.id);
      resultado.erros.push(`estagio ${estagio.id}: ${err.message}`);
    }
  }

  // --- C) cutuca semanal pra lembrete vencido e ainda pendente ------------
  let queryAtrasados = supabaseAdmin
    .from("lembretes")
    .select("id, condominio_id, titulo, data_limite, data_alerta, ultimo_aviso_atraso_em")
    .eq("status", "pendente")
    .lt("data_alerta", hojeStr);
  if (condominioId) queryAtrasados = queryAtrasados.eq("condominio_id", condominioId);
  const { data: lembretesAtrasados, error: errAtrasados } = await queryAtrasados;

  if (errAtrasados) resultado.erros.push(`atrasados: ${errAtrasados.message}`);

  for (const l of lembretesAtrasados || []) {
    const vencimento = l.data_limite || l.data_alerta;
    if (!vencimento || vencimento >= hojeStr) continue;
    const ultimoAviso = l.ultimo_aviso_atraso_em ? new Date(l.ultimo_aviso_atraso_em) : null;
    const diasDesdeUltimoAviso = ultimoAviso ? Math.floor((hoje - ultimoAviso) / 86400000) : Infinity;
    if (diasDesdeUltimoAviso < DIAS_ENTRE_AVISOS_ATRASO) continue;

    try {
      let condo = condominiosEmailCache.get(l.condominio_id);
      if (!condo) {
        const { data } = await supabaseAdmin
          .from("condominios")
          .select("id, owner_email, nome")
          .eq("id", l.condominio_id)
          .maybeSingle();
        condo = data;
        if (condo) condominiosEmailCache.set(l.condominio_id, condo);
      }
      if (condo?.owner_email) {
        await enviarEmail({
          to: condo.owner_email,
          subject: `Ainda pendente: ${l.titulo}`,
          fromName: condo.nome ? `${condo.nome} — AquiHabitto` : "AquiHabitto",
          html: `<p>Olá!</p><p>Este lembrete venceu e ainda está pendente: <strong>${l.titulo}</strong></p><p>Veja em <a href="https://www.aquihabitto.com.br/dashboard/lembretes">Lembretes</a> no AquiHabitto.</p>`,
        });
      }
      await supabaseAdmin.from("lembretes").update({ ultimo_aviso_atraso_em: new Date().toISOString() }).eq("id", l.id);
      resultado.avisosAtrasoEnviados++;
    } catch (err) {
      resultado.erros.push(`atraso ${l.id}: ${err.message}`);
    }
  }

  return resultado;
}
