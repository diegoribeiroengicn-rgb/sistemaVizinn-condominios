"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { CATEGORIAS_SUGERIDAS } from "@/lib/fornecedores";
import { formatarCnpj } from "@/lib/validacaoDocumentos";

// Busca na base compartilhada de fornecedores de todo o ecossistema
// Vizinn (não só os cadastrados neste condomínio) — ver
// fornecedores_globais em supabase/schema.sql. Reputação vem de uma
// função no banco que só devolve números agregados (nota média,
// quantidade de avaliações, quantidade de condomínios), nunca dado
// cru de outro condomínio.
export default function RedeFornecedoresVizinn({ condominioId, meusFornecedoresGlobalIds, onAdicionado }) {
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState("");
  const [resultados, setResultados] = useState(null);
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState("");
  const [adicionandoId, setAdicionandoId] = useState(null);

  async function handleBuscar(e) {
    e.preventDefault();
    setBuscando(true);
    setError("");

    let query = supabase.from("fornecedores_globais").select("id, cnpj, razao_social, nome_fantasia, categoria, endereco");
    const termo = busca.trim();
    if (termo) {
      const digitos = termo.replace(/\D/g, "");
      if (digitos.length >= 4) {
        query = query.ilike("cnpj", `%${digitos}%`);
      } else {
        query = query.or(`razao_social.ilike.%${termo}%,nome_fantasia.ilike.%${termo}%`);
      }
    }
    if (categoria) query = query.eq("categoria", categoria);

    const { data, error: buscaError } = await query.order("razao_social", { ascending: true }).limit(30);
    if (buscaError) {
      setBuscando(false);
      setError(buscaError.message);
      return;
    }

    const comReputacao = await Promise.all(
      (data || []).map(async (f) => {
        const { data: rep } = await supabase.rpc("reputacao_fornecedor_global", { p_fornecedor_global_id: f.id });
        return { ...f, reputacao: rep?.[0] || null };
      })
    );
    setResultados(comReputacao);
    setBuscando(false);
  }

  async function handleAdicionar(fornecedorGlobal) {
    setAdicionandoId(fornecedorGlobal.id);
    setError("");
    const { error: insertError } = await supabase.from("fornecedores").insert({
      condominio_id: condominioId,
      razao_social: fornecedorGlobal.razao_social,
      nome_fantasia: fornecedorGlobal.nome_fantasia || null,
      documento: fornecedorGlobal.cnpj ? formatarCnpj(fornecedorGlobal.cnpj) : null,
      tipo: "empresa",
      categoria: fornecedorGlobal.categoria || null,
      endereco: fornecedorGlobal.endereco || null,
      status: "ativo",
      fornecedor_global_id: fornecedorGlobal.id,
    });
    setAdicionandoId(null);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    onAdicionado?.();
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <h2 className="font-display text-lg font-bold text-navy-900">Rede de Fornecedores Vizinn</h2>
        <p className="mt-1 text-sm text-navy-500">
          Pesquise fornecedores já usados por outros condomínios do Vizinn, com reputação real
          baseada em avaliações — e adicione direto ao cadastro deste condomínio.
        </p>
        <form onSubmit={handleBuscar} className="mt-4 flex flex-wrap gap-3">
          <input
            className="input-field flex-1"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Nome ou CNPJ..."
          />
          <select className="input-field w-auto" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            <option value="">Todas as categorias</option>
            {CATEGORIAS_SUGERIDAS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <button type="submit" disabled={buscando} className="btn-primary">
            {buscando ? "Buscando..." : "Buscar"}
          </button>
        </form>
      </div>

      {error && <p className="text-sm text-coral-700">{error}</p>}

      {resultados && (
        resultados.length === 0 ? (
          <div className="card text-center text-navy-400">Nenhum fornecedor encontrado na rede com esses critérios.</div>
        ) : (
          <div className="space-y-3">
            {resultados.map((f) => {
              const jaAdicionado = meusFornecedoresGlobalIds?.has(f.id);
              return (
                <div key={f.id} className="card">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-navy-900">{f.razao_social}</h3>
                        {f.nome_fantasia && <span className="text-sm text-navy-500">({f.nome_fantasia})</span>}
                      </div>
                      <p className="mt-1 text-xs text-navy-400">
                        {[f.categoria, f.cnpj && formatarCnpj(f.cnpj)].filter(Boolean).join(" · ")}
                      </p>
                      {f.reputacao?.total_avaliacoes > 0 ? (
                        <p className="mt-1 text-xs text-navy-600">
                          ⭐ {f.reputacao.nota_media} · {f.reputacao.total_avaliacoes} avaliação
                          {f.reputacao.total_avaliacoes === 1 ? "" : "ões"} · usado por {f.reputacao.total_condominios}{" "}
                          condomínio{f.reputacao.total_condominios === 1 ? "" : "s"}
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-navy-400">Este fornecedor ainda não possui avaliações.</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleAdicionar(f)}
                      disabled={jaAdicionado || adicionandoId === f.id}
                      className="btn-secondary text-xs disabled:opacity-50"
                    >
                      {jaAdicionado ? "Já está nos seus fornecedores" : adicionandoId === f.id ? "Adicionando..." : "Adicionar aos meus fornecedores"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
