import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/adminAuth";

// Ficha completa de um fornecedor global pro painel admin: dados
// cadastrais + em quais condomínios ele é usado + as avaliações reais
// recebidas em cada um (nome do condomínio incluso — só o owner da
// plataforma vê isso, nunca outro condomínio).
export async function GET(request, { params }) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = params;
  const supabaseAdmin = getSupabaseAdmin();

  const [{ data: global, error: globalError }, { data: locais, error: locaisError }] = await Promise.all([
    supabaseAdmin.from("fornecedores_globais").select("*").eq("id", id).maybeSingle(),
    supabaseAdmin
      .from("fornecedores")
      .select("id, condominio_id, razao_social, status, condominios(nome)")
      .eq("fornecedor_global_id", id),
  ]);
  if (globalError) return NextResponse.json({ error: globalError.message }, { status: 500 });
  if (locaisError) return NextResponse.json({ error: locaisError.message }, { status: 500 });
  if (!global) return NextResponse.json({ error: "Fornecedor global não encontrado." }, { status: 404 });

  const fornecedorLocalIds = (locais || []).map((l) => l.id);
  let avaliacoes = [];
  if (fornecedorLocalIds.length > 0) {
    const { data, error: avaliacoesError } = await supabaseAdmin
      .from("avaliacoes_fornecedor")
      .select("*, condominios(nome)")
      .in("fornecedor_id", fornecedorLocalIds)
      .order("created_at", { ascending: false });
    if (avaliacoesError) return NextResponse.json({ error: avaliacoesError.message }, { status: 500 });
    avaliacoes = data || [];
  }

  return NextResponse.json({ global, relacionamentos: locais || [], avaliacoes });
}
