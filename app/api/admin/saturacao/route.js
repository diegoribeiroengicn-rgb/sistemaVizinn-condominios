import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/adminAuth";

// Platform-owner-only: "barra de calor" por serviço — quão perto a
// operação está do limite do plano gratuito de cada um, pra saber
// exatamente quando é hora de assinar o plano pago daquele serviço
// específico (não um alerta genérico "o sistema está saturado").
// Limites configuráveis por env var pra acompanhar upgrades de plano
// sem precisar mexer em código.
const LIMITE_EMAILS_MENSAL = Number(process.env.RESEND_LIMITE_MENSAL) || 3000;
const LIMITE_WHATSAPP_MENSAL = Number(process.env.WHATSAPP_LIMITE_MENSAL) || 1000;
// Supabase não expõe uso real do banco (tamanho/conexões) sem uma chave
// extra da API de gerenciamento, que não está configurada — usamos
// quantidade de condomínios como um proxy calibrável manualmente.
const LIMITE_CONDOMINIOS_SUPABASE_FREE = Number(process.env.SUPABASE_LIMITE_CONDOMINIOS) || 4;

function nivel(percentual) {
  if (percentual >= 90) return "critico";
  if (percentual >= 70) return "atencao";
  return "ok";
}

function itemUso({ label, usado, limite, detalheTexto, estimativa = false, servico }) {
  const percentual = limite > 0 ? Math.min(999, Math.round((usado / limite) * 100)) : 0;
  return {
    servico,
    label,
    usado,
    limite,
    detalheTexto: detalheTexto || `${usado}/${limite} (${percentual}%)`,
    percentual,
    nivel: nivel(percentual),
    estimativa,
  };
}

export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabaseAdmin = getSupabaseAdmin();
  const inicioMes = new Date();
  inicioMes.setDate(1);
  inicioMes.setHours(0, 0, 0, 0);
  const inicioMesIso = inicioMes.toISOString();

  const [
    { count: totalCondominios },
    { count: totalCondominiosAtivos },
    { count: totalMoradores },
    { count: totalMembros },
    { count: emailsEsteMes },
    { count: whatsappEsteMes },
    { count: totalNotificacoesLog },
    { count: totalAuditoria },
    { count: totalChamados },
  ] = await Promise.all([
    supabaseAdmin.from("condominios").select("*", { count: "exact", head: true }),
    supabaseAdmin.from("condominios").select("*", { count: "exact", head: true }).eq("status", "active"),
    supabaseAdmin.from("moradores").select("*", { count: "exact", head: true }),
    supabaseAdmin.from("membros").select("*", { count: "exact", head: true }),
    supabaseAdmin
      .from("notificacoes_log")
      .select("*", { count: "exact", head: true })
      .eq("canal", "email")
      .gte("created_at", inicioMesIso),
    supabaseAdmin
      .from("notificacoes_log")
      .select("*", { count: "exact", head: true })
      .eq("canal", "whatsapp")
      .gte("created_at", inicioMesIso),
    supabaseAdmin.from("notificacoes_log").select("*", { count: "exact", head: true }),
    supabaseAdmin.from("auditoria").select("*", { count: "exact", head: true }),
    supabaseAdmin.from("chamados").select("*", { count: "exact", head: true }),
  ]);

  const ativos = totalCondominiosAtivos || 0;

  const uso = [
    itemUso({
      servico: "resend",
      label: "Resend — e-mails enviados este mês",
      usado: emailsEsteMes || 0,
      limite: LIMITE_EMAILS_MENSAL,
    }),
    itemUso({
      servico: "whatsapp",
      label: "WhatsApp (Meta) — mensagens enviadas este mês",
      usado: whatsappEsteMes || 0,
      limite: LIMITE_WHATSAPP_MENSAL,
    }),
    itemUso({
      servico: "supabase",
      label: "Supabase — condomínios cadastrados (estimativa)",
      usado: totalCondominios || 0,
      limite: LIMITE_CONDOMINIOS_SUPABASE_FREE,
      estimativa: true,
    }),
    itemUso({
      servico: "vercel",
      label: "Vercel — clientes pagantes no plano Hobby",
      usado: ativos,
      limite: 1,
      detalheTexto:
        ativos > 0
          ? `${ativos} cliente(s) pagante(s) — Hobby não permite uso comercial`
          : "Nenhum cliente pagante ainda — Hobby ok",
    }),
  ];

  return NextResponse.json({
    totalCondominios: totalCondominios || 0,
    totalCondominiosAtivos: ativos,
    totalUsuarios: (totalMoradores || 0) + (totalMembros || 0),
    totalMoradores: totalMoradores || 0,
    totalMembros: totalMembros || 0,
    registrosCrescimento: {
      notificacoesLog: totalNotificacoesLog || 0,
      auditoria: totalAuditoria || 0,
      chamados: totalChamados || 0,
    },
    uso,
    nivelGeral: uso.some((u) => u.nivel === "critico")
      ? "critico"
      : uso.some((u) => u.nivel === "atencao")
        ? "atencao"
        : "ok",
  });
}
