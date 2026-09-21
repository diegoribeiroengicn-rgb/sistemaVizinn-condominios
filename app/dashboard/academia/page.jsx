"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { NIVEL_ACESSO_LABELS, NIVEL_ACESSO_STYLES, pareceAcessivel } from "@/lib/academia";

export default function AcademiaPage() {
  const { condominio } = useAuth();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tocando, setTocando] = useState(null); // { id, url }
  const [abrindoId, setAbrindoId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const { data, error: fetchError } = await supabase
      .from("academia_videos")
      .select("*")
      .order("ordem", { ascending: true });
    if (fetchError) setError(fetchError.message);
    else setVideos(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAssistir(video) {
    setError("");
    if (!video.video_path) {
      setError("Este vídeo ainda não tem arquivo enviado.");
      return;
    }
    setAbrindoId(video.id);
    const { data, error: urlError } = await supabase.storage
      .from("academia-videos")
      .createSignedUrl(video.video_path, 300);
    setAbrindoId(null);
    if (urlError) {
      setError("Esse vídeo é exclusivo para um nível de acesso que sua assinatura ainda não tem.");
      return;
    }
    setTocando({ id: video.id, url: data.signedUrl });
  }

  const statusCondominio = condominio?.status;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-bold text-navy-900">Academia Vizinn</h1>
        <p className="mt-1 text-sm text-navy-500">
          Vídeos curtos pra tirar o máximo proveito do sistema — alguns são públicos, outros
          liberados durante o teste grátis ou exclusivos para assinantes.
        </p>
      </div>

      {error && <p className="text-sm text-coral-700">{error}</p>}

      {tocando && (
        <div className="card">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-navy-800">Assistindo agora</p>
            <button onClick={() => setTocando(null)} className="text-xs font-semibold text-navy-500 hover:underline">
              Fechar
            </button>
          </div>
          <video controls autoPlay className="mt-2 w-full rounded-xl bg-black" src={tocando.url}>
            Seu navegador não suporta vídeo.
          </video>
        </div>
      )}

      {loading ? (
        <p className="text-navy-500">Carregando vídeos...</p>
      ) : videos.length === 0 ? (
        <div className="card text-center text-navy-400">Nenhum vídeo disponível ainda.</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {videos.map((v) => {
            const acessivel = pareceAcessivel(v.nivel_acesso, statusCondominio);
            return (
              <div key={v.id} className="card">
                <div className="flex aspect-video items-center justify-center overflow-hidden rounded-xl bg-navy-900">
                  {v.thumbnail_path ? (
                    <img
                      src={supabase.storage.from("academia-thumbnails").getPublicUrl(v.thumbnail_path).data.publicUrl}
                      alt={v.titulo}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-3xl">🎬</span>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-navy-900">{v.titulo}</h3>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${NIVEL_ACESSO_STYLES[v.nivel_acesso]}`}>
                    {NIVEL_ACESSO_LABELS[v.nivel_acesso]}
                  </span>
                </div>
                {v.descricao && <p className="mt-1 text-sm text-navy-600">{v.descricao}</p>}
                <button
                  onClick={() => handleAssistir(v)}
                  disabled={abrindoId === v.id}
                  className={acessivel ? "btn-primary mt-3 text-sm disabled:opacity-50" : "btn-secondary mt-3 text-sm disabled:opacity-50"}
                >
                  {abrindoId === v.id
                    ? "Abrindo..."
                    : acessivel
                      ? "Assistir"
                      : `🔒 Exclusivo — ${NIVEL_ACESSO_LABELS[v.nivel_acesso]}`}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
