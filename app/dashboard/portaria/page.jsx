"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import ModuloGuard from "@/components/ModuloGuard";
import CapturaFoto from "@/components/CapturaFoto";
import { useAvisoSaidaSemSalvar } from "@/hooks/useAvisoSaidaSemSalvar";
import {
  DOCUMENTO_TIPO_LABELS,
  TIPO_PESSOA_LABELS,
  buscarPessoaPorDocumento,
  buscarPessoasPorNome,
  mascararDocumento,
  obterUrlFotoAssinada,
  enviarFotoPessoa,
} from "@/lib/pessoas";
import {
  formatarDataHoraBR,
  dataBrasiliaYMD,
  paraDatetimeLocalBrasilia,
  datetimeLocalBrasiliaParaISO,
} from "@/lib/datetime";

const TIPO_LABELS = TIPO_PESSOA_LABELS;

const emptyForm = {
  tipoAcesso: "visitante",
  documentoTipo: "cpf",
  documentoNumero: "",
  nomePessoa: "",
  telefonePessoa: "",
  unidade: "",
  responsavelNome: "",
  formaEntrada: "a_pe",
  placaVeiculo: "",
  observacoes: "",
  lancamentoManual: false,
  entradaManualLocal: "",
  justificativaManual: "",
};

const emptyFiltro = {
  pessoa: "",
  unidade: "",
  placa: "",
  documento: "",
  tipo: "",
  status: "",
  data: "",
};

const emptyCorrecao = { entradaLocal: "", saidaLocal: "", justificativa: "" };

export default function PortariaPage() {
  const { condominio, user, member, temPermissao, role } = useAuth();
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(emptyForm);
  useAvisoSaidaSemSalvar(form, emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [saindoId, setSaindoId] = useState(null);
  const [filtro, setFiltro] = useState(emptyFiltro);

  const [buscando, setBuscando] = useState(false);
  const [buscaFeita, setBuscaFeita] = useState(false);
  const [pessoaEncontrada, setPessoaEncontrada] = useState(null);
  const [fotoPessoaUrl, setFotoPessoaUrl] = useState(null);
  const [buscandoNome, setBuscandoNome] = useState(false);
  const [candidatosNome, setCandidatosNome] = useState([]);

  const [corrigindoId, setCorrigindoId] = useState(null);
  const [correcaoForm, setCorrecaoForm] = useState(emptyCorrecao);
  const [salvandoCorrecao, setSalvandoCorrecao] = useState(false);
  const [abrindoFotoId, setAbrindoFotoId] = useState(null);
  const [fotoNovoVisitante, setFotoNovoVisitante] = useState(null);
  const [enviandoFoto, setEnviandoFoto] = useState(false);

  const podeCriar = temPermissao("portaria", "criar");
  const podeEditar = temPermissao("portaria", "editar");
  const podeCorrigir = temPermissao("portaria", "corrigir") || role === "sindico";
  const registradoPor = member?.nome || user?.user_metadata?.full_name || user?.email || "Síndico";

  const load = useCallback(async () => {
    if (!condominio?.id) return;
    setLoading(true);
    setError("");
    const { data, error: fetchError } = await supabase
      .from("portaria_registros")
      .select("*")
      .eq("condominio_id", condominio.id)
      .order("entrada_em", { ascending: false });
    if (fetchError) setError(fetchError.message);
    else setRegistros(data || []);
    setLoading(false);
  }, [condominio?.id]);

  useEffect(() => {
    load();
  }, [load]);

  function resetForm() {
    setForm(emptyForm);
    setBuscaFeita(false);
    setPessoaEncontrada(null);
    setFotoPessoaUrl(null);
    setFotoNovoVisitante(null);
    setCandidatosNome([]);
  }

  // Preenche o formulário sozinho a partir de uma pessoa já encontrada
  // (por documento ou por nome) — usado nos dois fluxos de busca abaixo.
  async function aplicarPessoaEncontrada(encontrada) {
    setPessoaEncontrada(encontrada);
    setCandidatosNome([]);
    setFotoPessoaUrl(null);
    if (!encontrada) return;
    setForm((f) => ({
      ...f,
      nomePessoa: encontrada.nome,
      telefonePessoa: encontrada.telefone || "",
      documentoTipo: encontrada.documento_tipo || f.documentoTipo,
      documentoNumero: encontrada.documento_numero || "",
      tipoAcesso: encontrada.origem === "morador" ? "morador" : encontrada.tipo || "visitante",
    }));
    if (encontrada.foto_path) {
      const url = await obterUrlFotoAssinada(encontrada.foto_path);
      setFotoPessoaUrl(url);
    }
  }

  // Busca a pessoa (morador OU visitante, nas duas bases) pelo documento —
  // se já existe, recupera os dados dela em vez de pedir cadastro de novo.
  async function handleBuscarDocumento() {
    if (!condominio?.id || !form.documentoNumero.trim()) return;
    setBuscando(true);
    setError("");
    const encontrada = await buscarPessoaPorDocumento(condominio.id, form.documentoTipo, form.documentoNumero.trim());
    await aplicarPessoaEncontrada(encontrada);
    setBuscaFeita(true);
    setBuscando(false);
    if (!encontrada) setForm((f) => ({ ...f, nomePessoa: "", telefonePessoa: "" }));
  }

  // Alternativa pra quando não tem o documento em mãos: busca por nome
  // (parcial) nas duas bases. Se achar mais de uma pessoa parecida,
  // mostra os candidatos pra escolher — nunca presume qual é.
  async function handleBuscarPorNome() {
    if (!condominio?.id || !form.nomePessoa.trim()) return;
    setBuscandoNome(true);
    setError("");
    const candidatos = await buscarPessoasPorNome(condominio.id, form.nomePessoa.trim());
    setBuscandoNome(false);
    if (candidatos.length === 1) {
      await aplicarPessoaEncontrada(candidatos[0]);
      setBuscaFeita(true);
    } else if (candidatos.length > 1) {
      setCandidatosNome(candidatos);
      setPessoaEncontrada(null);
    } else {
      setCandidatosNome([]);
      setError("Ninguém com esse nome encontrado. Pode preencher o cadastro simplificado normalmente.");
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!condominio?.id) return;
    if (!form.nomePessoa.trim()) {
      setError("Informe o nome da pessoa (ou busque pelo documento).");
      return;
    }
    if (form.formaEntrada === "carro" && !form.placaVeiculo.trim()) {
      setError("Informe a placa do veículo.");
      return;
    }
    if (form.lancamentoManual && (!form.entradaManualLocal || !form.justificativaManual.trim())) {
      setError("Lançamento manual exige o horário de entrada e a justificativa.");
      return;
    }

    setSubmitting(true);
    setError("");

    let visitanteId = null;
    let moradorId = null;
    let documentoNumero = null;

    if (pessoaEncontrada) {
      documentoNumero = pessoaEncontrada.documento_numero || null;
      if (pessoaEncontrada.origem === "morador") moradorId = pessoaEncontrada.id;
      else visitanteId = pessoaEncontrada.id;
    } else if (form.tipoAcesso !== "morador" && (form.documentoNumero.trim() || fotoNovoVisitante)) {
      // Documento informado (ou pelo menos uma foto tirada) mas pessoa não
      // encontrada: cadastro simplificado — visitante, entregador,
      // prestador de serviço ou outro, pra reconhecer da próxima vez.
      let fotoPath = null;
      if (fotoNovoVisitante) {
        setEnviandoFoto(true);
        try {
          fotoPath = await enviarFotoPessoa(condominio.id, "visitantes", fotoNovoVisitante);
        } catch (uploadError) {
          setSubmitting(false);
          setEnviandoFoto(false);
          setError(`Erro ao enviar a foto: ${uploadError.message}`);
          return;
        }
        setEnviandoFoto(false);
      }
      const { data: novaPessoa, error: pessoaError } = await supabase
        .from("visitantes")
        .insert({
          condominio_id: condominio.id,
          nome: form.nomePessoa.trim(),
          tipo: form.tipoAcesso,
          documento_tipo: form.documentoNumero.trim() ? form.documentoTipo : null,
          documento_numero: form.documentoNumero.trim() || null,
          telefone: form.telefonePessoa.trim() || null,
          foto_path: fotoPath,
          criado_por_id: user?.id || null,
        })
        .select("id, documento_numero")
        .single();
      if (pessoaError) {
        setSubmitting(false);
        setError(`Erro ao cadastrar pessoa: ${pessoaError.message}`);
        return;
      }
      visitanteId = novaPessoa.id;
      documentoNumero = novaPessoa.documento_numero;
    }

    // Placa de carro já cadastrado em Veículos (se bater, só linka — não
    // obriga nada; placa de visitante sem cadastro continua indo como
    // texto livre, igual já funcionava).
    let veiculoId = null;
    if (form.formaEntrada === "carro" && form.placaVeiculo.trim()) {
      const { data: veiculoEncontrado } = await supabase
        .from("veiculos")
        .select("id")
        .eq("condominio_id", condominio.id)
        .eq("placa", form.placaVeiculo.trim().toUpperCase())
        .maybeSingle();
      if (veiculoEncontrado) veiculoId = veiculoEncontrado.id;
    }

    const payload = {
      condominio_id: condominio.id,
      nome_pessoa: form.nomePessoa.trim(),
      tipo_acesso: form.tipoAcesso,
      unidade: form.unidade.trim() || null,
      responsavel_nome: form.responsavelNome.trim() || null,
      forma_entrada: form.formaEntrada,
      placa_veiculo: form.formaEntrada === "carro" ? form.placaVeiculo.trim().toUpperCase() : null,
      observacoes: form.observacoes.trim() || null,
      entrada_por: registradoPor,
      entrada_por_id: user?.id || null,
      visitante_id: visitanteId,
      morador_id: moradorId,
      veiculo_id: veiculoId,
      documento_numero: documentoNumero,
      ...(form.lancamentoManual
        ? {
            entrada_manual: true,
            entrada_em: datetimeLocalBrasiliaParaISO(form.entradaManualLocal),
            justificativa: form.justificativaManual.trim(),
          }
        : {}),
    };

    const { error: insertError } = await supabase.from("portaria_registros").insert(payload);
    setSubmitting(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }
    resetForm();
    load();
  }

  async function handleSaida(registro) {
    setSaindoId(registro.id);
    // O valor exato não importa: a trigger portaria_controlar_horarios
    // (ver supabase/schema.sql) sempre troca pelo horário do servidor
    // quando não é um lançamento manual — nunca confia no relógio do
    // navegador de quem está registrando.
    const { error: updateError } = await supabase
      .from("portaria_registros")
      .update({
        saida_em: new Date().toISOString(),
        saida_por: registradoPor,
        saida_por_id: user?.id || null,
      })
      .eq("id", registro.id);
    setSaindoId(null);
    if (updateError) setError(updateError.message);
    else load();
  }

  function abrirCorrecao(registro) {
    setCorrigindoId(registro.id);
    setCorrecaoForm({
      entradaLocal: paraDatetimeLocalBrasilia(registro.entrada_em),
      saidaLocal: registro.saida_em ? paraDatetimeLocalBrasilia(registro.saida_em) : "",
      justificativa: "",
    });
  }

  async function handleSalvarCorrecao(registro) {
    if (!correcaoForm.justificativa.trim()) {
      setError("Informe a justificativa da correção.");
      return;
    }
    setSalvandoCorrecao(true);
    setError("");
    const { error: updateError } = await supabase
      .from("portaria_registros")
      .update({
        entrada_em: datetimeLocalBrasiliaParaISO(correcaoForm.entradaLocal),
        saida_em: correcaoForm.saidaLocal ? datetimeLocalBrasiliaParaISO(correcaoForm.saidaLocal) : null,
        entrada_manual: true,
        saida_manual: true,
        justificativa: correcaoForm.justificativa.trim(),
      })
      .eq("id", registro.id);
    setSalvandoCorrecao(false);
    if (updateError) {
      // A trigger no banco recusa correção sem permissão/justificativa ou
      // com horário futuro/inconsistente — a mensagem já vem pronta dali.
      setError(updateError.message);
      return;
    }
    setCorrigindoId(null);
    load();
  }

  async function handleVerFotoPessoa(registro) {
    if (!registro.visitante_id && !registro.morador_id) return;
    setAbrindoFotoId(registro.id);
    const tabela = registro.morador_id ? "moradores" : "visitantes";
    const id = registro.morador_id || registro.visitante_id;
    const { data } = await supabase.from(tabela).select("foto_path").eq("id", id).maybeSingle();
    const url = data?.foto_path ? await obterUrlFotoAssinada(data.foto_path) : null;
    setAbrindoFotoId(null);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
    else setError("Essa pessoa não tem foto cadastrada.");
  }

  const registrosFiltrados = useMemo(() => {
    return registros.filter((r) => {
      if (filtro.pessoa && !r.nome_pessoa.toLowerCase().includes(filtro.pessoa.toLowerCase())) return false;
      if (filtro.unidade && !(r.unidade || "").toLowerCase().includes(filtro.unidade.toLowerCase()))
        return false;
      if (filtro.placa && !(r.placa_veiculo || "").toLowerCase().includes(filtro.placa.toLowerCase()))
        return false;
      if (podeCorrigir && filtro.documento && !(r.documento_numero || "").includes(filtro.documento)) return false;
      if (filtro.tipo && r.tipo_acesso !== filtro.tipo) return false;
      if (filtro.status === "dentro" && r.saida_em) return false;
      if (filtro.status === "saiu" && !r.saida_em) return false;
      // Compara o dia em horário de Brasília, não o prefixo cru do ISO
      // (em UTC), senão vira o dia errado perto da meia-noite.
      if (filtro.data && dataBrasiliaYMD(r.entrada_em) !== filtro.data) return false;
      return true;
    });
  }, [registros, filtro, podeCorrigir]);

  const dentroAgora = useMemo(() => registros.filter((r) => !r.saida_em).length, [registros]);

  if (!condominio) {
    return <p className="text-navy-500">Carregando condomínio...</p>;
  }

  return (
    <ModuloGuard modulo="portaria">
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-bold text-navy-900">Portaria</h1>
        <p className="mt-1 text-sm text-navy-500">
          Registro de entrada e saída de visitantes, entregas e prestadores — todos os horários em
          horário de Brasília.{" "} <strong className="text-navy-700">{dentroAgora}</strong>{" "}
          {dentroAgora === 1 ? "pessoa dentro" : "pessoas dentro"} agora.
        </p>
      </div>

      {podeCriar && (
        <div className="card">
          <h2 className="font-display text-lg font-bold text-navy-900">Registrar entrada</h2>
          <form onSubmit={handleCreate} className="mt-4 space-y-4">
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
                <input
                  className="input-field"
                  inputMode="numeric"
                  value={form.unidade}
                  onChange={(e) => setForm((f) => ({ ...f, unidade: e.target.value }))}
                  placeholder="Ex: Apto 32"
                />
              </div>
            </div>

            <div className="rounded-xl border border-navy-100 p-3">
                <p className="text-sm font-medium text-navy-800">Buscar pelo documento</p>
                <p className="mt-0.5 text-xs text-navy-500">
                  Se a pessoa já tiver cadastro (morador ou visita anterior, de qualquer tipo), os
                  dados aparecem sozinhos — não precisa preencher tudo de novo.
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
                    value={form.documentoNumero}
                    onChange={(e) => {
                      setBuscaFeita(false);
                      setPessoaEncontrada(null);
                      setForm((f) => ({ ...f, documentoNumero: e.target.value }));
                    }}
                    placeholder="Número do documento"
                  />
                  <button
                    type="button"
                    onClick={handleBuscarDocumento}
                    disabled={buscando || !form.documentoNumero.trim()}
                    className="btn-secondary disabled:opacity-50"
                  >
                    {buscando ? "Buscando..." : "Buscar"}
                  </button>
                </div>

                {buscaFeita && pessoaEncontrada && (
                  <div className="mt-3 flex items-center gap-3 rounded-lg bg-emerald-50 p-2 text-sm text-emerald-800">
                    {fotoPessoaUrl && (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={fotoPessoaUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
                    )}
                    <span>
                      Encontrado: <strong>{pessoaEncontrada.nome}</strong>{" "}
                      {pessoaEncontrada.origem === "morador"
                        ? `(morador, unidade ${pessoaEncontrada.unidade})`
                        : `(${TIPO_LABELS[pessoaEncontrada.tipo] || "visitante"} já cadastrado)`}
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
                  />
                  {!pessoaEncontrada && (
                    <button
                      type="button"
                      onClick={handleBuscarPorNome}
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
                        onClick={() => aplicarPessoaEncontrada(c)}
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
                <input
                  className="input-field"
                  value={form.responsavelNome}
                  onChange={(e) => setForm((f) => ({ ...f, responsavelNome: e.target.value }))}
                  placeholder="Quem na unidade autorizou/recebeu"
                />
              </div>
              {form.tipoAcesso !== "morador" && !pessoaEncontrada && (
                <div className="sm:col-span-2">
                  <label className="label-field">Foto (opcional)</label>
                  <CapturaFoto onCapturar={setFotoNovoVisitante} />
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

            {podeCorrigir && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3">
                <label className="flex items-center gap-2 text-sm text-navy-700">
                  <input
                    type="checkbox"
                    checked={form.lancamentoManual}
                    onChange={(e) => setForm((f) => ({ ...f, lancamentoManual: e.target.checked }))}
                  />
                  Lançamento manual (regularizar um horário passado, não a agora)
                </label>
                {form.lancamentoManual && (
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div>
                      <label className="label-field">Horário real da entrada</label>
                      <input
                        type="datetime-local"
                        className="input-field"
                        value={form.entradaManualLocal}
                        onChange={(e) => setForm((f) => ({ ...f, entradaManualLocal: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="label-field">Justificativa (obrigatória)</label>
                      <textarea
                        className="input-field"
                        rows={2}
                        value={form.justificativaManual}
                        onChange={(e) => setForm((f) => ({ ...f, justificativaManual: e.target.value }))}
                        placeholder="Ex: porteiro esqueceu de registrar na hora"
                        required
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? "Registrando..." : "Registrar entrada"}
            </button>
          </form>
        </div>
      )}

      {error && <p className="text-sm text-coral-700">{error}</p>}

      <div className="card">
        <h2 className="font-display text-lg font-bold text-navy-900">Histórico</h2>
        <div className={`mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 ${podeCorrigir ? "lg:grid-cols-7" : "lg:grid-cols-6"}`}>
          <input
            className="input-field"
            placeholder="Pessoa"
            value={filtro.pessoa}
            onChange={(e) => setFiltro((f) => ({ ...f, pessoa: e.target.value }))}
          />
          <input
            className="input-field"
            placeholder="Unidade"
            value={filtro.unidade}
            onChange={(e) => setFiltro((f) => ({ ...f, unidade: e.target.value }))}
          />
          <input
            className="input-field"
            placeholder="Placa"
            value={filtro.placa}
            onChange={(e) => setFiltro((f) => ({ ...f, placa: e.target.value }))}
          />
          {podeCorrigir && (
            <input
              className="input-field"
              placeholder="Documento"
              value={filtro.documento}
              onChange={(e) => setFiltro((f) => ({ ...f, documento: e.target.value }))}
            />
          )}
          <select
            className="input-field"
            value={filtro.tipo}
            onChange={(e) => setFiltro((f) => ({ ...f, tipo: e.target.value }))}
          >
            <option value="">Todos os tipos</option>
            {Object.entries(TIPO_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            className="input-field"
            value={filtro.status}
            onChange={(e) => setFiltro((f) => ({ ...f, status: e.target.value }))}
          >
            <option value="">Dentro e fora</option>
            <option value="dentro">Só quem está dentro</option>
            <option value="saiu">Só quem já saiu</option>
          </select>
          <input
            type="date"
            className="input-field"
            value={filtro.data}
            onChange={(e) => setFiltro((f) => ({ ...f, data: e.target.value }))}
          />
        </div>

        {loading ? (
          <p className="mt-4 text-navy-500">Carregando registros...</p>
        ) : registrosFiltrados.length === 0 ? (
          <div className="mt-4 text-center text-navy-400">Nenhum registro encontrado.</div>
        ) : (
          <>
            {/* Telas pequenas: cards empilhados, sem rolagem lateral. */}
            <div className="mt-4 space-y-3 md:hidden">
              {registrosFiltrados.map((r) => (
                <div key={r.id} className="rounded-xl border border-navy-100 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-navy-900">{r.nome_pessoa}</p>
                      <p className="text-xs text-navy-500">
                        {TIPO_LABELS[r.tipo_acesso]}
                        {r.unidade ? ` · Unidade ${r.unidade}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {!r.saida_em && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          Dentro
                        </span>
                      )}
                      {(r.entrada_manual || r.saida_manual) && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                          Manual
                        </span>
                      )}
                    </div>
                  </div>
                  <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-navy-600">
                    <div>
                      <dt className="text-navy-400">Entrada</dt>
                      <dd>{formatarDataHoraBR(r.entrada_em)}</dd>
                    </div>
                    <div>
                      <dt className="text-navy-400">Saída</dt>
                      <dd>{r.saida_em ? formatarDataHoraBR(r.saida_em) : "-"}</dd>
                    </div>
                    <div>
                      <dt className="text-navy-400">Veículo</dt>
                      <dd>{r.forma_entrada === "carro" ? "Carro" : "A pé"}</dd>
                    </div>
                    <div>
                      <dt className="text-navy-400">Placa</dt>
                      <dd>{r.placa_veiculo || "-"}</dd>
                    </div>
                    {podeCorrigir && (
                      <div>
                        <dt className="text-navy-400">Documento</dt>
                        <dd>{r.documento_numero ? mascararDocumento(r.documento_numero) : "-"}</dd>
                      </div>
                    )}
                    <div className="col-span-2">
                      <dt className="text-navy-400">Registrado por</dt>
                      <dd>{r.entrada_por || "-"}</dd>
                    </div>
                  </dl>
                  <div className="mt-2 flex flex-wrap gap-3">
                    {podeEditar && !r.saida_em && (
                      <button
                        onClick={() => handleSaida(r)}
                        disabled={saindoId === r.id}
                        className="text-xs font-semibold text-coral hover:underline disabled:opacity-50"
                      >
                        {saindoId === r.id ? "..." : "Registrar saída"}
                      </button>
                    )}
                    {(r.visitante_id || r.morador_id) && (
                      <button
                        onClick={() => handleVerFotoPessoa(r)}
                        disabled={abrindoFotoId === r.id}
                        className="text-xs font-semibold text-navy-700 hover:underline disabled:opacity-50"
                      >
                        {abrindoFotoId === r.id ? "Abrindo..." : "Ver foto"}
                      </button>
                    )}
                    {podeCorrigir && (
                      <button
                        onClick={() => abrirCorrecao(r)}
                        className="text-xs font-semibold text-navy-700 hover:underline"
                      >
                        Corrigir horários
                      </button>
                    )}
                  </div>
                  {corrigindoId === r.id && (
                    <CorrecaoInline
                      correcaoForm={correcaoForm}
                      setCorrecaoForm={setCorrecaoForm}
                      onCancelar={() => setCorrigindoId(null)}
                      onSalvar={() => handleSalvarCorrecao(r)}
                      salvando={salvandoCorrecao}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Telas médias e grandes: tabela completa. */}
            <div className="mt-4 hidden md:block">
              <table className="w-full text-sm">
                <thead className="border-b border-navy-100 text-left text-navy-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">Pessoa</th>
                    <th className="px-3 py-2 font-medium">Unidade</th>
                    <th className="px-3 py-2 font-medium">Entrada</th>
                    <th className="px-3 py-2 font-medium">Saída</th>
                    <th className="px-3 py-2 font-medium">Tipo</th>
                    <th className="px-3 py-2 font-medium">Veículo</th>
                    <th className="px-3 py-2 font-medium">Placa</th>
                    {podeCorrigir && <th className="px-3 py-2 font-medium">Documento</th>}
                    <th className="px-3 py-2 font-medium">Registrado por</th>
                    <th className="px-3 py-2 font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {registrosFiltrados.map((r) => (
                    <Fragment key={r.id}>
                      <tr className="border-b border-navy-50 last:border-0">
                        <td className="px-3 py-2 font-medium text-navy-900">
                          {r.nome_pessoa}
                          {(r.entrada_manual || r.saida_manual) && (
                            <span className="ml-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700">
                              Manual
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-navy-600">{r.unidade || "-"}</td>
                        <td className="px-3 py-2 text-navy-600">{formatarDataHoraBR(r.entrada_em)}</td>
                        <td className="px-3 py-2 text-navy-600">
                          {r.saida_em ? (
                            formatarDataHoraBR(r.saida_em)
                          ) : (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                              Dentro
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-navy-600">{TIPO_LABELS[r.tipo_acesso]}</td>
                        <td className="px-3 py-2 text-navy-600">
                          {r.forma_entrada === "carro" ? "Carro" : "A pé"}
                        </td>
                        <td className="px-3 py-2 text-navy-600">{r.placa_veiculo || "-"}</td>
                        {podeCorrigir && (
                          <td className="px-3 py-2 text-navy-600">
                            {r.documento_numero ? mascararDocumento(r.documento_numero) : "-"}
                          </td>
                        )}
                        <td className="px-3 py-2 text-navy-600">{r.entrada_por || "-"}</td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-2">
                            {podeEditar && !r.saida_em && (
                              <button
                                onClick={() => handleSaida(r)}
                                disabled={saindoId === r.id}
                                className="text-xs font-semibold text-coral hover:underline disabled:opacity-50"
                              >
                                {saindoId === r.id ? "..." : "Saída"}
                              </button>
                            )}
                            {(r.visitante_id || r.morador_id) && (
                              <button
                                onClick={() => handleVerFotoPessoa(r)}
                                disabled={abrindoFotoId === r.id}
                                className="text-xs font-semibold text-navy-700 hover:underline disabled:opacity-50"
                              >
                                Foto
                              </button>
                            )}
                            {podeCorrigir && (
                              <button
                                onClick={() => (corrigindoId === r.id ? setCorrigindoId(null) : abrirCorrecao(r))}
                                className="text-xs font-semibold text-navy-700 hover:underline"
                              >
                                Corrigir
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {corrigindoId === r.id && (
                        <tr className="border-b border-navy-50">
                          <td colSpan={podeCorrigir ? 10 : 9} className="bg-navy-50/40 px-3 py-3">
                            <CorrecaoInline
                              correcaoForm={correcaoForm}
                              setCorrecaoForm={setCorrecaoForm}
                              onCancelar={() => setCorrigindoId(null)}
                              onSalvar={() => handleSalvarCorrecao(r)}
                              salvando={salvandoCorrecao}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
    </ModuloGuard>
  );
}

// Formulário inline de correção — entrada/saída já gravadas + justificativa
// obrigatória. A validação "de verdade" (quem pode, se não é futuro, se não
// fica inconsistente) é feita pela trigger no banco (ver schema.sql); isto
// aqui é só a UX, não a segurança.
function CorrecaoInline({ correcaoForm, setCorrecaoForm, onCancelar, onSalvar, salvando }) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      <div>
        <label className="label-field">Entrada correta</label>
        <input
          type="datetime-local"
          className="input-field"
          value={correcaoForm.entradaLocal}
          onChange={(e) => setCorrecaoForm((f) => ({ ...f, entradaLocal: e.target.value }))}
        />
      </div>
      <div>
        <label className="label-field">Saída correta (deixe em branco se ainda está dentro)</label>
        <input
          type="datetime-local"
          className="input-field"
          value={correcaoForm.saidaLocal}
          onChange={(e) => setCorrecaoForm((f) => ({ ...f, saidaLocal: e.target.value }))}
        />
      </div>
      <div>
        <label className="label-field">Justificativa (obrigatória)</label>
        <input
          className="input-field"
          value={correcaoForm.justificativa}
          onChange={(e) => setCorrecaoForm((f) => ({ ...f, justificativa: e.target.value }))}
          placeholder="Motivo da correção"
        />
      </div>
      <div className="sm:col-span-3 flex gap-3">
        <button type="button" onClick={onSalvar} disabled={salvando} className="btn-primary text-sm">
          {salvando ? "Salvando..." : "Salvar correção"}
        </button>
        <button type="button" onClick={onCancelar} className="text-sm font-semibold text-navy-500 hover:underline">
          Cancelar
        </button>
      </div>
    </div>
  );
}
