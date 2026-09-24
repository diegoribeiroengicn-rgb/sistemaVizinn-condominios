import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { buscarMelhorResposta } from "@/lib/buscaConhecimento";

// Pública — atende tanto visitante (sem token) quanto usuário logado
// (com token, opcional). Sem token: só conteúdo marcado como público.
// Com token: descobre o papel da pessoa no condomínio (mesmo cálculo
// do useAuth: dono de condomínio = "sindico", senão o papel na tabela
// membros) e mostra conteúdo genérico + específico daquele papel.
// Nunca confia em nada que o cliente diga sobre "quem ele é" — o papel
// sempre vem de uma consulta no servidor.
export const dynamic = "force-dynamic";

export async function POST(request) {
  const { pergunta } = await request.json().catch(() => ({}));
  if (!pergunta?.trim()) {
    return NextResponse.json({ error: "Digite uma pergunta." }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();

  let role = null;
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (token) {
    const { data: userData } = await supabaseAdmin.auth.getUser(token);
    if (userData?.user) {
      const userId = userData.user.id;
      const [{ data: owned }, { data: membro }] = await Promise.all([
        supabaseAdmin.from("condominios").select("id").eq("owner_id", userId).limit(1).maybeSingle(),
        supabaseAdmin.from("membros").select("papel").eq("user_id", userId).maybeSingle(),
      ]);
      role = owned ? "sindico" : membro?.papel || null;
    }
  }

  let query = supabaseAdmin.from("base_conhecimento").select("*").eq("ativo", true);
  query = role ? query.or(`papel_alvo.is.null,papel_alvo.eq.${role}`) : query.eq("publico", true);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const melhor = buscarMelhorResposta(pergunta, data || []);
  if (!melhor) return NextResponse.json({ encontrado: false });

  return NextResponse.json({
    encontrado: true,
    titulo: melhor.titulo,
    respostaCurta: melhor.resposta_curta,
    passoAPasso: melhor.passo_a_passo || null,
  });
}
