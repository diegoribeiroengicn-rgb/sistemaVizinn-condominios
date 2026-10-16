"use client";

import { CATEGORIAS_DESPESA, FORMAS_PAGAMENTO, STATUS_PAGAR_LABELS, STATUS_PAGAR_ORDER } from "@/lib/financeiro";

// Extraído de app/dashboard/financeiro/page.jsx (que passava de 1300
// linhas) sem mudar nenhuma lógica — só move o JSX pra fora, form e
// handlers continuam vivendo na página, passados por prop.
export default function ContaPagarForm({
  form,
  setForm,
  onSubmit,
  submitting,
  enviandoArquivo,
  fornecedores,
  manutencoes,
  chamados,
  onArquivoChange,
}) {
  return (
    <div className="card">
      <h2 className="font-display text-lg font-bold text-navy-900">Nova conta a pagar</h2>
      <form onSubmit={onSubmit} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label-field">Descrição</label>
          <input
            className="input-field"
            value={form.descricao}
            onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
            required
            data-testid="financeiro-descricao"
          />
        </div>
        <div>
          <label className="label-field">Categoria (opcional)</label>
          <input
            className="input-field"
            list="categorias-despesa"
            value={form.categoria}
            onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value }))}
          />
          <datalist id="categorias-despesa">
            {CATEGORIAS_DESPESA.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        {fornecedores.length > 0 && (
          <div>
            <label className="label-field">Fornecedor (opcional)</label>
            <select
              className="input-field"
              value={form.fornecedorId}
              onChange={(e) => setForm((f) => ({ ...f, fornecedorId: e.target.value }))}
            >
              <option value="">Sem fornecedor</option>
              {fornecedores.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.razao_social}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="label-field">Nº do documento (opcional)</label>
          <input
            className="input-field"
            value={form.documentoNumero}
            onChange={(e) => setForm((f) => ({ ...f, documentoNumero: e.target.value }))}
          />
        </div>
        {manutencoes.length > 0 && (
          <div>
            <label className="label-field">Manutenção vinculada (opcional)</label>
            <select
              className="input-field"
              value={form.manutencaoId}
              onChange={(e) => setForm((f) => ({ ...f, manutencaoId: e.target.value }))}
            >
              <option value="">Sem manutenção vinculada</option>
              {manutencoes.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.titulo}
                </option>
              ))}
            </select>
          </div>
        )}
        {chamados.length > 0 && (
          <div>
            <label className="label-field">Chamado vinculado (opcional)</label>
            <select
              className="input-field"
              value={form.chamadoId}
              onChange={(e) => setForm((f) => ({ ...f, chamadoId: e.target.value }))}
            >
              <option value="">Sem chamado vinculado</option>
              {chamados.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.titulo}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="sm:col-span-2">
          <label className="label-field">Nota fiscal / documento (opcional)</label>
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            className="input-field"
            onChange={(e) => onArquivoChange(e.target.files?.[0] || null)}
          />
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
            data-testid="financeiro-valor"
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
          <label className="label-field">Pagamento (opcional)</label>
          <input
            type="date"
            className="input-field"
            value={form.dataPagamento}
            onChange={(e) => setForm((f) => ({ ...f, dataPagamento: e.target.value }))}
          />
        </div>
        <div>
          <label className="label-field">Forma de pagamento (opcional)</label>
          <input
            className="input-field"
            list="formas-pagamento"
            value={form.formaPagamento}
            onChange={(e) => setForm((f) => ({ ...f, formaPagamento: e.target.value }))}
          />
          <datalist id="formas-pagamento">
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
            {STATUS_PAGAR_ORDER.map((s) => (
              <option key={s} value={s}>
                {STATUS_PAGAR_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label-field">Parcela (opcional)</label>
          <input
            type="number"
            className="input-field"
            value={form.parcela}
            onChange={(e) => setForm((f) => ({ ...f, parcela: e.target.value }))}
            placeholder="Ex: 1"
          />
        </div>
        <div>
          <label className="label-field">De quantas parcelas (opcional)</label>
          <input
            type="number"
            className="input-field"
            value={form.qtdParcelas}
            onChange={(e) => setForm((f) => ({ ...f, qtdParcelas: e.target.value }))}
            placeholder="Ex: 3"
          />
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
          <button type="submit" disabled={submitting} className="btn-primary" data-testid="financeiro-submit">
            {enviandoArquivo ? "Enviando documento..." : submitting ? "Salvando..." : "Registrar conta a pagar"}
          </button>
        </div>
      </form>
    </div>
  );
}
