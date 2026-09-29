"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { authedFetch } from "@/lib/adminFetch";
import { STATUS_LABELS, STATUS_STYLES } from "@/lib/blog";
import AdminBlogPostModal from "@/components/AdminBlogPostModal";

export default function AdminBlogContent() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [novoTitulo, setNovoTitulo] = useState("");
  const [criando, setCriando] = useState(false);
  const [selecionado, setSelecionado] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await authedFetch("/api/admin/blog");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao carregar posts.");
      setPosts(json.posts);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCriar(e) {
    e.preventDefault();
    if (!novoTitulo.trim()) return;
    setCriando(true);
    setError("");
    try {
      const res = await authedFetch("/api/admin/blog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titulo: novoTitulo.trim(), resumo: "Resumo pendente.", conteudo: "Conteúdo pendente." }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setNovoTitulo("");
      await load();
      setSelecionado(json.post);
    } catch (err) {
      setError(err.message);
    } finally {
      setCriando(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-navy-900">Blog</h1>
          <p className="mt-1 text-sm text-navy-500">
            Posts públicos em aquihabitto.com.br/blog — conteúdo pra ranquear no Google.
          </p>
        </div>
        <Link href="/admin" className="text-sm font-semibold text-navy-600 hover:underline">
          ← Painel administrativo
        </Link>
      </div>

      <div className="card">
        <h2 className="font-display text-lg font-bold text-navy-900">Novo post</h2>
        <form onSubmit={handleCriar} className="mt-3 flex flex-wrap gap-3">
          <input
            className="input-field flex-1"
            value={novoTitulo}
            onChange={(e) => setNovoTitulo(e.target.value)}
            placeholder="Título do post"
            required
          />
          <button type="submit" disabled={criando} className="btn-primary">
            {criando ? "Criando..." : "Criar e editar"}
          </button>
        </form>
      </div>

      {error && <p className="text-sm text-coral-700">{error}</p>}

      {loading ? (
        <p className="text-navy-500">Carregando...</p>
      ) : posts.length === 0 ? (
        <div className="card text-center text-navy-400">Nenhum post cadastrado ainda.</div>
      ) : (
        <div className="space-y-2">
          {posts.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelecionado(p)}
              className="card flex w-full flex-wrap items-center justify-between gap-2 text-left transition hover:border-navy-300"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-navy-900">{p.titulo}</h3>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[p.status]}`}>
                    {STATUS_LABELS[p.status]}
                  </span>
                </div>
                <p className="mt-1 text-xs text-navy-400">/blog/{p.slug}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {selecionado && (
        <AdminBlogPostModal post={selecionado} onClose={() => setSelecionado(null)} onChanged={load} />
      )}
    </div>
  );
}
