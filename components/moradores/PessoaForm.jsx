"use client";

import CapturaFoto from "@/components/CapturaFoto";
import { DOCUMENTO_TIPO_LABELS, TIPO_VISITANTE_LABELS } from "@/lib/pessoas";

// Extraído de app/dashboard/moradores/page.jsx, mesmo padrão do
// MoradorForm vizinho — cadastro de visitante/prestador avulso.
export default function PessoaForm({
  form,
  setForm,
  onSubmit,
  editingId,
  submitting,
  enviandoFoto,
  onCapturarFoto,
  onCancelarEdicao,
}) {
  return (
    <div className="card">
      <h2 className="font-display text-lg font-bold text-navy-900">
        {editingId ? "Editar cadastro" : "Cadastrar manualmente"}
      </h2>
      <p className="mt-1 text-sm text-navy-500">
        O mesmo cadastro que a Portaria cria sozinha quando busca por documento e não acha
        ninguém — aqui dá pra criar, corrigir ou desativar direto.
      </p>
      <form onSubmit={onSubmit} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="label-field">Nome completo</label>
          <input
            className="input-field"
            value={form.nome}
            onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
            required
          />
        </div>
        <div>
          <label className="label-field">Tipo</label>
          <select
            className="input-field"
            value={form.tipo}
            onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}
          >
            {Object.entries(TIPO_VISITANTE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label-field">Telefone (opcional)</label>
          <input
            className="input-field"
            inputMode="numeric"
            value={form.telefone}
            onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))}
          />
        </div>
        <div>
          <label className="label-field">Tipo de documento (opcional)</label>
          <select
            className="input-field"
            value={form.documentoTipo}
            onChange={(e) => setForm((f) => ({ ...f, documentoTipo: e.target.value }))}
          >
            {Object.entries(DOCUMENTO_TIPO_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label-field">Número do documento (opcional)</label>
          <input
            className="input-field"
            inputMode={form.documentoTipo === "outro" ? "text" : "numeric"}
            value={form.documentoNumero}
            onChange={(e) => setForm((f) => ({ ...f, documentoNumero: e.target.value }))}
            placeholder="Usado pra reconhecer da próxima vez"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="label-field">Foto (opcional)</label>
          <CapturaFoto onCapturar={onCapturarFoto} fotoAtualNome={editingId ? "foto atual" : null} />
        </div>
        <div className="sm:col-span-2">
          <label className="label-field">Observações (opcional)</label>
          <textarea
            className="input-field"
            rows={2}
            value={form.observacoes}
            onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
          />
        </div>

        <div className="sm:col-span-2 flex gap-3">
          <button type="submit" disabled={submitting} className="btn-primary">
            {enviandoFoto
              ? "Enviando foto..."
              : submitting
                ? "Salvando..."
                : editingId
                  ? "Salvar alterações"
                  : "Cadastrar"}
          </button>
          {editingId && (
            <button type="button" onClick={onCancelarEdicao} className="text-sm font-semibold text-navy-500 hover:underline">
              Cancelar edição
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
