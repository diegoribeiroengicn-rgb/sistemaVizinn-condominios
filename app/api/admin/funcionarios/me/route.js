import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdminEmail } from "@/lib/adminAuth";
import { ADMIN_MODULO_IDS } from "@/lib/adminModulos";

// "Quem sou eu e o que posso ver" — usado pelo front (AdminGuard,
// AdminSidebar) pra saber se libera a área /admin pra esse login e
// quais seções mostrar. O dono (ADMIN_EMAILS) sempre vê tudo; um
// funcionário só o que estiver em modulos_permitidos. A enforcement de
// verdade continua em cada rota (requireAdmin(request, modulo)) — isso
// aqui é só pra a UI saber o que mostrar/esconder.
export async function GET(request) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });

  if (isAdminEmail(data.user.email)) {
    return NextResponse.json({ isOwner: true, modulosPermitidos: ADMIN_MODULO_IDS });
  }

  const { data: funcionario } = await supabaseAdmin
    .from("admin_funcionarios").select("nome, modulos_permitidos, ativo").eq("user_id", data.user.id).maybeSingle();
  if (!funcionario || !funcionario.ativo) {
    return NextResponse.json({ error: "Sem acesso ao painel admin." }, { status: 403 });
  }

  return NextResponse.json({ isOwner: false, nome: funcionario.nome, modulosPermitidos: funcionario.modulos_permitidos || [] });
}
