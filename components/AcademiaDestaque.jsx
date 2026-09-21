"use client";

import { useEffect, useState } from "react";

// Vitrine pública da Academia Vizinn (sem login) — busca só os vídeos
// que o admin marcou como nível "público" via /api/public/academia-destaque,
// que já filtra isso no backend (nunca manda vídeo pago escondido com CSS).
// Sem vídeo público cadastrado ainda, cai num texto genérico — nunca
// inventa título de vídeo que não existe.
export default function AcademiaDestaque({ onStart }) {
  const [dados, setDados] = useState(null);
  const [tocando, setTocando] = useState(null);

  useEffect(() => {
    let ativo = true;
    fetch("/api/public/academia-destaque")
      .then((res) => res.json())
      .then((json) => {
        if (ativo) setDados(json);
      })
      .catch(() => {
        if (ativo) setDados({ videos: [], totalPublicado: 0 });
      });
    return () => {
      ativo = false;
    };
  }, []);

  const videos = dados?.videos || [];

  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6" id="academia">
      <div className="mx-auto max-w-2xl text-center">
        <span className="text-3xl">🎓</span>
        <h2 className="mt-3 font-display text-3xl font-bold text-navy-900 sm:text-4xl">
          Academia Vizinn
        </h2>
        <p className="mt-4 text-navy-600">
          Vídeos curtos e diretos pra você dominar o sistema — do cadastro de um morador à emissão
          de relatório de assembleia. Um diferencial que nenhum outro sistema de gestão de
          condomínio oferece.
        </p>
      </div>

      {videos.length > 0 ? (
        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-3">
          {videos.map((v) => (
            <div key={v.id} className="card">
              <div className="flex aspect-video items-center justify-center overflow-hidden rounded-xl bg-navy-900">
                {tocando === v.id && v.videoUrl ? (
                  <video controls autoPlay className="h-full w-full" src={v.videoUrl}>
                    Seu navegador não suporta vídeo.
                  </video>
                ) : (
                  <button
                    onClick={() => setTocando(v.id)}
                    className="group relative flex h-full w-full items-center justify-center"
                    aria-label={`Assistir: ${v.titulo}`}
                  >
                    {v.thumbnailUrl ? (
                      <img src={v.thumbnailUrl} alt={v.titulo} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-3xl">🎬</span>
                    )}
                    <span className="absolute inset-0 flex items-center justify-center bg-midnight/20 text-3xl text-white transition group-hover:bg-midnight/40">
                      ▶
                    </span>
                  </button>
                )}
              </div>
              <h3 className="mt-3 font-semibold text-navy-900">{v.titulo}</h3>
              {v.descricao && <p className="mt-1 text-sm text-navy-600">{v.descricao}</p>}
              <span className="mt-2 inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                Vídeo público
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="card mx-auto mt-12 max-w-2xl text-center text-navy-500">
          Estamos gravando os primeiros vídeos — em breve, aulas curtas liberadas pra qualquer
          visitante, sem precisar criar conta.
        </div>
      )}

      <p className="mx-auto mt-6 max-w-xl text-center text-sm text-navy-400">
        Alguns vídeos são livres pra qualquer visitante; o restante libera durante o teste grátis
        de 14 dias ou é exclusivo para assinantes.
      </p>

      <div className="mt-8 text-center">
        <button onClick={onStart} className="btn-primary">
          Começar 14 dias grátis
        </button>
      </div>
    </section>
  );
}
