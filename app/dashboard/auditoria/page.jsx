"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import ModuloGuard from "@/components/ModuloGuard";
import { MODULO_LABELS } from "@/lib/permissoes";
import { formatarDataHoraBR, dataBrasiliaYMD } from "@/lib/datetime";

const ACAO_LABELS = {
  login: "Login",
  criar: "Criou",
  editar: "Editou",
  excluir: "Excluiu",
  aprovar: "Aprovou",
  rejeitar: "Rejeitou",
};

const emptyFiltro = { usuario: "", modulo: "", acao: "", data: "" };

function formatarJson(valor) {
  if (!valor) return null;
  try {
    return JSON.stringify(valor, null, 2);
  } catch {
    return String(valor);
  }
}

export default function AuditoriaPage() {
  const { condominio } = useAuth();
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [temMaisRegistros, setTemMaisRegistros] = useState(false);
  const [error, setError] = useState("");
  const [filtro, setFiltro] = useState(emptyFiltro);
  const [abertoId, setAbertoId] = useState(null);

  // Toda alteração relevante no sistema cai aqui via trigger — é a
  // tabela que mais cresce. Antes buscava até 500 linhas de uma vez e
  // parava ali sem aviso (registro mais antigo ficava invisível pra
  // sempre); agora pagina de verdade com "Carregar mais".
  const PAGINA_TAMANHO = 100;

  const load = useCallback(async () => {
    if (!condominio?.id) return;
    setLoading(true);
    setError("");
    const { data, error: fetchError } = await supabase
      .from("auditoria")
      .select("*")
      .eq("condominio_id", condominio.id)
      .order("created_at", { ascending: false })
      .range(0, PAGINA_TAMANHO - 1);
    if (fetchError) setError(fetchError.message);
    else {
      setRegistros(data || []);
      setTemMaisRegistros((data || []).length === PAGINA_TAMANHO);
    }
    setLoading(false);
  }, [condominio?.id]);

  const carregarMaisRegistros = useCallback(async () => {
    if (!condominio?.id) return;
    setCarregandoMais(true);
    const { data, error: fetchError } = await supabase
      .from("auditoria")
      .select("*")
      .eq("condominio_id", condominio.id)
      .order("created_at", { ascending: false })
      .range(registros.length, registros.length + PAGINA_TAMANHO - 1);
    if (fetchError) setError(fetchError.message);
    else {
      setRegistros((atual) => [...atual, ...(data || [])]);
      setTemMaisRegistros((data || []).length === PAGINA_TAMANHO);
    }
    setCarregandoMais(false);
  }, [condominio?.id, registros.length]);

  useEffect(() => {
    load();
  }, [load]);

  const modulosPresentes = useMemo(
    () => Array.from(new Set(registros.map((r) => r.modulo))).sort(),
    [registros]
  );

  const registrosFiltrados = useMemo(() => {
    return registros.filter((r) => {
      if (filtro.usuario && !(r.usuario_nome || "").toLowerCase().includes(filtro.usuario.toLowerCase()))
        return false;
      if (filtro.modulo && r.modulo !== filtro.modulo) return false;
      if (filtro.acao && r.acao !== filtro.acao) return false;
      if (filtro.data && dataBrasiliaYMD(r.created_at) !== filtro.data) return false;
      return true;
    });
  }, [registros, filtro]);

  if (!condominio) {
    return <p className="text-navy-500">Carregando condomínio...</p>;
  }

  return (
    <ModuloGuard modulo="auditoria">
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-bold text-navy-900">Auditoria</h1>
        <p className="mt-1 text-sm text-navy-500">
          Registro de logins e alterações relevantes no sistema — quem fez, o quê, quando.
        </p>
      </div>

      <div className="card">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <input
            className="input-field"
            placeholder="Usuário"
            value={filtro.usuario}
            onChange={(e) => setFiltro((f) => ({ ...f, usuario: e.target.value }))}
          />
          <select
            className="input-field"
            value={filtro.modulo}
            onChange={(e) => setFiltro((f) => ({ ...f, modulo: e.target.value }))}
          >
            <option value="">Todos os módulos</option>
            {modulosPresentes.map((m) => (
              <option key={m} value={m}>
                {MODULO_LABELS[m] || m}
              </option>
            ))}
          </select>
          <select
            className="input-field"
            value={filtro.acao}
            onChange={(e) => setFiltro((f) => ({ ...f, acao: e.target.value }))}
          >
            <option value="">Todas as ações</option>
            {Object.entries(ACAO_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <input
            type="date"
            className="input-field"
            value={filtro.data}
            onChange={(e) => setFiltro((f) => ({ ...f, data: e.target.value }))}
          />
        </div>

        {error && <p className="mt-3 text-sm text-coral-700">{error}</p>}

        {loading ? (
          <p className="mt-4 text-navy-500">Carregando auditoria...</p>
        ) : registrosFiltrados.length === 0 ? (
          <div className="mt-4 text-center text-navy-400">Nenhum registro encontrado.</div>
        ) : (
          <div className="mt-4 space-y-2">
            {registrosFiltrados.map((r) => {
              const aberto = abertoId === r.id;
              const temDetalhe = r.dados_anteriores || r.dados_novos;
              return (
                <div key={r.id} className="rounded-xl border border-navy-100 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm">
                      <span className="font-semibold text-navy-900">{r.usuario_nome || "—"}</span>
                      <span className="text-navy-500"> ({r.papel || "?"}) </span>
                      <span className="font-medium text-coral-700">
                        {ACAO_LABELS[r.acao] || r.acao}
                      </span>{" "}
                      <span className="text-navy-600">{MODULO_LABELS[r.modulo] || r.modulo}</span>
                    </div>
                    <span className="text-xs text-navy-400">{formatarDataHoraBR(r.created_at)}</span>
                  </div>
                  {temDetalhe && (
                    <button
                      onClick={() => setAbertoId(aberto ? null : r.id)}
                      className="mt-1 text-xs font-semibold text-navy-500 hover:underline"
                    >
                      {aberto ? "Ocultar detalhes" : "Ver detalhes"}
                    </button>
                  )}
                  {aberto && temDetalhe && (
                    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {r.dados_anteriores && (
                        <div>
                          <p className="text-xs font-semibold text-navy-500">Antes</p>
                          <pre className="mt-1 max-h-48 overflow-auto rounded-lg bg-navy-50 p-2 text-xs text-navy-700">
                            {formatarJson(r.dados_anteriores)}
                          </pre>
                        </div>
                      )}
                      {r.dados_novos && (
                        <div>
                          <p className="text-xs font-semibold text-navy-500">Depois</p>
                          <pre className="mt-1 max-h-48 overflow-auto rounded-lg bg-navy-50 p-2 text-xs text-navy-700">
                            {formatarJson(r.dados_novos)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {temMaisRegistros && (
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={carregarMaisRegistros}
              disabled={carregandoMais}
              className="btn-secondary text-sm disabled:opacity-50"
            >
              {carregandoMais ? "Carregando..." : "Carregar mais"}
            </button>
            <p className="mt-1 text-xs text-navy-400">
              Mostrando os {registros.length} mais recentes — os filtros acima procuram só entre eles.
            </p>
          </div>
        )}
      </div>
    </div>
    </ModuloGuard>
  );
}
