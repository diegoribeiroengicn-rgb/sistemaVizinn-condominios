"use client";

import CapturaFoto from "@/components/CapturaFoto";
import { DOCUMENTO_TIPO_LABELS } from "@/lib/pessoas";

// Extraído de app/dashboard/moradores/page.jsx (quase 1000 linhas) sem
// mudar lógica nenhuma — form, submit e reset continuam na página.
export default function MoradorForm({
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
        {editingId ? "Editar morador" : "Cadastrar manualmente"}
      </h2>
      <form onSubmit={onSubmit} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="label-field">Unidade</label>
          <input
            className="input-field"
            inputMode="numeric"
            value={form.unidade}
            onChange={(e) => setForm((f) => ({ ...f, unidade: e.target.value }))}
            placeholder="Ex: 101"
            required
            data-testid="morador-unidade"
          />
        </div>
        <div>
          <label className="label-field">Bloco (opcional)</label>
          <input
            className="input-field"
            value={form.bloco}
            onChange={(e) => setForm((f) => ({ ...f, bloco: e.target.value }))}
            placeholder="Ex: A"
          />
        </div>
        <div>
          <label className="label-field">Nome completo</label>
          <input
            className="input-field"
            value={form.nome}
            onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
            required
            data-testid="morador-nome"
          />
        </div>
        <div>
          <label className="label-field">Telefone / WhatsApp (opcional)</label>
          <input
            className="input-field"
            inputMode="numeric"
            value={form.telefone}
            onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))}
            placeholder="Ex: 11999998888"
          />
        </div>
        <div>
          <label className="label-field">E-mail (opcional)</label>
          <input
            type="email"
            className="input-field"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
        </div>
        <div>
          <label className="label-field">Tipo de documento (opcional)</label>
          <select
            className="input-field"
            value={form.documentoTipo}
            onChange={(e) => setForm((f) => ({ ...f, documentoTipo: e.target.value }))}
          >
            <option value="">Não informar</option>
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
            placeholder="Usado pela portaria pra reconhecer essa pessoa"
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
          <button type="submit" disabled={submitting} className="btn-primary" data-testid="morador-submit">
            {enviandoFoto ? "Enviando foto..." : submitting ? "Salvando..." : editingId ? "Salvar alterações" : "Cadastrar morador"}
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
