import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { sincronizarLembretes } from "@/lib/lembretesSync";

// Sem isso o Next tenta pré-renderizar essa rota como estática no build
// (mesma razão do cron de lembretes-financeiro) — precisa ser sempre
// dinâmica.
export const dynamic = "force-dynamic";

// Disparado 1x/dia pelo Vercel Cron (ver vercel.json) — processa TODOS os
// condomínios. A lógica em si mora em lib/lembretesSync.js, compartilhada
// com /api/lembretes/sincronizar (botão manual, travado num condomínio só).
export async function GET(request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization") || "";
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }
  }

  const resultado = await sincronizarLembretes(getSupabaseAdmin());
  return NextResponse.json(resultado);
}
