"use client";

import { useCallback, useEffect, useState } from "react";
import { authedFetch } from "@/lib/adminFetch";
import ValorPrivado from "@/components/ValorPrivado";
import { TIPO_COMISSAO_LABELS, STATUS_COMISSAO_LABELS, STATUS_COMISSAO_STYLES } from "@/lib/comissoes";

function formatBRL(v) {
  return (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Senha legível pra passar por voz/WhatsApp sem confundir (sem
// O/0/I/1, mesmo alfabeto do código de indicação).
function gerarSenhaLegivel() {
  const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let senha = "";
  for (let i = 0; i < 8; i++) senha += alfabeto[Math.floor(Math.random() * alfabeto.length)];
  return senha;
}

// Detalhamento do vendedor (seção 22/23 do projeto): dados, vendas,
// comissões por tipo, equipe direta e o painel de progresso de
// liderança do mês atual.
export default function AdminVendedorDetalheModal({ vendedorId, onClose, onChanged }) {
  const [detalhe, setDetalhe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [emancipando, setEmancipando] = useState(false);
  const [criandoAcesso, setCriandoAcesso] = useState(false);
  const [acessoMsg, setAcessoMsg] = useState("");
  const [mostrarFormSenha, setMostrarFormSenha] = useState(false);
  const [senha, setSenha] = useState("");
  const [senhaAplicada, setSenhaAplicada] = useState(null);
  const [excluindo, setExcluindo] = useState(false);
  const [alternandoAtivo, setAlternandoAtivo] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await authedFetch(`/api/admin/vendedores/${vendedorId}/detalhe`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao carregar vendedor.");
      setDetalhe(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [vendedorId]);

  useEffect(() => {
    load();
  }, [load]);

  function gerarSenha() {
    setSenha(gerarSenhaLegivel());
  }

  async function criarAcesso(e) {
    e.preventDefault();
    if (senha.length < 6) {
      setError("Informe uma senha de pelo menos 6 caracteres.");
      return;
    }
    setCriandoAcesso(true);
    setAcessoMsg("");
    setError("");
    try {
      const res = await authedFetch(`/api/admin/vendedores/${vendedorId}/criar-acesso`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senha }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao criar acesso.");
      setAcessoMsg(`Acesso liberado! Passe pro vendedor: e-mail ${detalhe.vendedor.email}, senha ${senha}`);
      setSenhaAplicada(senha);
      setMostrarFormSenha(false);
      setSenha("");
      await load();
      onChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setCriandoAcesso(false);
    }
  }

  async function alternarAtivo() {
    setAlternandoAtivo(true);
    setError("");
    try {
      const res = await authedFetch(`/api/admin/vendedores/${vendedorId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ativo: !detalhe.vendedor.ativo }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao atualizar.");
      await load();
      onChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setAlternandoAtivo(false);
    }
  }

  async function excluir() {
    if (!confirm(`Excluir "${detalhe.vendedor.nome}" de verdade? Isso só funciona se ele não tiver nenhuma venda ou comissão registrada. Não dá pra desfazer.`)) {
      return;
    }
    setExcluindo(true);
    setError("");
    try {
      const res = await authedFetch(`/api/admin/vendedores/${vendedorId}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao excluir.");
      onChanged?.();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setExcluindo(false);
    }
  }

  async function emancipar() {
    if (!confirm(`Emancipar "${detalhe.vendedor.nome}"? Ele deixa de ser vendedor direto do líder atual e vira líder independente. O histórico não é apagado.`)) {
      return;
    }
    setEmancipando(true);
    try {
      const res = await authedFetch(`/api/admin/vendedores/${vendedorId}/emancipar`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao emancipar.");
      await load();
      onChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setEmancipando(false);
    }
  }

  const codigo = detalhe?.vendedor?.codigo_indicacao;
  const origem = typeof window !== "undefined" ? window.location.origin : "https://vizinn.com.br";
  const linkConviteVendedor = codigo ? `${origem}/vendedor/convite/${codigo}` : null;
  const linkVenda = codigo ? `${origem}/?ref=${codigo}` : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-midnight/60 px-4 py-8 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6">
        <div className="flex items-start justify-between gap-4">
          <h2 className="font-display text-lg font-bold text-navy-900">Detalhes do vendedor</h2>
          <button onClick={onClose} className="text-navy-400 hover:text-navy-700" aria-label="Fechar">✕</button>
        </div>

        {error && <p className="mt-3 text-sm text-coral-700">{error}</p>}

        {loading ? (
          <p className="mt-4 text-navy-500">Carregando...</p>
        ) : !detalhe ? null : (
          <div className="mt-4 space-y-6">
            <div className="card">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold text-navy-900">{detalhe.vendedor.nome}</h3>
                {!detalhe.vendedor.ativo && <span className="rounded-full bg-navy-100 px-2 py-0.5 text-xs text-navy-400">Inativo</span>}
                {detalhe.vendedor.status_cadastro === "pendente" && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Cadastro pendente</span>
                )}
                {detalhe.vendedor.data_emancipacao && (
                  <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700">Líder independente</span>
                )}
              </div>
              <p className="mt-1 text-xs text-navy-400">
                {[detalhe.vendedor.email, detalhe.vendedor.telefone].filter(Boolean).join(" · ")}
              </p>
              <p className="mt-2 text-xs text-navy-500">
                Indicador original: <strong>{detalhe.vendedor.indicador_nome || "—"}</strong> · Líder atual:{" "}
                <strong>{detalhe.vendedor.lider_nome || "Independente"}</strong>
              </p>
              {linkVenda && (
                <p className="mt-2 text-xs text-navy-500">
                  Link de venda (vende condomínio, atribui venda própria a ele):{" "}
                  <code className="rounded bg-navy-50 px-1.5 py-0.5">{linkVenda}</code>{" "}
                  <button
                    type="button"
                    onClick={() => navigator.clipboard?.writeText(linkVenda)}
                    className="ml-1 font-semibold text-coral hover:underline"
                  >
                    Copiar
                  </button>
                </p>
              )}
              {linkConviteVendedor && (
                <p className="mt-1 text-xs text-navy-500">
                  Link de convite de vendedor (indica novo vendedor, gera 5% na 1ª venda dele):{" "}
                  <code className="rounded bg-navy-50 px-1.5 py-0.5">{linkConviteVendedor}</code>{" "}
                  <button
                    type="button"
                    onClick={() => navigator.clipboard?.writeText(linkConviteVendedor)}
                    className="ml-1 font-semibold text-coral hover:underline"
                  >
                    Copiar
                  </button>
                </p>
              )}

              <div className="mt-3 flex items-center gap-3">
                {detalhe.vendedor.user_id ? (
                  <>
                    <span className="text-xs font-medium text-emerald-700">✓ Acesso de vendedor liberado</span>
                    <button
                      onClick={() => { setMostrarFormSenha((v) => !v); setSenha(""); setAcessoMsg(""); }}
                      className="text-xs font-semibold text-navy-500 hover:underline"
                    >
                      Redefinir senha
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => { setMostrarFormSenha((v) => !v); setSenha(gerarSenhaLegivel()); setAcessoMsg(""); }}
                    disabled={!detalhe.vendedor.email}
                    className="text-xs font-semibold text-coral hover:underline disabled:opacity-50"
                  >
                    Criar acesso de vendedor
                  </button>
                )}
              </div>
              {!detalhe.vendedor.email && !detalhe.vendedor.user_id && (
                <p className="mt-1 text-xs text-coral-700">Cadastre um e-mail pra esse vendedor antes de criar o acesso.</p>
              )}
              {mostrarFormSenha && (
                <form onSubmit={criarAcesso} className="mt-2 flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    className="input-field w-48 text-sm"
                    placeholder="Senha (mín. 6 caracteres)"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    minLength={6}
                    required
                  />
                  <button type="button" onClick={gerarSenha} className="text-xs font-semibold text-navy-500 hover:underline">
                    Gerar
                  </button>
                  <button type="submit" disabled={criandoAcesso} className="btn-primary text-xs disabled:opacity-50">
                    {criandoAcesso ? "Salvando..." : "Confirmar"}
                  </button>
                </form>
              )}
              {acessoMsg && (
                <p className="mt-2 flex flex-wrap items-center gap-2 text-xs font-medium text-emerald-700">
                  {acessoMsg}
                  <button
                    type="button"
                    onClick={() => navigator.clipboard?.writeText(`${detalhe.vendedor.email} / ${senhaAplicada}`)}
                    className="font-semibold text-coral hover:underline"
                  >
                    Copiar e-mail e senha
                  </button>
                </p>
              )}

              <div className="mt-3 flex flex-wrap gap-4">
                {detalhe.vendedor.lider_atual_id && (
                  <button onClick={emancipar} disabled={emancipando} className="text-xs font-semibold text-coral hover:underline disabled:opacity-50">
                    {emancipando ? "Emancipando..." : "Emancipar (tornar líder independente)"}
                  </button>
                )}
                <button onClick={alternarAtivo} disabled={alternandoAtivo} className="text-xs font-semibold text-navy-500 hover:underline disabled:opacity-50">
                  {alternandoAtivo ? "Salvando..." : detalhe.vendedor.ativo ? "Desativar" : "Reativar"}
                </button>
                <button onClick={excluir} disabled={excluindo} className="text-xs font-semibold text-coral hover:underline disabled:opacity-50">
                  {excluindo ? "Excluindo..." : "Excluir vendedor"}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="card p-3">
                <p className="text-xs text-navy-400">Vendas</p>
                <p className="text-lg font-bold text-navy-900">{detalhe.vendas.quantidade}</p>
                <p className="text-xs text-navy-500">{detalhe.vendas.vendasDoMes} no mês atual</p>
              </div>
              <div className="card p-3">
                <p className="text-xs text-navy-400">Comissão total</p>
                <p className="text-lg font-bold text-navy-900"><ValorPrivado valor={formatBRL(detalhe.comissoes.total)} /></p>
                <p className="text-xs text-emerald-700">Pago: <ValorPrivado valor={formatBRL(detalhe.comissoes.pago)} /></p>
                <p className="text-xs text-amber-700">Pendente: <ValorPrivado valor={formatBRL(detalhe.comissoes.pendente)} /></p>
              </div>
              <div className="card p-3">
                <p className="text-xs text-navy-400">Por tipo</p>
                <p className="text-xs text-navy-600">Venda própria: <ValorPrivado valor={formatBRL(detalhe.comissoes.vendaPropria)} /></p>
                <p className="text-xs text-navy-600">Indicação: <ValorPrivado valor={formatBRL(detalhe.comissoes.indicacao)} /></p>
                <p className="text-xs text-navy-600">Liderança: <ValorPrivado valor={formatBRL(detalhe.comissoes.lideranca)} /></p>
              </div>
            </div>

            <div className="card">
              <h3 className="text-sm font-semibold text-navy-800">
                Painel de progresso — liderança ({detalhe.painelProgresso.competencia})
              </h3>
              <p className="mt-1 text-sm text-navy-600">
                Minhas vendas no mês: <strong>{detalhe.painelProgresso.minhasVendas}</strong> / {detalhe.painelProgresso.metaLider}
              </p>
              {detalhe.painelProgresso.totalDiretos > 0 ? (
                <>
                  <p className="text-sm text-navy-600">Equipe: <strong>{detalhe.painelProgresso.totalDiretos}</strong> vendedor(es)</p>
                  <p className="text-sm text-navy-600">Necessários com meta batida: <strong>{detalhe.painelProgresso.necessariosComMeta}</strong></p>
                  <p className="text-sm text-navy-600">Atualmente: <strong>{detalhe.painelProgresso.atualmenteComMeta}</strong></p>
                  <p className="text-sm text-navy-600">Restantes: <strong>{detalhe.painelProgresso.restantes}</strong></p>
                </>
              ) : (
                <p className="text-sm text-navy-400">Ainda não tem vendedores diretos.</p>
              )}
              <p className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                detalhe.painelProgresso.situacao?.qualificado ? "bg-emerald-100 text-emerald-700" : "bg-navy-100 text-navy-500"
              }`}>
                {detalhe.painelProgresso.situacao?.qualificado ? "QUALIFICADO" : "NÃO QUALIFICADO"}
              </p>
              {detalhe.painelProgresso.situacao?.motivo && (
                <p className="mt-1 text-xs text-navy-400">{detalhe.painelProgresso.situacao.motivo}</p>
              )}
            </div>

            <div className="card">
              <h3 className="text-sm font-semibold text-navy-800">Equipe direta ({detalhe.equipe.totalDiretos})</h3>
              <p className="mt-1 text-xs text-navy-500">
                {detalhe.equipe.comMeta} com meta batida · {detalhe.equipe.com1ou2} com 1-2 vendas · {detalhe.equipe.semVenda} sem venda
              </p>
              <ul className="mt-2 space-y-1">
                {detalhe.equipe.diretos.map((d) => (
                  <li key={d.id} className="flex items-center justify-between text-sm text-navy-600">
                    <span>{d.nome} {!d.ativo && <span className="text-xs text-navy-400">(inativo)</span>}</span>
                    <span className="text-xs font-semibold text-navy-500">{d.vendas_mes} venda(s) no mês</span>
                  </li>
                ))}
                {detalhe.equipe.diretos.length === 0 && <li className="text-sm text-navy-400">Nenhum vendedor direto.</li>}
              </ul>
            </div>

            <div className="card">
              <h3 className="text-sm font-semibold text-navy-800">Histórico de comissões</h3>
              <div className="mt-2 space-y-1">
                {detalhe.comissoes.historico.map((c) => (
                  <div key={c.id} className="flex items-center justify-between border-b border-navy-50 py-1.5 text-sm last:border-0">
                    <span className="text-navy-600">
                      {TIPO_COMISSAO_LABELS[c.tipo]} · {c.competencia} · {c.percentual}%
                    </span>
                    <span className="flex items-center gap-2">
                      <ValorPrivado valor={formatBRL(c.valor)} className="font-semibold text-navy-900" />
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COMISSAO_STYLES[c.status]}`}>
                        {STATUS_COMISSAO_LABELS[c.status]}
                      </span>
                    </span>
                  </div>
                ))}
                {detalhe.comissoes.historico.length === 0 && <p className="text-sm text-navy-400">Nenhuma comissão ainda.</p>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
