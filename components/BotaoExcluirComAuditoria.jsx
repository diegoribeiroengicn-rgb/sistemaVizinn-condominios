"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

// Botão de excluir com motivo obrigatório, usado em Chamados,
// Ocorrências, Manutenção e Avisos. A exclusão em si já fica registrada
// sozinha na Auditoria pelo gatilho automático do banco
// (registrar_auditoria_generica, com uma cópia completa do registro
// apagado) — isto aqui só grava uma linha extra manual com o motivo
// digitado, ligada ao mesmo registro_id, antes de excluir de verdade.
// Só aparece pra quem tem a ação "excluir" no módulo (hoje, só o
// síndico — "excluir" está de propósito fora de ACOES_POR_MODULO pra
// Chamados/Ocorrências/Manutenção em lib/permissoes.js, então não tem
// como delegar pela tela de Acessos).
export default function BotaoExcluirComAuditoria({ tabela, modulo, registroId, descricao, onExcluido, className }) {
  const { user, condominio, temPermissao } = useAuth();
  const [confirmando, setConfirmando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [excluindo, setExcluindo] = useState(false);
  const [error, setError] = useState("");

  if (!temPermissao(modulo, "excluir")) return null;

  async function handleExcluir(e) {
    e.preventDefault();
    if (!motivo.trim()) {
      setError("Informe o motivo da exclusão.");
      return;
    }
    setExcluindo(true);
    setError("");
    try {
      const { error: auditError } = await supabase.from("auditoria").insert({
        condominio_id: condominio.id,
        usuario_id: user.id,
        usuario_nome: condominio.responsavel_nome || user.email,
        papel: "sindico",
        acao: "excluir_motivo",
        modulo,
        registro_id: registroId,
        dados_novos: { motivo: motivo.trim() },
      });
      if (auditError) throw new Error(auditError.message);

      const { error: delError } = await supabase.from(tabela).delete().eq("id", registroId);
      if (delError) throw new Error(delError.message);

      setConfirmando(false);
      setMotivo("");
      onExcluido?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setExcluindo(false);
    }
  }

  if (!confirmando) {
    return (
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        className={className || "text-xs font-semibold text-coral hover:underline"}
      >
        Excluir
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-midnight/60 px-4 py-8 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && setConfirmando(false)}
    >
      <div className="card w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-display text-lg font-bold text-navy-900">Excluir {descricao || "este registro"}?</h3>
        <p className="mt-1 text-sm text-navy-500">
          Essa ação não pode ser desfeita. Fica registrado em Auditoria quem excluiu, quando e o motivo.
        </p>
        <form onSubmit={handleExcluir} className="mt-4">
          <label className="label-field">Motivo da exclusão</label>
          <textarea
            className="input-field"
            rows={2}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            required
            autoFocus
          />
          {error && <p className="mt-2 text-sm text-coral-700">{error}</p>}
          <div className="mt-4 flex gap-3">
            <button type="submit" disabled={excluindo} className="btn-primary text-sm disabled:opacity-50">
              {excluindo ? "Excluindo..." : "Confirmar exclusão"}
            </button>
            <button type="button" onClick={() => setConfirmando(false)} className="btn-secondary text-sm">
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
