"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { authedFetch } from "@/lib/adminFetch";
import { NIVEL_ACESSO_ORDER, NIVEL_ACESSO_LABELS, TAMANHO_MAXIMO_VIDEO, TAMANHO_MAXIMO_THUMBNAIL } from "@/lib/academia";

export default function AdminAcademiaVideoModal({ video, onClose, onChanged }) {
  const [form, setForm] = useState({
    titulo: video.titulo,
    descricao: video.descricao || "",
    categoria: video.categoria || "",
    ordem: video.ordem ?? 0,
    nivel_acesso: video.nivel_acesso,
    status: video.status,
    ativo: video.ativo,
  });
  const [videoPath, setVideoPath] = useState(video.video_path);
  const [thumbnailPath, setThumbnailPath] = useState(video.thumbnail_path);
  const [salvando, setSalvando] = useState(false);
  const [enviandoVideo, setEnviandoVideo] = useState(false);
  const [enviandoThumbnail, setEnviandoThumbnail] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [error, setError] = useState("");

  async function subirArquivo(file, tipo) {
    const res = await authedFetch("/api/admin/academia/upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoId: video.id, tipo, fileName: file.name }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Erro ao preparar upload.");

    const { error: uploadError } = await supabase.storage.from(json.bucket).uploadToSignedUrl(json.path, json.token, file);
    if (uploadError) throw uploadError;
    return json.path;
  }

  async function handleVideoSelecionado(file) {
    if (!file) return;
    if (file.size > TAMANHO_MAXIMO_VIDEO) {
      setError(`Vídeo maior que ${Math.round(TAMANHO_MAXIMO_VIDEO / 1024 / 1024)} MB — escolha um arquivo menor.`);
      return;
    }
    setEnviandoVideo(true);
    setError("");
    try {
      const path = await subirArquivo(file, "video");
      const res = await authedFetch(`/api/admin/academia/${video.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ video_path: path }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setVideoPath(path);
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviandoVideo(false);
    }
  }

  async function handleThumbnailSelecionada(file) {
    if (!file) return;
    if (file.size > TAMANHO_MAXIMO_THUMBNAIL) {
      setError(`Imagem maior que ${Math.round(TAMANHO_MAXIMO_THUMBNAIL / 1024 / 1024)} MB — escolha um arquivo menor.`);
      return;
    }
    setEnviandoThumbnail(true);
    setError("");
    try {
      const path = await subirArquivo(file, "thumbnail");
      const res = await authedFetch(`/api/admin/academia/${video.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thumbnail_path: path }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setThumbnailPath(path);
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviandoThumbnail(false);
    }
  }

  async function handleSalvar(e) {
    e.preventDefault();
    setSalvando(true);
    setError("");
    try {
      const res = await authedFetch(`/api/admin/academia/${video.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo: form.titulo.trim(),
          descricao: form.descricao.trim() || null,
          categoria: form.categoria.trim() || null,
          ordem: Number(form.ordem) || 0,
          nivel_acesso: form.nivel_acesso,
          status: form.status,
          ativo: form.ativo,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      onChanged();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSalvando(false);
    }
  }

  async function handleExcluir() {
    if (!confirm(`Excluir o vídeo "${video.titulo}"? O arquivo enviado também será removido.`)) return;
    setExcluindo(true);
    setError("");
    try {
      const res = await authedFetch(`/api/admin/academia/${video.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      onChanged();
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
          <h2 className="font-display text-lg font-bold text-navy-900">Editar vídeo</h2>
          <button onClick={onClose} className="text-navy-400 hover:text-navy-700" aria-label="Fechar">
            ✕
          </button>
        </div>

        {error && <p className="mt-3 text-sm text-coral-700">{error}</p>}

        <form onSubmit={handleSalvar} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label-field">Título</label>
            <input
              className="input-field"
              value={form.titulo}
              onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
              required
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label-field">Descrição (opcional)</label>
            <textarea
              className="input-field"
              rows={2}
              value={form.descricao}
              onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
            />
          </div>
          <div>
            <label className="label-field">Categoria (opcional)</label>
            <input
              className="input-field"
              value={form.categoria}
              onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value }))}
              placeholder="Ex: Financeiro, Manutenção..."
            />
          </div>
          <div>
            <label className="label-field">Ordem de exibição</label>
            <input
              type="number"
              className="input-field"
              value={form.ordem}
              onChange={(e) => setForm((f) => ({ ...f, ordem: e.target.value }))}
            />
          </div>
          <div>
            <label className="label-field">Nível de acesso</label>
            <select
              className="input-field"
              value={form.nivel_acesso}
              onChange={(e) => setForm((f) => ({ ...f, nivel_acesso: e.target.value }))}
            >
              {NIVEL_ACESSO_ORDER.map((n) => (
                <option key={n} value={n}>
                  {NIVEL_ACESSO_LABELS[n]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-field">Status</label>
            <select
              className="input-field"
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
            >
              <option value="rascunho">Rascunho</option>
              <option value="publicado">Publicado</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="flex items-center gap-2 text-sm text-navy-600">
              <input
                type="checkbox"
                checked={form.ativo}
                onChange={(e) => setForm((f) => ({ ...f, ativo: e.target.checked }))}
              />
              Ativo (desmarcado esconde o vídeo mesmo já publicado)
            </label>
          </div>

          <div className="sm:col-span-2 border-t border-navy-100 pt-3">
            <label className="label-field">Vídeo {videoPath && "(já enviado)"}</label>
            <input
              type="file"
              accept="video/*"
              disabled={enviandoVideo}
              onChange={(e) => handleVideoSelecionado(e.target.files?.[0])}
              className="text-sm text-navy-600"
            />
            {enviandoVideo && <p className="mt-1 text-xs text-navy-500">Enviando vídeo...</p>}
          </div>

          <div className="sm:col-span-2">
            <label className="label-field">Capa/thumbnail {thumbnailPath && "(já enviada)"}</label>
            <input
              type="file"
              accept="image/*"
              disabled={enviandoThumbnail}
              onChange={(e) => handleThumbnailSelecionada(e.target.files?.[0])}
              className="text-sm text-navy-600"
            />
            {enviandoThumbnail && <p className="mt-1 text-xs text-navy-500">Enviando capa...</p>}
          </div>

          <div className="sm:col-span-2 flex gap-3">
            <button type="submit" disabled={salvando} className="btn-primary text-sm">
              {salvando ? "Salvando..." : "Salvar alterações"}
            </button>
            <button
              type="button"
              onClick={handleExcluir}
              disabled={excluindo}
              className="text-sm font-semibold text-coral hover:underline disabled:opacity-50"
            >
              {excluindo ? "Excluindo..." : "Excluir vídeo"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
