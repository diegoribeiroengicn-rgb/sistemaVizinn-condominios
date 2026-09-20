import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { parseEmailList } from "@/lib/emailList";

// Server-only: is this e-mail allowed to use the platform admin dashboard?
// Authoritative check — never trust the client for this decision.
export function isAdminEmail(email) {
  if (!email) return false;
  return parseEmailList(process.env.ADMIN_EMAILS).includes(email.toLowerCase());
}

// Verifies the Supabase access token sent by the client (Authorization:
// Bearer <token>) and confirms the signed-in user is the platform owner.
// Returns { user } on success or { error, status } on failure.
export async function requireAdmin(request) {
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

  if (!isAdminEmail(data.user.email)) {
    return { error: "Acesso restrito ao administrador da plataforma.", status: 403 };
  }

  return { user: data.user };
}
