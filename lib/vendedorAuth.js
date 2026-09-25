import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

// Verifica o token do próprio vendedor (login separado do
// síndico/morador e do admin) e confirma que existe um registro em
// `vendedores` vinculado a esse usuário e ativo. Igual em espírito a
// requireAdmin() (lib/adminAuth.js), mas pra área do vendedor.
export async function requireVendedor(request) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return { error: "Não autenticado.", status: 401 };

  let supabaseAdmin;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (err) {
    return { error: "Integração com Supabase não configurada.", status: 500 };
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return { error: "Sessão inválida ou expirada.", status: 401 };

  const { data: vendedor, error: erroVendedor } = await supabaseAdmin
    .from("vendedores")
    .select("*")
    .eq("user_id", data.user.id)
    .maybeSingle();
  if (erroVendedor) return { error: erroVendedor.message, status: 500 };
  if (!vendedor) return { error: "Nenhum acesso de vendedor vinculado a esse usuário.", status: 403 };
  if (!vendedor.ativo) return { error: "Seu acesso está inativo. Fale com o administrador Vizinn.", status: 403 };

  return { user: data.user, vendedor, supabaseAdmin };
}
