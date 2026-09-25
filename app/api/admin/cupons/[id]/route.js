import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/adminAuth";

const CAMPOS_PERMITIDOS = ["ativo", "usos_maximo", "valor", "vendedor_id"];

export async function PATCH(request, { params }) {
  const auth = await requireAdmin(request, "vendedores");
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  const updates = {};
  for (const campo of CAMPOS_PERMITIDOS) {
    if (campo in body) updates[campo] = body[campo];
  }
  if (Object.keys(updates).length === 0) return NextResponse.json({ error: "Nada para atualizar." }, { status: 400 });

  const supabaseAdmin = getSupabaseAdmin();
  const { error } = await supabaseAdmin.from("cupons").update(updates).eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(request, { params }) {
  const auth = await requireAdmin(request, "vendedores");
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabaseAdmin = getSupabaseAdmin();
  const { error } = await supabaseAdmin.from("cupons").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
