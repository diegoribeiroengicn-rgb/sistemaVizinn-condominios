import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { enviarEmail } from "@/lib/notificacoes";
import { calcularEstagios } from "@/lib/lembretes";

// Sem isso o Next tenta pré-renderizar essa rota como estática no build
// (mesma razão do cron de lembretes-financeiro) — precisa ser sempre
// dinâmica.
export const dynamic = "force-dynamic";

// Disparado 1x/dia pelo Vercel Cron (ver vercel.json). Faz 3 coisas, nessa
// ordem:
//   A) sincroniza o lembrete "espelho" de cada ordem de Manutenção aberta
//      com data_prevista configurada (cria/atualiza, nunca duplica — 1 só
//      por ordem, via índice único em lembretes(origem, referencia_id));
//   B) processa os estágios de alerta pendentes (manuais + espelhados),
//      de forma idempotente (processado_em marca "já disparei esse");
//   C) manda um lembrete semanal pros lembretes vencidos e ainda
//      pendentes, sem repetir todo dia.
// Financeiro (contas_pagar/contas_receber) propositalmente NÃO entra
// aqui — nunca teve alerta automático agendado, e este cron não cria um
// novo (ver nota em supabase/schema.sql, tabela lembretes).
const DIAS_ENTRE_AVISOS_ATRASO = 7;

export async function GET(request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization") || "";
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }
  }

  const supabaseAdmin = getSupabaseAdmin();
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const hojeStr = hoje.toISOString().slice(0, 10);

  const resultado = { espelhosSincronizados: 0, estagiosDisparados: 0, avisosAtrasoEnviados: 0, erros: [] };

  // --- A) sincroniza o espelho de Manutenção -----------------------------
  // `data_prevista` é o campo real usado em todo o app pro prazo de uma
  // ordem (avulsa, preventiva ou um ciclo de recorrente) — cada ciclo de
  // uma ordem recorrente vira uma linha NOVA com seu próprio
  // data_prevista quando o anterior é concluído (ver manutencao/page.jsx).
  // `proxima_data` existe no schema mas nunca é escrito pelo app hoje —
  // não é essa coluna que guarda o prazo de verdade.
  const { data: manutencoesAtivas, error: errManutencoes } = await supabaseAdmin
    .from("manutencoes")
    .select("id, condominio_id, titulo, status, data_prevista, alertas_dias_antecedencia, alerta_dias_antecedencia")
    .neq("status", "concluida")
    .not("data_prevista", "is", null);

  if (errManutencoes) resultado.erros.push(`manutencoes: ${errManutencoes.message}`);

  const condominioIds = [...new Set((manutencoesAtivas || []).map((m) => m.condominio_id))];
  const { data: condominiosPadrao } = condominioIds.length
    ? await supabaseAdmin
        .from("condominios")
        .select("id, owner_email, manutencao_alerta_dias_padrao")
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
      const estagiosDesejados = calcularEstagios(m.data_prevista, diasArray);

      const { data: existente } = await supabaseAdmin
        .from("lembretes")
        .select("id, status")
        .eq("origem", "manutencao")
        .eq("referencia_id", m.id)
        .maybeSingle();

      let lembreteId = existente?.id;
      if (!lembreteId) {
        const { data: criado, error: errCriar } = await supabaseAdmin
          .from("lembretes")
          .insert({
            condominio_id: m.condominio_id,
            origem: "manutencao",
            referencia_id: m.id,
            titulo: `Manutenção: ${m.titulo}`,
            data_alerta: m.data_prevista,
            data_limite: m.data_prevista,
            prioridade: "normal",
            visibilidade: "condominio",
          })
          .select("id")
          .single();
        if (errCriar) throw new Error(errCriar.message);
        lembreteId = criado.id;
      } else {
        await supabaseAdmin
          .from("lembretes")
          .update({
            titulo: `Manutenção: ${m.titulo}`,
            data_alerta: m.data_prevista,
            data_limite: m.data_prevista,
          })
          .eq("id", lembreteId);
      }

      // Reconcilia os estágios: remove os que não fazem mais parte da
      // configuração atual (e ainda não foram disparados — um alerta já
      // enviado não é desfeito), insere os que faltam.
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
        await supabaseAdmin
          .from("lembretes_estagios")
          .insert(novos.map((e) => ({ lembrete_id: lembreteId, ...e })));
      }

      resultado.espelhosSincronizados++;
    } catch (err) {
      resultado.erros.push(`manutencao ${m.id}: ${err.message}`);
    }
  }

  // Ordens que saíram de "aberta/em_andamento" (concluídas) fecham o
  // lembrete espelho junto — evita mostrar pendência de algo já resolvido.
  const { data: manutencoesConcluidasRecentes } = await supabaseAdmin
    .from("manutencoes")
    .select("id")
    .eq("status", "concluida");
  const idsConcluidas = (manutencoesConcluidasRecentes || []).map((m) => m.id);
  if (idsConcluidas.length > 0) {
    await supabaseAdmin
      .from("lembretes")
      .update({ status: "concluido", concluido_em: new Date().toISOString(), concluido_por_nome: "Sistema (ordem concluída)" })
      .eq("origem", "manutencao")
      .eq("status", "pendente")
      .in("referencia_id", idsConcluidas);
  }

  // --- B) processa estágios pendentes -------------------------------------
  const { data: estagiosPendentes, error: errEstagios } = await supabaseAdmin
    .from("lembretes_estagios")
    .select("id, lembrete_id, dias_antecedencia, data_disparo, lembretes(id, condominio_id, titulo, descricao, status)")
    .is("processado_em", null)
    .lte("data_disparo", hojeStr);

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
      await supabaseAdmin
        .from("lembretes_estagios")
        .update({ erro_mensagem: err.message })
        .eq("id", estagio.id);
      resultado.erros.push(`estagio ${estagio.id}: ${err.message}`);
    }
  }

  // --- C) cutuca semanal pra lembrete vencido e ainda pendente ------------
  const { data: lembretesAtrasados, error: errAtrasados } = await supabaseAdmin
    .from("lembretes")
    .select("id, condominio_id, titulo, data_limite, data_alerta, ultimo_aviso_atraso_em")
    .eq("status", "pendente")
    .lt("data_alerta", hojeStr);

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

  return NextResponse.json(resultado);
}
