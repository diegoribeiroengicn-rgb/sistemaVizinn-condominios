"use client";

import CapturaFoto from "@/components/CapturaFoto";
import { DOCUMENTO_TIPO_LABELS, TIPO_PESSOA_LABELS } from "@/lib/pessoas";

const TIPO_LABELS = TIPO_PESSOA_LABELS;

// Extraído de app/dashboard/portaria/page.jsx (passava de 1000 linhas)
// sem mudar nenhuma lógica — toda a busca por documento/nome, validação
// e o próprio insert continuam no handleCreate da página; aqui só vive
// o JSX, recebendo estado e handlers por prop.
export default function RegistroEntradaForm({
  form,
  setForm,
  resetForm,
  emptyForm,
  onSubmit,
  submitting,
  unidadesDisponiveis,
  responsavelModoOutro,
  setResponsavelModoOutro,
  moradoresDaUnidade,
  buscando,
  buscaFeita,
  setBuscaFeita,
  pessoaEncontrada,
  setPessoaEncontrada,
  onBuscarDocumento,
  fotoPessoaUrl,
  onVerFotoAmpliada,
  candidatosNome,
  setCandidatosNome,
  onAplicarPessoaEncontrada,
  buscandoNome,
  onBuscarPorNome,
  onCapturarFotoNovoVisitante,
}) {
  return (
    <div className="card">
      <h2 className="font-display text-lg font-bold text-navy-900">Registrar entrada</h2>
      <form onSubmit={onSubmit} className="mt-4 space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label-field">Tipo de acesso</label>
            <select
              className="input-field"
              value={form.tipoAcesso}
              onChange={(e) => {
                resetForm();
                setForm((f) => ({ ...emptyForm, tipoAcesso: e.target.value }));
              }}
            >
              {Object.entries(TIPO_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-field">Unidade de destino</label>
            {unidadesDisponiveis.length > 0 ? (
              <select
                className="input-field"
                value={form.unidade}
                onChange={(e) => {
                  setResponsavelModoOutro(false);
                  setForm((f) => ({ ...f, unidade: e.target.value, responsavelNome: "" }));
                }}
              >
                <option value="">Selecione a unidade</option>
                {unidadesDisponiveis.map((u) => (
                  <option key={u.valor} value={u.valor}>
                    {u.rotulo}
                  </option>
                ))}
              </select>
            ) : (
              <>
                <input
                  className="input-field"
                  inputMode="numeric"
                  value={form.unidade}
                  onChange={(e) => setForm((f) => ({ ...f, unidade: e.target.value }))}
                  placeholder="Ex: Apto 32"
                />
                <p className="mt-1 text-xs text-navy-400">
                  Cadastre as unidades em Moradores pra esse campo virar uma lista.
                </p>
              </>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-navy-100 p-3">
          <p className="text-sm font-medium text-navy-800">
            Buscar pelo documento{form.tipoAcesso !== "morador" ? " (obrigatório)" : ""}
          </p>
          <p className="mt-0.5 text-xs text-navy-500">
            {form.tipoAcesso !== "morador"
              ? "É o que permite reconhecer essa pessoa da próxima vez — sem documento não dá pra registrar."
              : "Se a pessoa já tiver cadastro, os dados aparecem sozinhos — não precisa preencher tudo de novo."}
          </p>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[auto_1fr_auto]">
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
            <input
              className="input-field"
              inputMode={form.documentoTipo === "outro" ? "text" : "numeric"}
              value={form.documentoNumero}
              onChange={(e) => {
                setBuscaFeita(false);
                setPessoaEncontrada(null);
                setForm((f) => ({ ...f, documentoNumero: e.target.value }));
              }}
              placeholder="Número do documento"
              required={form.tipoAcesso !== "morador"}
              data-testid="portaria-documento"
            />
            <button
              type="button"
              onClick={onBuscarDocumento}
              disabled={buscando || !form.documentoNumero.trim()}
              className="btn-secondary disabled:opacity-50"
            >
              {buscando ? "Buscando..." : "Buscar"}
            </button>
          </div>

          {buscaFeita && pessoaEncontrada && (
            <div className="mt-3 flex items-center gap-3 rounded-lg bg-emerald-50 p-2 text-sm text-emerald-800">
              {fotoPessoaUrl && (
                <button
                  type="button"
                  onClick={() => onVerFotoAmpliada(fotoPessoaUrl)}
                  className="shrink-0"
                  title="Ver foto ampliada — confira se é a mesma pessoa"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={fotoPessoaUrl} alt="" className="h-10 w-10 rounded-full object-cover hover:opacity-80" />
                </button>
              )}
              <span>
                Encontrado: <strong>{pessoaEncontrada.nome}</strong>{" "}
                {pessoaEncontrada.origem === "morador"
                  ? `(morador, unidade ${pessoaEncontrada.unidade})`
                  : `(${TIPO_LABELS[pessoaEncontrada.tipo] || "visitante"} já cadastrado)`}
                {fotoPessoaUrl && (
                  <>
                    {" — "}
                    <button
                      type="button"
                      onClick={() => onVerFotoAmpliada(fotoPessoaUrl)}
                      className="font-semibold underline hover:text-emerald-900"
                    >
                      ver foto maior
                    </button>
                  </>
                )}
              </span>
            </div>
          )}
          {buscaFeita && !pessoaEncontrada && (
            <p className="mt-3 text-sm text-amber-700">
              Documento não encontrado. Preencha o cadastro simplificado abaixo.
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label-field">Nome da pessoa</label>
            <div className="flex gap-2">
              <input
                className="input-field"
                value={form.nomePessoa}
                onChange={(e) => {
                  setCandidatosNome([]);
                  setForm((f) => ({ ...f, nomePessoa: e.target.value }));
                }}
                disabled={Boolean(pessoaEncontrada)}
                required
                data-testid="portaria-nome"
              />
              {!pessoaEncontrada && (
                <button
                  type="button"
                  onClick={onBuscarPorNome}
                  disabled={buscandoNome || form.nomePessoa.trim().length < 3}
                  className="btn-secondary shrink-0 text-sm disabled:opacity-50"
                >
                  {buscandoNome ? "..." : "Já veio aqui?"}
                </button>
              )}
            </div>
            {candidatosNome.length > 0 && (
              <div className="mt-2 space-y-1 rounded-lg border border-navy-100 p-2">
                <p className="text-xs text-navy-500">Encontrei mais de uma pessoa — qual é?</p>
                {candidatosNome.map((c) => (
                  <button
                    key={`${c.origem}-${c.id}`}
                    type="button"
                    onClick={() => onAplicarPessoaEncontrada(c)}
                    className="block w-full rounded-lg px-2 py-1 text-left text-sm text-navy-700 hover:bg-navy-50"
                  >
                    <strong>{c.nome}</strong>{" "}
                    <span className="text-navy-400">
                      {c.origem === "morador" ? `(morador, unidade ${c.unidade})` : `(${TIPO_LABELS[c.tipo] || "visitante"})`}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="label-field">Responsável pela visita (opcional)</label>
            {moradoresDaUnidade.length > 0 && !responsavelModoOutro ? (
              <select
                className="input-field"
                value={form.responsavelNome}
                onChange={(e) => {
                  if (e.target.value === "__outro__") {
                    setResponsavelModoOutro(true);
                    setForm((f) => ({ ...f, responsavelNome: "" }));
                  } else {
                    setForm((f) => ({ ...f, responsavelNome: e.target.value }));
                  }
                }}
              >
                <option value="">Quem na unidade autorizou/recebeu</option>
                {moradoresDaUnidade.map((m) => (
                  <option key={m.id} value={m.nome}>
                    {m.nome}
                  </option>
                ))}
                <option value="__outro__">Outro (digitar nome)</option>
              </select>
            ) : (
              <div className="flex gap-2">
                <input
                  className="input-field"
                  value={form.responsavelNome}
                  onChange={(e) => setForm((f) => ({ ...f, responsavelNome: e.target.value }))}
                  placeholder="Quem na unidade autorizou/recebeu"
                />
                {moradoresDaUnidade.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setResponsavelModoOutro(false)}
                    className="shrink-0 text-xs font-semibold text-navy-500 hover:underline"
                  >
                    Voltar pra lista
                  </button>
                )}
              </div>
            )}
          </div>
          {form.tipoAcesso !== "morador" && !pessoaEncontrada && (
            <div className="sm:col-span-2">
              <label className="label-field">Foto (opcional)</label>
              <CapturaFoto onCapturar={onCapturarFotoNovoVisitante} />
            </div>
          )}
          <div>
            <label className="label-field">Forma de entrada</label>
            <select
              className="input-field"
              value={form.formaEntrada}
              onChange={(e) => setForm((f) => ({ ...f, formaEntrada: e.target.value }))}
            >
              <option value="a_pe">A pé</option>
              <option value="carro">De carro</option>
            </select>
          </div>
          {form.formaEntrada === "carro" && (
            <div>
              <label className="label-field">Placa do veículo</label>
              <input
                className="input-field uppercase"
                value={form.placaVeiculo}
                onChange={(e) => setForm((f) => ({ ...f, placaVeiculo: e.target.value }))}
                placeholder="ABC1D23"
                required
              />
            </div>
          )}
          <div className="sm:col-span-2">
            <label className="label-field">Observações (opcional)</label>
            <textarea
              className="input-field"
              rows={2}
              value={form.observacoes}
              onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
            />
          </div>
        </div>

        <button type="submit" disabled={submitting} className="btn-primary" data-testid="portaria-submit">
          {submitting ? "Registrando..." : "Registrar entrada"}
        </button>
      </form>
    </div>
  );
}
