import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/adminAuth";

// Platform-owner-only: gestão dos vídeos da Academia Vizinn. Usa
// service role (bypassa RLS) — a policy de select em academia_videos só
// libera pra "authenticated" vídeo publicado+ativo, então essa rota é
// a única forma de ver/mexer em rascunhos.
export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("academia_videos")
    .select("*")
    .order("ordem", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ videos: data || [] });
}

export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  if (!body.titulo?.trim()) {
    return NextResponse.json({ error: "Título é obrigatório." }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("academia_videos")
    .insert({
      titulo: body.titulo.trim(),
      descricao: body.descricao?.trim() || null,
      categoria: body.categoria?.trim() || null,
      ordem: Number(body.ordem) || 0,
      status: "rascunho",
      ativo: true,
      nivel_acesso: body.nivel_acesso || "assinante",
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ video: data });
}
