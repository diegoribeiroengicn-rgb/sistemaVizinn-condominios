import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { parseEmailList } from "@/lib/emailList";

// Server-only: is this e-mail allowed to use the platform admin dashboard?
// Authoritative check — never trust the client for this decision.
export function isAdminEmail(email) {
  if (!email) return false;
  return parseEmailList(process.env.ADMIN_EMAILS).includes(email.toLowerCase());
}

// Verifica o token do Supabase mandado pelo cliente (Authorization:
// Bearer <token>) e confirma acesso ao painel admin — dono da
// plataforma (ADMIN_EMAILS, acesso total, sempre passa) OU um
// funcionário administrativo (admin_funcionarios) com o módulo pedido
// liberado em `modulos_permitidos`.
//
// `modulo` (opcional, ver lib/adminModulos.js): quando informado, um
// funcionário só passa se tiver esse módulo liberado. Quando OMITIDO,
// um funcionário nunca passa (só o dono) — por segurança, uma rota só
// abre pra funcionário se for explicitamente anotada com o módulo
// certo; esquecer de anotar nunca abre acesso indevido, só bloqueia a
// mais (o dono nunca é afetado por isso, sempre passa em qualquer rota).
//
// Retorna { user, isOwner, funcionario? } no sucesso, { error, status } no erro.
export async function requireAdmin(request, modulo = null) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return { error: "Não autenticado.", status: 401 };
  }

  let supabaseAdmin;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (err) {
    return { error: "Integração com Supabase não configurada.", status: 500 };
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) {
    return { error: "Sessão inválida ou expirada.", status: 401 };
  }

  if (isAdminEmail(data.user.email)) {
    return { user: data.user, isOwner: true };
  }

  const { data: funcionario, error: erroFuncionario } = await supabaseAdmin
    .from("admin_funcionarios")
    .select("*")
    .eq("user_id", data.user.id)
    .eq("ativo", true)
    .maybeSingle();
  if (erroFuncionario) return { error: erroFuncionario.message, status: 500 };

  if (!funcionario || !modulo || !funcionario.modulos_permitidos?.includes(modulo)) {
    return { error: "Acesso restrito ao administrador da plataforma.", status: 403 };
  }

  return { user: data.user, isOwner: false, funcionario };
}
