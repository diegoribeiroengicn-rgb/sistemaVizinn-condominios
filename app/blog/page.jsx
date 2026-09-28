import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import BlogHeader from "@/components/BlogHeader";

// Sem ISR: a listagem muda pouco, mas evita depender de credenciais
// do Supabase estarem disponíveis em build time (mesmo motivo do
// force-dynamic já usado nas rotas públicas do resto do sistema).
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Blog",
  description:
    "Conteúdo sobre gestão condominial: financeiro, chamados, portaria, fornecedores e tudo que ajuda o síndico a rodar um condomínio inteligente.",
  alternates: { canonical: "/blog" },
};

async function buscarPosts() {
  const supabaseAdmin = getSupabaseAdmin();
  const { data } = await supabaseAdmin
    .from("blog_posts")
    .select("titulo, slug, resumo, imagem_capa, autor_nome, published_at")
    .eq("status", "publicado")
    .order("published_at", { ascending: false });
  return data || [];
}

function formatarData(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

export default async function BlogPage() {
  const posts = await buscarPosts();

  return (
    <div className="min-h-screen bg-cream-50">
      <BlogHeader />
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="font-display text-3xl font-bold text-navy-900">Blog Vizinn</h1>
        <p className="mt-2 text-navy-600">
          Dicas e conteúdo sobre gestão condominial — financeiro, chamados, portaria e mais.
        </p>

        {posts.length === 0 ? (
          <div className="card mt-8 text-center text-navy-400">Nenhum post publicado ainda.</div>
        ) : (
          <div className="mt-8 space-y-6">
            {posts.map((p) => (
              <Link key={p.slug} href={`/blog/${p.slug}`} className="card block transition hover:border-navy-300">
                {p.imagem_capa && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imagem_capa} alt="" className="mb-4 aspect-video w-full rounded-xl object-cover" />
                )}
                <h2 className="font-display text-xl font-bold text-navy-900">{p.titulo}</h2>
                <p className="mt-2 text-navy-600">{p.resumo}</p>
                <p className="mt-3 text-xs text-navy-400">
                  {p.autor_nome} · {formatarData(p.published_at)}
                </p>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
