import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

// Server-only: verifies the caller's Supabase session token and confirms
// they own the given condominio (i.e. they're its síndico/administradora).
// Used by /api/members/* to gate member management.
export async function requireCondominioOwner(request, condominioId) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return { error: "Não autenticado.", status: 401 };
  }
  if (!condominioId) {
    return { error: "condominioId é obrigatório.", status: 400 };
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) {
    return { error: "Sessão inválida ou expirada.", status: 401 };
  }

  const { data: condominio, error: condoError } = await supabaseAdmin
    .from("condominios")
    .select("id, owner_id")
    .eq("id", condominioId)
    .maybeSingle();

  if (condoError) {
    return { error: `Erro ao verificar condomínio: ${condoError.message}`, status: 500 };
  }
  if (!condominio) {
    return { error: `Condomínio ${condominioId} não encontrado.`, status: 404 };
  }
  if (condominio.owner_id !== data.user.id) {
    return {
      error: `Sessão é do usuário ${data.user.id}, mas o dono deste condomínio é ${condominio.owner_id}.`,
      status: 403,
    };
  }

  return { user: data.user, supabaseAdmin };
}
