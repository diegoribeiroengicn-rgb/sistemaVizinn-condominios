"use client";

import { CATEGORIAS_RECEITA, FORMAS_PAGAMENTO, STATUS_RECEBER_LABELS, STATUS_RECEBER_ORDER } from "@/lib/financeiro";

// Extraído de app/dashboard/financeiro/page.jsx, mesmo padrão do
// ContaPagarForm vizinho — só move o JSX, form e handler continuam na
// página, passados por prop.
export default function ContaReceberForm({ form, setForm, onSubmit, submitting }) {
  return (
    <div className="card">
      <h2 className="font-display text-lg font-bold text-navy-900">Nova conta a receber</h2>
      <form onSubmit={onSubmit} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label-field">Descrição</label>
          <input
            className="input-field"
            value={form.descricao}
            onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
            required
          />
        </div>
        <div>
          <label className="label-field">Unidade (opcional)</label>
          <input
            className="input-field"
            inputMode="numeric"
            value={form.unidade}
            onChange={(e) => setForm((f) => ({ ...f, unidade: e.target.value }))}
          />
        </div>
        <div>
          <label className="label-field">Morador/responsável (opcional)</label>
          <input
            className="input-field"
            value={form.responsavelFinanceiro}
            onChange={(e) => setForm((f) => ({ ...f, responsavelFinanceiro: e.target.value }))}
          />
        </div>
        <div>
          <label className="label-field">Categoria (opcional)</label>
          <input
            className="input-field"
            list="categorias-receita"
            value={form.categoria}
            onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value }))}
          />
          <datalist id="categorias-receita">
            {CATEGORIAS_RECEITA.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="label-field">Valor</label>
          <input
            type="number"
            step="0.01"
            className="input-field"
            value={form.valor}
            onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))}
            required
          />
        </div>
        <div>
          <label className="label-field">Competência (opcional)</label>
          <input
            type="date"
            className="input-field"
            value={form.dataCompetencia}
            onChange={(e) => setForm((f) => ({ ...f, dataCompetencia: e.target.value }))}
          />
        </div>
        <div>
          <label className="label-field">Vencimento (opcional)</label>
          <input
            type="date"
            className="input-field"
            value={form.dataVencimento}
            onChange={(e) => setForm((f) => ({ ...f, dataVencimento: e.target.value }))}
          />
        </div>
        <div>
          <label className="label-field">Recebimento (opcional)</label>
          <input
            type="date"
            className="input-field"
            value={form.dataRecebimento}
            onChange={(e) => setForm((f) => ({ ...f, dataRecebimento: e.target.value }))}
          />
        </div>
        <div>
          <label className="label-field">Valor recebido (opcional)</label>
          <input
            type="number"
            step="0.01"
            className="input-field"
            value={form.valorRecebido}
            onChange={(e) => setForm((f) => ({ ...f, valorRecebido: e.target.value }))}
          />
        </div>
        <div>
          <label className="label-field">Desconto (opcional)</label>
          <input
            type="number"
            step="0.01"
            className="input-field"
            value={form.desconto}
            onChange={(e) => setForm((f) => ({ ...f, desconto: e.target.value }))}
          />
        </div>
        <div>
          <label className="label-field">Juros/multa (opcional)</label>
          <input
            type="number"
            step="0.01"
            className="input-field"
            value={form.jurosMulta}
            onChange={(e) => setForm((f) => ({ ...f, jurosMulta: e.target.value }))}
          />
        </div>
        <div>
          <label className="label-field">Forma de pagamento (opcional)</label>
          <input
            className="input-field"
            list="formas-pagamento-receber"
            value={form.formaPagamento}
            onChange={(e) => setForm((f) => ({ ...f, formaPagamento: e.target.value }))}
          />
          <datalist id="formas-pagamento-receber">
            {FORMAS_PAGAMENTO.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="label-field">Status</label>
          <select
            className="input-field"
            value={form.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
          >
            {STATUS_RECEBER_ORDER.map((s) => (
              <option key={s} value={s}>
                {STATUS_RECEBER_LABELS[s]}
              </option>
            ))}
          </select>
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
        <div className="sm:col-span-2">
          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting ? "Salvando..." : "Registrar conta a receber"}
          </button>
        </div>
      </form>
    </div>
  );
}
