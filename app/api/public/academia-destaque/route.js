import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

// Sem parâmetro de request, o Next tentaria pré-renderizar essa rota
// como estática em build time (e falharia, sem as env vars do
// Supabase disponíveis nesse momento). Força sempre dinâmica.
export const dynamic = "force-dynamic";

// Pública (sem login) — mostra a Academia Vizinn como diferencial na
// página inicial. Só devolve vídeos que o admin marcou explicitamente
// como nível "público" (livre pra qualquer visitante, ver
// usuario_tem_acesso_academia em supabase/schema.sql), publicados e
// ativos — nunca rascunho, nunca um vídeo de nível pago. A restrição é
// de verdade aqui no backend (service role bypassa RLS só pra filtrar
// isso), nunca "manda tudo e esconde com CSS".
export async function GET() {
  const supabaseAdmin = getSupabaseAdmin();

  const { data, error } = await supabaseAdmin
    .from("academia_videos")
    .select("id, titulo, descricao, categoria, thumbnail_path, video_path")
    .eq("status", "publicado")
    .eq("ativo", true)
    .eq("nivel_acesso", "publico")
    .order("ordem", { ascending: true })
    .limit(3);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const videos = await Promise.all(
    (data || []).map(async (v) => {
      const thumbnailUrl = v.thumbnail_path
        ? supabaseAdmin.storage.from("academia-thumbnails").getPublicUrl(v.thumbnail_path).data.publicUrl
        : null;
      let videoUrl = null;
      if (v.video_path) {
        const { data: signed } = await supabaseAdmin.storage
          .from("academia-videos")
          .createSignedUrl(v.video_path, 300);
        videoUrl = signed?.signedUrl || null;
      }
      return { id: v.id, titulo: v.titulo, descricao: v.descricao, categoria: v.categoria, thumbnailUrl, videoUrl };
    })
  );

  // Total publicado (qualquer nível) só pra dar noção do tamanho da
  // biblioteca no texto de marketing — não some ao valor de assinar.
  const { count: totalPublicado } = await supabaseAdmin
    .from("academia_videos")
    .select("id", { count: "exact", head: true })
    .eq("status", "publicado")
    .eq("ativo", true);

  return NextResponse.json({ videos, totalPublicado: totalPublicado || 0 });
}
