import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { enviarEmail } from "@/lib/notificacoes";
import { parseEmailList } from "@/lib/emailList";

// Sem isso, o Next tenta pré-renderizar essa rota como estática no
// build (já que a checagem do header só roda dentro de um `if`
// condicional) e quebra por não ter as envs do Supabase disponíveis em
// build time — precisa ser sempre dinâmica, é uma rota de cron.
export const dynamic = "force-dynamic";

// Disparado 1x/dia pelo Vercel Cron (ver vercel.json). Avisa por e-mail
// quando um lançamento pendente do financeiro do Vizinn (ex: renovação
// de domínio) está a 30/15/7/1 dias do vencimento, ou vence hoje —
// comparação por dia exato, então cada aviso sai só uma vez (o cron
// roda 1x por dia, não precisa marcar "já avisado" em lugar nenhum).
const DIAS_ALERTA = [30, 15, 7, 1, 0];

export async function GET(request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization") || "";
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data: lancamentos, error } = await supabaseAdmin
    .from("vizinn_lancamentos")
    .select("*")
    .eq("tipo", "pagar")
    .eq("status", "pendente")
    .not("data_vencimento", "is", null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const destinatario = process.env.CONTATO_EMAIL || parseEmailList(process.env.ADMIN_EMAILS)[0];
  if (!destinatario) return NextResponse.json({ enviados: 0, motivo: "Sem destinatário configurado." });

  let enviados = 0;
  for (const l of lancamentos || []) {
    const vencimento = new Date(`${l.data_vencimento}T00:00:00`);
    const diasRestantes = Math.round((vencimento - hoje) / (1000 * 60 * 60 * 24));
    if (!DIAS_ALERTA.includes(diasRestantes)) continue;

    const quando =
      diasRestantes === 0 ? "vence hoje" : diasRestantes === 1 ? "vence amanhã" : `vence em ${diasRestantes} dias`;

    try {
      await enviarEmail({
        to: destinatario,
        subject: `Lembrete: ${l.descricao} ${quando}`,
        html: `
          <p><strong>${l.descricao}</strong> ${quando} (${new Date(`${l.data_vencimento}T00:00:00`).toLocaleDateString("pt-BR")}).</p>
          <p>Categoria: ${l.categoria || "-"}<br/>Valor: ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(l.valor)}</p>
          <p>Acesse /admin/financeiro pra marcar como pago depois de renovar/pagar.</p>
        `,
        fromName: "Vizinn — Lembretes financeiros",
      });
      enviados += 1;
    } catch (err) {
      console.error("Erro ao enviar lembrete de vencimento:", err.message);
    }
  }

  return NextResponse.json({ enviados });
}
