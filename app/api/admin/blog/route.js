import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/adminAuth";
import { registrarAuditoriaAdmin } from "@/lib/adminAuditoria";
import { gerarSlug } from "@/lib/blog";

export async function GET(request) {
  const auth = await requireAdmin(request, "blog");
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin.from("blog_posts").select("*").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ posts: data || [] });
}

export async function POST(request) {
  const auth = await requireAdmin(request, "blog");
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  const titulo = body.titulo?.trim();
  const resumo = body.resumo?.trim();
  const conteudo = body.conteudo?.trim();
  if (!titulo || !resumo || !conteudo) {
    return NextResponse.json({ error: "Título, resumo e conteúdo são obrigatórios." }, { status: 400 });
  }

  const slug = (body.slug?.trim() ? gerarSlug(body.slug) : gerarSlug(titulo)) || gerarSlug(titulo);
  const status = body.status === "publicado" ? "publicado" : "rascunho";

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("blog_posts")
    .insert({
      titulo,
      slug,
      resumo,
      conteudo,
      imagem_capa: body.imagemCapa?.trim() || null,
      video_url: body.videoUrl?.trim() || null,
      meta_descricao: body.metaDescricao?.trim() || resumo,
      autor_nome: body.autorNome?.trim() || "Equipe AquiHabitto",
      status,
      published_at: status === "publicado" ? new Date().toISOString() : null,
    })
    .select()
    .single();
  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "Já existe um post com esse slug." }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await registrarAuditoriaAdmin(supabaseAdmin, {
    adminUser: auth.user,
    acao: "criar",
    entidade: "blog_post",
    entidadeId: data.id,
    dadosNovos: data,
  });

  return NextResponse.json({ success: true, post: data });
}
