"use client";

import { useState } from "react";
import { authedFetch } from "@/lib/adminFetch";
import { gerarSlug } from "@/lib/blog";

export default function AdminBlogPostModal({ post, onClose, onChanged }) {
  const [form, setForm] = useState({
    titulo: post.titulo || "",
    slug: post.slug || "",
    resumo: post.resumo || "",
    conteudo: post.conteudo || "",
    imagemCapa: post.imagem_capa || "",
    videoUrl: post.video_url || "",
    metaDescricao: post.meta_descricao || "",
    autorNome: post.autor_nome || "Equipe Vizinn",
  });
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [error, setError] = useState("");
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);

  async function salvar(novoStatus) {
    setSalvando(true);
    setError("");
    try {
      const body = { ...form };
      if (novoStatus) body.status = novoStatus;
      const res = await authedFetch(`/api/admin/blog/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      await onChanged();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSalvando(false);
    }
  }

  async function excluir() {
    setExcluindo(true);
    setError("");
    try {
      const res = await authedFetch(`/api/admin/blog/${post.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      await onChanged();
      onClose();
    } catch (err) {
      setError(err.message);
      setExcluindo(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-midnight/60 px-4 py-8 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6">
        <div className="flex items-start justify-between gap-4">
          <h2 className="font-display text-lg font-bold text-navy-900">Editar post</h2>
          <button onClick={onClose} className="text-navy-400 hover:text-navy-700" aria-label="Fechar">✕</button>
        </div>

        <div className="mt-4 space-y-4">
          {error && <p className="text-sm text-coral-700">{error}</p>}

          <div>
            <label className="label-field">Título</label>
            <input
              className="input-field"
              value={form.titulo}
              onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
            />
          </div>

          <div>
            <label className="label-field">Slug (URL: /blog/...)</label>
            <input
              className="input-field"
              value={form.slug}
              onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
              onBlur={(e) => setForm((f) => ({ ...f, slug: gerarSlug(e.target.value) }))}
            />
          </div>

          <div>
            <label className="label-field">Resumo (aparece na listagem)</label>
            <textarea
              rows={2}
              className="input-field"
              value={form.resumo}
              onChange={(e) => setForm((f) => ({ ...f, resumo: e.target.value }))}
            />
          </div>

          <div>
            <label className="label-field">Conteúdo</label>
            <textarea
              rows={14}
              className="input-field font-mono text-xs"
              value={form.conteudo}
              onChange={(e) => setForm((f) => ({ ...f, conteudo: e.target.value }))}
            />
            <p className="mt-1 text-xs text-navy-400">
              Separe parágrafos com uma linha em branco. Uma linha começando com &ldquo;## &rdquo; vira título de
              seção. Linhas começando com &ldquo;- &rdquo; (todas seguidas) viram lista. Texto entre
              &ldquo;**assim**&rdquo; vira negrito.
            </p>
          </div>

          <div>
            <label className="label-field">Imagem de capa (URL, opcional)</label>
            <input
              className="input-field"
              value={form.imagemCapa}
              onChange={(e) => setForm((f) => ({ ...f, imagemCapa: e.target.value }))}
              placeholder="https://..."
            />
          </div>

          <div>
            <label className="label-field">Vídeo (link do YouTube, opcional)</label>
            <input
              className="input-field"
              value={form.videoUrl}
              onChange={(e) => setForm((f) => ({ ...f, videoUrl: e.target.value }))}
              placeholder="https://www.youtube.com/watch?v=..."
            />
            <p className="mt-1 text-xs text-navy-400">
              Cole o link do vídeo no YouTube. Ele aparece embutido no topo do post.
            </p>
          </div>

          <div>
            <label className="label-field">Meta descrição (SEO, opcional — usa o resumo se vazio)</label>
            <textarea
              rows={2}
              className="input-field"
              value={form.metaDescricao}
              onChange={(e) => setForm((f) => ({ ...f, metaDescricao: e.target.value }))}
            />
          </div>

          <div>
            <label className="label-field">Autor</label>
            <input
              className="input-field"
              value={form.autorNome}
              onChange={(e) => setForm((f) => ({ ...f, autorNome: e.target.value }))}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-navy-100 pt-4">
            {confirmandoExclusao ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-coral-700">Excluir esse post?</span>
                <button onClick={excluir} disabled={excluindo} className="text-sm font-semibold text-coral-700 hover:underline">
                  {excluindo ? "Excluindo..." : "Confirmar"}
                </button>
                <button onClick={() => setConfirmandoExclusao(false)} className="text-sm text-navy-500 hover:underline">
                  Cancelar
                </button>
              </div>
            ) : (
              <button onClick={() => setConfirmandoExclusao(true)} className="text-sm font-semibold text-coral-700 hover:underline">
                Excluir post
              </button>
            )}

            <div className="flex gap-2">
              <button onClick={() => salvar()} disabled={salvando} className="btn-secondary text-sm disabled:opacity-50">
                {salvando ? "Salvando..." : "Salvar"}
              </button>
              {post.status === "publicado" ? (
                <button onClick={() => salvar("rascunho")} disabled={salvando} className="btn-secondary text-sm disabled:opacity-50">
                  Voltar pra rascunho
                </button>
              ) : (
                <button onClick={() => salvar("publicado")} disabled={salvando} className="btn-primary text-sm disabled:opacity-50">
                  Salvar e publicar
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
