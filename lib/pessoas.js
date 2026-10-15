// Cadastro geral de pessoas (moradores + visitantes) usado pela Portaria
// pra identificar quem chega pelo documento, sem duplicar cadastro a cada
// visita. Não existe uma tabela única "pessoas" — morador já tem sua
// própria tabela (moradores) desde antes; aqui só juntamos a busca por
// documento entre ela e a nova tabela "visitantes" (quem não mora no
// condomínio: visitante, prestador recorrente etc. que vale a pena
// reconhecer na próxima vez que vier).

import { supabase } from "@/lib/supabase";

export const DOCUMENTO_TIPO_LABELS = { cpf: "CPF", rg: "RG", cnh: "CNH", outro: "Outro" };

export const BUCKET_FOTOS_PESSOAS = "pessoas-fotos";

// Tipos de pessoa que passam pela Portaria (todos, exceto morador, que já
// tem sua própria tabela/tela). "visitantes.tipo" usa este mesmo conjunto
// — um único cadastro pra visitante/entregador/prestador/outro, só o rótulo
// muda. O valor aqui é só o "tipo com que foi cadastrado primeiro"; na
// hora do acesso, o tipo daquela visita específica (tipo_acesso, em
// portaria_registros) pode ser diferente — ex: um entregador que também
// aparece como visitante num outro dia.
export const TIPO_VISITANTE_LABELS = {
  visitante: "Visitante",
  entregador: "Entregador",
  prestador_servico: "Prestador de serviço",
  outro: "Outro",
};

// Conjunto completo usado no seletor "Tipo de acesso" da Portaria
// (inclui morador, que não é uma linha de "visitantes").
export const TIPO_PESSOA_LABELS = {
  visitante: "Visitante",
  entregador: "Entregador",
  prestador_servico: "Prestador de serviço",
  morador: "Morador",
  outro: "Outro",
};

// Mostra só os últimos 4 caracteres — usado em listagens pra quem não tem
// a permissão mais ampla (ver página de Portaria). O documento completo
// continua existindo no banco; isto é só exibição.
export function mascararDocumento(numero) {
  if (!numero) return "-";
  const limpo = String(numero).trim();
  if (limpo.length <= 4) return limpo;
  return `${"•".repeat(limpo.length - 4)}${limpo.slice(-4)}`;
}

// Busca por documento nas duas bases (moradores e visitantes), sempre
// isolada por condominio_id. Devolve o primeiro encontrado, com um campo
// `origem` pra sabermos de onde veio ("morador" | "visitante").
export async function buscarPessoaPorDocumento(condominioId, documentoTipo, documentoNumero) {
  const numero = (documentoNumero || "").trim();
  if (!condominioId || !documentoTipo || !numero) return null;

  const { data: morador } = await supabase
    .from("moradores")
    .select("id, nome, unidade, bloco, telefone, foto_path, documento_tipo, documento_numero")
    .eq("condominio_id", condominioId)
    .eq("documento_tipo", documentoTipo)
    .eq("documento_numero", numero)
    .maybeSingle();
  if (morador) return { origem: "morador", ...morador };

  const { data: visitante } = await supabase
    .from("visitantes")
    .select("id, nome, tipo, telefone, foto_path, documento_tipo, documento_numero, observacoes, situacao")
    .eq("condominio_id", condominioId)
    .eq("documento_tipo", documentoTipo)
    .eq("documento_numero", numero)
    .maybeSingle();
  if (visitante) return { origem: "visitante", ...visitante };

  return null;
}

// Busca por NOME (parcial, sem diferenciar maiúscula/acento) nas duas
// bases — complementa a busca por documento pra quando a pessoa não tem
// documento à mão, mas já esteve aqui antes. Devolve até 5 candidatos
// (pode achar mais de uma pessoa com nome parecido); quem usa decide
// qual é, não presume sozinho.
export async function buscarPessoasPorNome(condominioId, nome) {
  const termo = (nome || "").trim();
  if (!condominioId || termo.length < 3) return [];

  const { data: moradoresEncontrados } = await supabase
    .from("moradores")
    .select("id, nome, unidade, bloco, telefone, foto_path, documento_tipo, documento_numero")
    .eq("condominio_id", condominioId)
    .ilike("nome", `%${termo}%`)
    .limit(5);

  const { data: visitantesEncontrados } = await supabase
    .from("visitantes")
    .select("id, nome, tipo, telefone, foto_path, documento_tipo, documento_numero, observacoes, situacao")
    .eq("condominio_id", condominioId)
    .ilike("nome", `%${termo}%`)
    .limit(5);

  return [
    ...(moradoresEncontrados || []).map((m) => ({ origem: "morador", ...m })),
    ...(visitantesEncontrados || []).map((v) => ({ origem: "visitante", ...v })),
  ];
}

// URL temporária (expira) pra exibir uma foto privada do bucket
// pessoas-fotos — nunca gera link público/permanente (LGPD).
export async function obterUrlFotoAssinada(path) {
  if (!path) return null;
  const { data, error } = await supabase.storage.from(BUCKET_FOTOS_PESSOAS).createSignedUrl(path, 300);
  if (error) return null;
  return data?.signedUrl || null;
}

export async function enviarFotoPessoa(condominioId, tabela, arquivo) {
  const caminho = `${condominioId}/${tabela}/${Date.now()}-${arquivo.name}`;
  const { error } = await supabase.storage.from(BUCKET_FOTOS_PESSOAS).upload(caminho, arquivo);
  if (error) throw new Error(error.message);
  return caminho;
}
