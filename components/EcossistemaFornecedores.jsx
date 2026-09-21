"use client";

import { useEffect, useState } from "react";

// Vitrine pública do Ecossistema de Fornecedores Vizinn (sem login) —
// busca só uma prévia real via /api/public/fornecedores-destaque, que
// já limita a 3 fornecedores e nunca manda a base inteira pro
// navegador. O nome do fornecedor nem sai do backend — o card mostra a
// categoria (o que ele faz) e, quando existir, um comentário real de
// avaliação (só as marcadas como públicas por quem avaliou); o "🔒
// Nome disponível para assinantes" é um cadeado de verdade, não CSS
// escondendo um nome que já chegou no navegador. Sem fornecedor
// cadastrado ainda, cai num texto genérico — nunca inventa nada.
export default function EcossistemaFornecedores({ onStart }) {
  const [dados, setDados] = useState(null);

  useEffect(() => {
    let ativo = true;
    fetch("/api/public/fornecedores-destaque")
      .then((res) => res.json())
      .then((json) => {
        if (ativo) setDados(json);
      })
      .catch(() => {
        if (ativo) setDados({ total: 0, destaques: [], porCategoria: [] });
      });
    return () => {
      ativo = false;
    };
  }, []);

  const total = dados?.total ?? 0;
  const destaques = dados?.destaques || [];
  const porCategoria = dados?.porCategoria || [];
  const restantes = Math.max(total - destaques.length, 0);

  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6" id="fornecedores">
      <div className="mx-auto max-w-2xl text-center">
        <span className="text-3xl">🤝</span>
        <h2 className="mt-3 font-display text-3xl font-bold text-navy-900 sm:text-4xl">
          Ecossistema de Fornecedores Vizinn
        </h2>
        <p className="mt-4 text-navy-600">
          Uma rede compartilhada entre todos os condomínios Vizinn: fornecedores de verdade,
          cadastrados por síndicos de verdade, com reputação real baseada em avaliações — nada
          fictício.
        </p>
      </div>

      {total > 0 ? (
        <>
          {porCategoria.length > 0 && (
            <div className="mt-10 flex flex-wrap justify-center gap-2">
              {porCategoria.map((c) => (
                <span
                  key={c.categoria}
                  className="rounded-full bg-navy-50 px-3 py-1 text-sm font-medium text-navy-600"
                >
                  {c.categoria} · {c.quantidade}
                </span>
              ))}
            </div>
          )}

          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
            {destaques.map((f, i) => (
              <div key={i} className="card">
                <h3 className="font-semibold text-navy-900">{f.categoria || "Fornecedor Vizinn"}</h3>
                <div className="mt-1 flex items-center gap-2">
                  <span className="select-none text-sm text-navy-300 blur-[3px]" aria-hidden="true">
                    Nome do fornecedor
                  </span>
                  <span className="text-xs font-medium text-navy-400">🔒 disponível para assinantes</span>
                </div>
                {f.comentario ? (
                  <p className="mt-3 text-sm italic text-navy-600">&ldquo;{f.comentario}&rdquo;</p>
                ) : f.totalAvaliacoes > 0 ? (
                  <p className="mt-3 text-sm text-navy-600">
                    ⭐ {f.notaMedia} · {f.totalAvaliacoes} avaliação{f.totalAvaliacoes === 1 ? "" : "ões"}
                  </p>
                ) : (
                  <p className="mt-3 text-xs text-navy-400">Ainda sem avaliações</p>
                )}
              </div>
            ))}
            {restantes > 0 && (
              <div className="card flex flex-col items-center justify-center text-center text-navy-400">
                <span className="text-2xl">🔒</span>
                <p className="mt-2 text-sm font-medium">
                  +{restantes} fornecedor{restantes === 1 ? "" : "es"} na rede
                </p>
                <p className="mt-1 text-xs">Assine para ver contato, avaliações e adicionar ao seu condomínio.</p>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="card mx-auto mt-10 max-w-2xl text-center text-navy-500">
          Estamos formando a rede agora — cada fornecedor cadastrado por um síndico entra
          automaticamente na base compartilhada, com CNPJ único e reputação real.
        </div>
      )}

      <div className="mt-8 text-center">
        <button onClick={onStart} className="btn-primary">
          Começar 14 dias grátis
        </button>
      </div>
    </section>
  );
}
