import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/adminAuth";
import { buscarOuCriarFornecedorGlobal } from "@/lib/fornecedores";
import { apenasDigitos } from "@/lib/validacaoDocumentos";

// Vincula retroativamente fornecedores locais (tabela `fornecedores`,
// por condomínio) que têm CNPJ válido mas ainda não têm
// fornecedor_global_id — caso de quem cadastrou/importou antes da
// importação por planilha passar a vincular à base geral automaticamente.
export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabaseAdmin = getSupabaseAdmin();
  const { data: pendentes, error } = await supabaseAdmin
    .from("fornecedores")
    .select("id, razao_social, nome_fantasia, endereco, categorias, documento")
    .is("fornecedor_global_id", null)
    .not("documento", "is", null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let vinculados = 0;
  let ignorados = 0;
  const erros = [];

  for (const f of pendentes || []) {
    const digitos = apenasDigitos(f.documento || "");
    if (digitos.length !== 14) {
      ignorados++;
      continue;
    }
    const resultado = await buscarOuCriarFornecedorGlobal(supabaseAdmin, digitos, {
      razaoSocial: f.razao_social,
      nomeFantasia: f.nome_fantasia,
      endereco: f.endereco,
      categorias: f.categorias || [],
    });
    if (resultado.erro || !resultado.id) {
      erros.push(`${f.razao_social}: ${resultado.erro || "sem id"}`);
      continue;
    }
    const { error: updateError } = await supabaseAdmin
      .from("fornecedores")
      .update({ fornecedor_global_id: resultado.id })
      .eq("id", f.id);
    if (updateError) erros.push(`${f.razao_social}: ${updateError.message}`);
    else vinculados++;
  }

  return NextResponse.json({ vinculados, ignorados, erros });
}
