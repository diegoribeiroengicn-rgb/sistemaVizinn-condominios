import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/adminAuth";

// Emite uma URL de upload assinada (curta duração, uso único) pro
// admin subir o arquivo de vídeo/thumbnail DIRETO do navegador pro
// Storage — sem relayar os bytes pela própria rota da Vercel, que tem
// limite de tamanho de corpo bem menor que um vídeo de alguns minutos.
// É assim que "upload direto pelo Dashboard" funciona sem precisar de
// uma policy de escrita aberta nos buckets (ver supabase/schema.sql).
export async function POST(request) {
  const auth = await requireAdmin(request, "academia");
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  const { videoId, tipo, fileName } = body;
  if (!videoId || !["video", "thumbnail"].includes(tipo) || !fileName) {
    return NextResponse.json({ error: "videoId, tipo (video/thumbnail) e fileName são obrigatórios." }, { status: 400 });
  }

  const bucket = tipo === "video" ? "academia-videos" : "academia-thumbnails";
  const caminho = `${videoId}/${Date.now()}-${fileName}`;

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin.storage.from(bucket).createSignedUploadUrl(caminho);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ path: data.path, token: data.token, bucket });
}
