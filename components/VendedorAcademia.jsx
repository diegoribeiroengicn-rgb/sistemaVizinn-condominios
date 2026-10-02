"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { NIVEL_ACESSO_LABELS, NIVEL_ACESSO_STYLES } from "@/lib/academia";

// Academia AquiHabitto dentro do painel do vendedor — separada em duas
// vitrines: o catálogo normal (público/teste/assinante, mesmo que o
// condomínio vê) e os vídeos de nível "vendedores" (treinamento de
// vendas, exclusivo daqui). Sem cadeado: vendedor ativo tem acesso a
// tudo (ver usuario_tem_acesso_academia em supabase/schema.sql), então
// aqui é só listar e tocar.
export default function VendedorAcademia() {
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
      setError("Não foi possível abrir esse vídeo agora. Tente de novo em instantes.");
      return;
    }
    setTocando({ id: video.id, url: data.signedUrl });
  }

  const videosSistema = videos.filter((v) => v.nivel_acesso !== "vendedores");
  const videosVendas = videos.filter((v) => v.nivel_acesso === "vendedores");

  return (
    <div className="space-y-4">
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

      <AcademiaSecao
        titulo="Academia AquiHabitto"
        descricao="Vídeos de como usar o sistema — o mesmo catálogo que o condomínio vê."
        videos={videosSistema}
        loading={loading}
        abrindoId={abrindoId}
        onAssistir={handleAssistir}
      />

      <AcademiaSecao
        titulo="Academia AquiHabitto Vendas"
        descricao="Treinamento de vendas exclusivo pra vendedores."
        videos={videosVendas}
        loading={loading}
        abrindoId={abrindoId}
        onAssistir={handleAssistir}
      />
    </div>
  );
}

function AcademiaSecao({ titulo, descricao, videos, loading, abrindoId, onAssistir }) {
  return (
    <div className="card space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-navy-800">{titulo}</h2>
        <p className="mt-1 text-xs text-navy-500">{descricao}</p>
      </div>

      {loading ? (
        <p className="text-sm text-navy-500">Carregando vídeos...</p>
      ) : videos.length === 0 ? (
        <p className="text-sm text-navy-400">Nenhum vídeo disponível ainda.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {videos.map((v) => (
            <VideoCard key={v.id} video={v} abrindo={abrindoId === v.id} onAssistir={onAssistir} />
          ))}
        </div>
      )}
    </div>
  );
}

function VideoCard({ video, abrindo, onAssistir }) {
  return (
    <div className="rounded-xl border border-navy-100 p-3">
      <div className="flex aspect-video items-center justify-center overflow-hidden rounded-lg bg-navy-900">
        {video.thumbnail_path ? (
          <img
            src={supabase.storage.from("academia-thumbnails").getPublicUrl(video.thumbnail_path).data.publicUrl}
            alt={video.titulo}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="text-3xl">🎬</span>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-navy-900">{video.titulo}</h3>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${NIVEL_ACESSO_STYLES[video.nivel_acesso]}`}>
          {NIVEL_ACESSO_LABELS[video.nivel_acesso]}
        </span>
      </div>
      {video.descricao && <p className="mt-1 text-xs text-navy-600">{video.descricao}</p>}
      <button
        onClick={() => onAssistir(video)}
        disabled={abrindo}
        className="btn-primary mt-2 w-full text-sm disabled:opacity-50"
      >
        {abrindo ? "Abrindo..." : "Assistir"}
      </button>
    </div>
  );
}
