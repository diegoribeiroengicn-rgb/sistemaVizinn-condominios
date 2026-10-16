"use client";

import SeletorCanalNotificacao from "@/components/SeletorCanalNotificacao";
import PreviaMensagem from "@/components/PreviaMensagem";
import { previaWhatsapp, previaEmail } from "@/lib/mensagemPreview";
import {
  CATEGORIA_SUGESTOES,
  PRIORIDADE_LABELS,
  PRIORIDADE_ORDER,
  TIPO_LABELS,
  sugerirDataPrevista,
} from "@/lib/chamados";

// Extraído de app/dashboard/chamados/page.jsx (mais de 1000 linhas) sem
// mudar nenhuma lógica — handleCreate e todo o restante continuam na
// página; aqui só vive o JSX do formulário "Novo chamado".
export default function NovoChamadoForm({
  form,
  setForm,
  onSubmit,
  submitting,
  isCondomino,
  podeEditar,
  responsaveis,
  cargaPorResponsavel,
  colaboradores,
  moradoresDisponiveis,
  distribuicaoAutomatica,
}) {
  return (
    <form onSubmit={onSubmit} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label className="label-field">Título</label>
        <input
          className="input-field"
          value={form.titulo}
          onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
          placeholder="Ex: Vazamento na garagem"
          required
        />
      </div>
      {!isCondomino && (
        <div>
          <label className="label-field">Tipo</label>
          <select
            className="input-field"
            value={form.tipo}
            onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}
          >
            <option value="condominio">{TIPO_LABELS.condominio}</option>
            <option value="interno">{TIPO_LABELS.interno}</option>
          </select>
        </div>
      )}
      <div>
        <label className="label-field">Prioridade</label>
        <select
          className="input-field"
          value={form.prioridade}
          onChange={(e) => setForm((f) => ({ ...f, prioridade: e.target.value }))}
        >
          {PRIORIDADE_ORDER.map((p) => (
            <option key={p} value={p}>
              {PRIORIDADE_LABELS[p]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label-field">Categoria (opcional)</label>
        <input
          className="input-field"
          list="categorias-sugeridas"
          value={form.categoria}
          onChange={(e) => {
            const categoria = e.target.value;
            setForm((f) => ({
              ...f,
              categoria,
              dataPrevista: f.dataPrevista || sugerirDataPrevista(categoria),
            }));
          }}
          placeholder="Ex: Hidráulica"
        />
        <datalist id="categorias-sugeridas">
          {CATEGORIA_SUGESTOES.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </div>
      {(isCondomino ? "condominio" : form.tipo) === "condominio" ? (
        <>
          <div>
            <label className="label-field">Unidade (opcional)</label>
            <input
              className="input-field"
              inputMode="numeric"
              value={form.unidade}
              onChange={(e) => setForm((f) => ({ ...f, unidade: e.target.value }))}
              placeholder="Ex: 32"
            />
          </div>
          <div>
            <label className="label-field">Bloco (opcional)</label>
            <input
              className="input-field"
              value={form.bloco}
              onChange={(e) => setForm((f) => ({ ...f, bloco: e.target.value }))}
              placeholder="Ex: B"
            />
          </div>
        </>
      ) : (
        <div>
          <label className="label-field">Local (opcional)</label>
          <input
            className="input-field"
            value={form.local}
            onChange={(e) => setForm((f) => ({ ...f, local: e.target.value }))}
            placeholder="Ex: Garagem, subsolo"
          />
        </div>
      )}
      <div>
        <label className="label-field">Data prevista (opcional)</label>
        <input
          type="date"
          className="input-field"
          value={form.dataPrevista}
          onChange={(e) => setForm((f) => ({ ...f, dataPrevista: e.target.value }))}
        />
      </div>
      {podeEditar && (
        <div>
          <label className="label-field">Responsável (opcional)</label>
          <select
            className="input-field"
            value={form.responsavel}
            onChange={(e) => setForm((f) => ({ ...f, responsavel: e.target.value }))}
          >
            <option value="">Sem responsável definido</option>
            {responsaveis.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
                {cargaPorResponsavel[r.userId] ? ` — ${cargaPorResponsavel[r.userId]} em aberto` : ""}
              </option>
            ))}
          </select>
        </div>
      )}
      {podeEditar && colaboradores.length > 0 && (
        <div>
          <label className="label-field">Colaborador responsável (opcional)</label>
          <select
            className="input-field"
            value={form.colaboradorId}
            onChange={(e) => setForm((f) => ({ ...f, colaboradorId: e.target.value }))}
          >
            <option value="">Sem colaborador vinculado</option>
            {colaboradores.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome} — {c.funcao}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="sm:col-span-2">
        <label className="label-field">Descrição (opcional)</label>
        <textarea
          className="input-field"
          rows={2}
          value={form.descricao}
          onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
        />
      </div>
      {!isCondomino && moradoresDisponiveis.length > 0 && (
        <div className="sm:col-span-2 rounded-lg border border-navy-100 p-3">
          <label className="label-field">Morador vinculado (opcional)</label>
          <select
            className="input-field"
            value={form.moradorId}
            onChange={(e) =>
              setForm((f) => ({ ...f, moradorId: e.target.value, notificarMorador: e.target.value ? true : f.notificarMorador }))
            }
          >
            <option value="">Nenhum morador vinculado</option>
            {moradoresDisponiveis.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome}
                {m.unidade ? ` — ${[m.bloco && `Bloco ${m.bloco}`, `Apto ${m.unidade}`].filter(Boolean).join(", ")}` : ""}
              </option>
            ))}
          </select>
          {form.moradorId && (
            <label className="mt-2 flex items-center gap-2 text-sm font-medium text-navy-700">
              <input
                type="checkbox"
                checked={form.notificarMorador}
                onChange={(e) => setForm((f) => ({ ...f, notificarMorador: e.target.checked }))}
              />
              Avisar esse morador
            </label>
          )}
          {form.moradorId && form.notificarMorador && (
            <SeletorCanalNotificacao
              name="canalMorador"
              value={form.canalMorador}
              onChange={(v) => setForm((f) => ({ ...f, canalMorador: v }))}
            />
          )}
          {form.moradorId && form.notificarMorador && (
            <PreviaMensagem
              whatsapp={previaWhatsapp("chamado_morador", { titulo_chamado: form.titulo })}
              email={previaEmail("chamado_morador", { titulo_chamado: form.titulo })}
            />
          )}
        </div>
      )}
      {distribuicaoAutomatica && !isCondomino && form.tipo === "condominio" && (
        <p className="sm:col-span-2 text-xs text-navy-500">
          Distribuição automática ativada: se você não escolher um colaborador, o sistema
          atribui a quem tem menos chamados em aberto agora.
        </p>
      )}
      {distribuicaoAutomatica && isCondomino && (
        <p className="sm:col-span-2 text-xs text-navy-500">
          Distribuição automática ativada: o sistema atribui a quem tem menos chamados em
          aberto agora.
        </p>
      )}
      <div className="sm:col-span-2">
        <button type="submit" disabled={submitting} className="btn-primary">
          {submitting ? "Criando..." : "Novo chamado"}
        </button>
      </div>
    </form>
  );
}
