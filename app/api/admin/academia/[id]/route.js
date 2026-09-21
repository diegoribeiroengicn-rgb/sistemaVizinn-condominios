import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/adminAuth";

const CAMPOS_PERMITIDOS = [
  "titulo",
  "descricao",
  "categoria",
  "thumbnail_path",
  "video_path",
  "ordem",
  "status",
  "ativo",
  "nivel_acesso",
];

export async function PATCH(request, { params }) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  const updates = { updated_at: new Date().toISOString() };
  for (const campo of CAMPOS_PERMITIDOS) {
    if (campo in body) updates[campo] = body[campo];
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("academia_videos")
    .update(updates)
    .eq("id", params.id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ video: data });
}

export async function DELETE(request, { params }) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabaseAdmin = getSupabaseAdmin();
  const { data: video } = await supabaseAdmin
    .from("academia_videos")
    .select("video_path, thumbnail_path")
    .eq("id", params.id)
    .maybeSingle();

  if (video?.video_path) {
    await supabaseAdmin.storage.from("academia-videos").remove([video.video_path]);
  }
  if (video?.thumbnail_path) {
    await supabaseAdmin.storage.from("academia-thumbnails").remove([video.thumbnail_path]);
  }

  const { error } = await supabaseAdmin.from("academia_videos").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
