import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/adminAuth";
import { registrarAuditoriaAdmin } from "@/lib/adminAuditoria";
import { ADMIN_MODULO_IDS } from "@/lib/adminModulos";

// Gestão de funcionários do painel admin — só o dono da plataforma
// (ADMIN_EMAILS) mexe aqui, nunca delegável a um funcionário (por
// isso chama requireAdmin(request) sem módulo — ver lib/adminAuth.js:
// sem módulo, só o dono passa).
export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin.from("admin_funcionarios").select("*").order("nome");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ funcionarios: data });
}

export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  const { nome, email, modulosPermitidos } = body;
  if (!nome?.trim() || !email?.trim()) {
    return NextResponse.json({ error: "Nome e e-mail são obrigatórios." }, { status: 400 });
  }
  const modulos = (modulosPermitidos || []).filter((m) => ADMIN_MODULO_IDS.includes(m));
  const emailNormalizado = email.trim().toLowerCase();

  const supabaseAdmin = getSupabaseAdmin();

  // Vendedor e funcionário do admin são papéis separados e nunca
  // podem ser a mesma pessoa (mesmo e-mail) — bloqueia aqui, antes de
  // criar o registro, em vez de deixar o conflito só aparecer depois
  // ao tentar liberar o acesso de login.
  const { data: vendedorExistente } = await supabaseAdmin
    .from("vendedores").select("id").ilike("email", emailNormalizado).maybeSingle();
  if (vendedorExistente) {
    return NextResponse.json(
      { error: "Esse e-mail já está cadastrado como vendedor — não pode ser funcionário também." },
      { status: 409 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("admin_funcionarios")
    .insert({ nome: nome.trim(), email: emailNormalizado, modulos_permitidos: modulos })
    .select()
    .single();
  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "Já existe um funcionário com esse e-mail." }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await registrarAuditoriaAdmin(supabaseAdmin, {
    adminUser: auth.user,
    acao: "criar",
    entidade: "admin_funcionario",
    entidadeId: data.id,
    dadosNovos: data,
  });

  return NextResponse.json({ funcionario: data });
}
