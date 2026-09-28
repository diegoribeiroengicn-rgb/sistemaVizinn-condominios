import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/adminAuth";
import { registrarAuditoriaAdmin } from "@/lib/adminAuditoria";
import { gerarSlug } from "@/lib/blog";

const CAMPOS_PERMITIDOS = {
  titulo: "titulo",
  resumo: "resumo",
  conteudo: "conteudo",
  imagemCapa: "imagem_capa",
  metaDescricao: "meta_descricao",
  autorNome: "autor_nome",
};

export async function PATCH(request, { params }) {
  const auth = await requireAdmin(request, "blog");
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  const supabaseAdmin = getSupabaseAdmin();

  const { data: anterior, error: erroAnterior } = await supabaseAdmin
    .from("blog_posts")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();
  if (erroAnterior) return NextResponse.json({ error: erroAnterior.message }, { status: 500 });
  if (!anterior) return NextResponse.json({ error: "Post não encontrado." }, { status: 404 });

  const updates = {};
  for (const [chave, coluna] of Object.entries(CAMPOS_PERMITIDOS)) {
    if (chave in body) updates[coluna] = body[chave]?.trim?.() ?? body[chave];
  }
  if ("slug" in body && body.slug?.trim()) updates.slug = gerarSlug(body.slug);
  if ("status" in body && ["rascunho", "publicado"].includes(body.status)) {
    updates.status = body.status;
    if (body.status === "publicado" && !anterior.published_at) {
      updates.published_at = new Date().toISOString();
    }
  }
  if (Object.keys(updates).length === 0) return NextResponse.json({ error: "Nada para atualizar." }, { status: 400 });
  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("blog_posts")
    .update(updates)
    .eq("id", params.id)
    .select()
    .single();
  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "Já existe um post com esse slug." }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await registrarAuditoriaAdmin(supabaseAdmin, {
    adminUser: auth.user,
    acao: "editar",
    entidade: "blog_post",
    entidadeId: params.id,
    dadosAnteriores: anterior,
    dadosNovos: data,
  });

  return NextResponse.json({ success: true, post: data });
}

export async function DELETE(request, { params }) {
  const auth = await requireAdmin(request, "blog");
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabaseAdmin = getSupabaseAdmin();
  const { data: anterior, error: erroAnterior } = await supabaseAdmin
    .from("blog_posts")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();
  if (erroAnterior) return NextResponse.json({ error: erroAnterior.message }, { status: 500 });
  if (!anterior) return NextResponse.json({ error: "Post não encontrado." }, { status: 404 });

  const { error } = await supabaseAdmin.from("blog_posts").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await registrarAuditoriaAdmin(supabaseAdmin, {
    adminUser: auth.user,
    acao: "excluir",
    entidade: "blog_post",
    entidadeId: params.id,
    dadosAnteriores: anterior,
  });

  return NextResponse.json({ success: true });
}
