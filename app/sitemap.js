import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

// Gera /sitemap.xml automaticamente — só as páginas públicas (sem
// login), pra ajudar o Google a indexar o site. Nada de dashboard,
// admin ou qualquer rota que exija login: essas nunca devem ser
// indexadas (nem fariam sentido pra um visitante sem conta).
export default async function sitemap() {
  const baseUrl = "https://www.vizinn.com.br";
  const agora = new Date();

  const entradas = [
    { url: baseUrl, lastModified: agora, changeFrequency: "weekly", priority: 1 },
    { url: `${baseUrl}/blog`, lastModified: agora, changeFrequency: "weekly", priority: 0.8 },
  ];

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data } = await supabaseAdmin
      .from("blog_posts")
      .select("slug, updated_at")
      .eq("status", "publicado");
    for (const post of data || []) {
      entradas.push({
        url: `${baseUrl}/blog/${post.slug}`,
        lastModified: post.updated_at ? new Date(post.updated_at) : agora,
        changeFrequency: "monthly",
        priority: 0.6,
      });
    }
  } catch {
    // Supabase indisponível não pode derrubar o sitemap inteiro — só
    // fica sem os posts individuais até a próxima geração.
  }

  return entradas;
}
