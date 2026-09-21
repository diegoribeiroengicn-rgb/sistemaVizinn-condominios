"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { authedFetch } from "@/lib/adminFetch";
import { NIVEL_ACESSO_LABELS, NIVEL_ACESSO_STYLES, STATUS_LABELS } from "@/lib/academia";
import AdminAcademiaVideoModal from "@/components/AdminAcademiaVideoModal";

const emptyNovo = { titulo: "" };

export default function AdminAcademiaContent() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [novo, setNovo] = useState(emptyNovo);
  const [criando, setCriando] = useState(false);
  const [selecionado, setSelecionado] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await authedFetch("/api/admin/academia");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao carregar vídeos.");
      setVideos(json.videos);
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
    if (!novo.titulo.trim()) return;
    setCriando(true);
    setError("");
    try {
      const res = await authedFetch("/api/admin/academia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titulo: novo.titulo.trim(), ordem: videos.length }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setNovo(emptyNovo);
      await load();
      setSelecionado(json.video);
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
          <h1 className="font-display text-xl font-bold text-navy-900">Academia Vizinn</h1>
          <p className="mt-1 text-sm text-navy-500">
            Vídeos administrados aqui, consumidos pelos condomínios conforme o nível de acesso de
            cada um.
          </p>
        </div>
        <Link href="/admin" className="text-sm font-semibold text-navy-600 hover:underline">
          ← Painel administrativo
        </Link>
      </div>

      <div className="card">
        <h2 className="font-display text-lg font-bold text-navy-900">Novo vídeo</h2>
        <form onSubmit={handleCriar} className="mt-3 flex flex-wrap gap-3">
          <input
            className="input-field flex-1"
            value={novo.titulo}
            onChange={(e) => setNovo({ titulo: e.target.value })}
            placeholder="Título do vídeo"
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
      ) : videos.length === 0 ? (
        <div className="card text-center text-navy-400">Nenhum vídeo cadastrado ainda.</div>
      ) : (
        <div className="space-y-2">
          {videos.map((v) => (
            <button
              key={v.id}
              onClick={() => setSelecionado(v)}
              className="card flex w-full flex-wrap items-center justify-between gap-2 text-left transition hover:border-navy-300"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-navy-400">#{v.ordem}</span>
                  <h3 className="font-semibold text-navy-900">{v.titulo}</h3>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      v.status === "publicado" ? "bg-emerald-100 text-emerald-700" : "bg-navy-100 text-navy-500"
                    }`}
                  >
                    {STATUS_LABELS[v.status]}
                  </span>
                  {!v.ativo && (
                    <span className="rounded-full bg-coral-100 px-2 py-0.5 text-xs font-medium text-coral-700">
                      Inativo
                    </span>
                  )}
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${NIVEL_ACESSO_STYLES[v.nivel_acesso]}`}>
                    {NIVEL_ACESSO_LABELS[v.nivel_acesso]}
                  </span>
                </div>
                <p className="mt-1 text-xs text-navy-400">
                  {[v.categoria, v.video_path ? "vídeo enviado" : "sem vídeo ainda"].filter(Boolean).join(" · ")}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {selecionado && (
        <AdminAcademiaVideoModal
          video={selecionado}
          onClose={() => setSelecionado(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}
