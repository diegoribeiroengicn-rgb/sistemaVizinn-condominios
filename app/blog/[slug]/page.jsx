import { notFound } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { blocosDoConteudo } from "@/lib/blog";
import BlogHeader from "@/components/BlogHeader";

// Sem ISR: evita depender de credenciais do Supabase em build time
// (mesmo motivo do force-dynamic já usado nas rotas públicas do resto
// do sistema) — cada post é uma leitura simples, não pesa renderizar
// sempre no servidor.
export const dynamic = "force-dynamic";

async function buscarPost(slug) {
  const supabaseAdmin = getSupabaseAdmin();
  const { data } = await supabaseAdmin
    .from("blog_posts")
    .select("*")
    .eq("slug", slug)
    .eq("status", "publicado")
    .maybeSingle();
  return data;
}

function formatarData(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

export async function generateMetadata({ params }) {
  const post = await buscarPost(params.slug);
  if (!post) return {};
  const descricao = post.meta_descricao || post.resumo;
  return {
    title: post.titulo,
    description: descricao,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      title: post.titulo,
      description: descricao,
      type: "article",
      publishedTime: post.published_at,
      images: post.imagem_capa ? [{ url: post.imagem_capa }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: post.titulo,
      description: descricao,
      images: post.imagem_capa ? [post.imagem_capa] : undefined,
    },
  };
}

export default async function BlogPostPage({ params }) {
  const post = await buscarPost(params.slug);
  if (!post) notFound();

  const blocos = blocosDoConteudo(post.conteudo);

  return (
    <div className="min-h-screen bg-cream-50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: post.titulo,
            description: post.meta_descricao || post.resumo,
            author: { "@type": "Organization", name: post.autor_nome },
            datePublished: post.published_at,
            dateModified: post.updated_at,
            image: post.imagem_capa || undefined,
            publisher: { "@type": "Organization", name: "Vizinn" },
          }),
        }}
      />
      <BlogHeader />
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <article>
          <h1 className="font-display text-3xl font-bold text-navy-900 sm:text-4xl">{post.titulo}</h1>
          <p className="mt-2 text-sm text-navy-400">
            {post.autor_nome} · {formatarData(post.published_at)}
          </p>

          {post.imagem_capa && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={post.imagem_capa} alt="" className="mt-6 aspect-video w-full rounded-xl object-cover" />
          )}

          <div className="prose-vizinn mt-8 space-y-4 text-navy-700">
            {blocos.map((bloco, i) => {
              if (bloco.tipo === "h2") {
                return (
                  <h2 key={i} className="font-display text-2xl font-bold text-navy-900">
                    {bloco.texto}
                  </h2>
                );
              }
              if (bloco.tipo === "lista") {
                return (
                  <ul key={i} className="list-disc space-y-1 pl-6">
                    {bloco.itens.map((item, j) => (
                      <li key={j}>{item}</li>
                    ))}
                  </ul>
                );
              }
              return (
                <p key={i} className="leading-relaxed">
                  {bloco.texto}
                </p>
              );
            })}
          </div>
        </article>
      </main>
    </div>
  );
}
