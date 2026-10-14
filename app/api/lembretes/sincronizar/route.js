import { NextResponse } from "next/server";
import { requireCondominioAccess } from "@/lib/memberAuth";
import { sincronizarLembretes } from "@/lib/lembretesSync";

// Sem isso o Next tenta pré-renderizar essa rota como estática no build.
export const dynamic = "force-dynamic";

// Botão "Sincronizar agora" em /dashboard/lembretes — roda a mesma lógica
// do cron diário (ver lib/lembretesSync.js), mas travada no condomínio de
// quem chamou (nunca processa nem manda e-mail de outro condomínio), pra
// quem não quer esperar o cron rodar sozinho pra ver o resultado.
export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const { condominioId } = body;

  const acesso = await requireCondominioAccess(request, condominioId, "lembretes", "criar");
  if (acesso.error) return NextResponse.json({ error: acesso.error }, { status: acesso.status });

  const resultado = await sincronizarLembretes(acesso.supabaseAdmin, { condominioId });
  return NextResponse.json(resultado);
}
