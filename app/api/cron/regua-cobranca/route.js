import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { notificarPessoa } from "@/lib/notificacoes";
import { formatarMoeda } from "@/lib/financeiro";

// Sem isso o Next tenta pré-renderizar a rota como estática no build
// (mesmo motivo do /api/cron/lembretes-financeiro).
export const dynamic = "force-dynamic";

// Régua de cobrança: avisa o condômino por e-mail antes E depois do
// vencimento de uma conta a receber ainda aberta — dispara 1x/dia (ver
// vercel.json), comparando a diferença exata de dias, então cada aviso
// sai só uma vez (mesmo princípio do /api/cron/lembretes-financeiro).
// Reaproveita a infra de notificação já existente (lib/notificacoes.js,
// notificacoes_log) em vez de criar um canal novo.
const DIAS_ANTES = [5, 3, 1, 0];
const DIAS_DEPOIS = [1, 3, 7, 15, 30];

export async function GET(request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization") || "";
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data: contas, error } = await supabaseAdmin
    .from("contas_receber")
    .select("id, condominio_id, descricao, unidade, valor, data_vencimento, pagador_email, boleto_url, responsavel_financeiro")
    .in("status", ["pendente", "a_vencer", "vencida"])
    .not("data_vencimento", "is", null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const condominioNomes = new Map();
  const membrosPorUnidade = new Map();

  let enviados = 0;
  for (const c of contas || []) {
    const vencimento = new Date(`${c.data_vencimento}T00:00:00`);
    const diasRestantes = Math.round((vencimento - hoje) / (1000 * 60 * 60 * 24));
    const atraso = diasRestantes < 0 ? Math.abs(diasRestantes) : 0;
    const deveAvisar = diasRestantes >= 0 ? DIAS_ANTES.includes(diasRestantes) : DIAS_DEPOIS.includes(atraso);
    if (!deveAvisar) continue;

    let email = c.pagador_email;
    let nomeDestinatario = c.responsavel_financeiro;
    if (!email && c.unidade) {
      const chave = `${c.condominio_id}:${c.unidade}`;
      if (!membrosPorUnidade.has(chave)) {
        const { data: membro } = await supabaseAdmin
          .from("membros")
          .select("email, nome")
          .eq("condominio_id", c.condominio_id)
          .eq("unidade", c.unidade)
          .limit(1)
          .maybeSingle();
        membrosPorUnidade.set(chave, membro || null);
      }
      const membro = membrosPorUnidade.get(chave);
      email = membro?.email;
      nomeDestinatario = nomeDestinatario || membro?.nome;
    }
    if (!email) continue;

    if (!condominioNomes.has(c.condominio_id)) {
      const { data: condo } = await supabaseAdmin.from("condominios").select("nome").eq("id", c.condominio_id).maybeSingle();
      condominioNomes.set(c.condominio_id, condo?.nome || "Condomínio");
    }
    const nomeCondominio = condominioNomes.get(c.condominio_id);

    const quando =
      diasRestantes === 0
        ? "vence hoje"
        : diasRestantes > 0
          ? `vence em ${diasRestantes} dia${diasRestantes > 1 ? "s" : ""}`
          : `está atrasada há ${atraso} dia${atraso > 1 ? "s" : ""}`;

    const resultados = await notificarPessoa(supabaseAdmin, {
      condominioId: c.condominio_id,
      evento: diasRestantes >= 0 ? "cobranca_lembrete" : "cobranca_atraso",
      referenciaId: c.id,
      nome: nomeDestinatario,
      email,
      parametrosEmail: {
        subject: `${nomeCondominio}: ${c.descricao} ${quando}`,
        html: `
          <p>Olá${nomeDestinatario ? `, ${nomeDestinatario}` : ""}!</p>
          <p><strong>${c.descricao}</strong> (unidade ${c.unidade || "-"}) ${quando} — vencimento em ${vencimento.toLocaleDateString("pt-BR")}.</p>
          <p>Valor: ${formatarMoeda(c.valor)}</p>
          ${c.boleto_url ? `<p><a href="${c.boleto_url}">Clique aqui pra ver o boleto</a></p>` : ""}
        `,
      },
      fromName: `${nomeCondominio} — Cobrança`,
    });
    if (resultados.some((r) => r.status === "enviado")) enviados += 1;
  }

  return NextResponse.json({ enviados });
}
