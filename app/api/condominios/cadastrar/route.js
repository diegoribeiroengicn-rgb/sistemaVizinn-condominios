import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getPlan } from "@/lib/plans";

// Cadastro autônomo de um novo condomínio pelo próprio dashboard —
// seção 12 do prompt de upgrade. Só pra quem já é síndico (dono de ao
// menos 1 condomínio) e tem o Pro+ Multicondomínios ativo; o novo
// condomínio nasce com owner_id = o mesmo usuário (mesma conta, sem
// criar login novo) e sem assinatura própria no Stripe, já que a
// cobrança do Pro+ Multicondomínios é consolidada/negociada à parte
// (ver PainelMulticondominios em /admin/pagamentos), não por condomínio.
export async function POST(request) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const supabaseAdmin = getSupabaseAdmin();
  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData?.user) {
    return NextResponse.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
  }
  const user = authData.user;

  const { data: conta, error: contaError } = await supabaseAdmin
    .from("contas_sindico")
    .select("pro_plus_multicondominios")
    .eq("user_id", user.id)
    .maybeSingle();
  if (contaError) return NextResponse.json({ error: contaError.message }, { status: 500 });
  if (!conta?.pro_plus_multicondominios) {
    return NextResponse.json(
      { error: "Cadastro de novos condomínios é um recurso do Pro+ Multicondomínios." },
      { status: 403 }
    );
  }

  const { data: existentes, error: existentesError } = await supabaseAdmin
    .from("condominios")
    .select("id")
    .eq("owner_id", user.id)
    .limit(1);
  if (existentesError) return NextResponse.json({ error: existentesError.message }, { status: 500 });
  if (!existentes || existentes.length === 0) {
    return NextResponse.json({ error: "Nenhum condomínio encontrado para esta conta." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const { nome, cnpj, endereco, responsavelNome, responsavelTelefone, planoId } = body;
  if (!nome?.trim()) {
    return NextResponse.json({ error: "Nome do condomínio é obrigatório." }, { status: 400 });
  }

  const plan = getPlan(planoId);

  const { data: condominio, error: condoError } = await supabaseAdmin
    .from("condominios")
    .insert({
      owner_id: user.id,
      owner_email: user.email,
      nome: nome.trim(),
      cnpj: cnpj?.trim() || null,
      endereco: endereco?.trim() || null,
      responsavel_nome: responsavelNome?.trim() || null,
      responsavel_telefone: responsavelTelefone?.trim() || null,
      plano: plan.id,
      unidades_limite: plan.unitLimit,
    })
    .select("id, nome")
    .single();
  if (condoError) return NextResponse.json({ error: condoError.message }, { status: 500 });

  return NextResponse.json({ success: true, condominio });
}
