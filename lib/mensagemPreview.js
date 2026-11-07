// Prévia fiel do e-mail que realmente sai em cada evento — espelha os
// corpos de app/api/notificar/route.js. Mudou o texto lá? Muda aqui
// também, senão a prévia engana.
const TEMPLATES = {
  encomenda_chegou: {
    email: (v) =>
      `Olá, ${v.nome_morador || "[nome do morador]"}!\n\nChegou uma encomenda para você em ${v.nome_condominio || "[condomínio]"}.\n\n${v.mensagem || "[mensagem]"}`,
  },
  ocorrencia_morador: {
    email: (v) =>
      `Olá, ${v.nome_morador || "[nome do morador]"}!\n\nUma ocorrência foi registrada em seu nome: ${v.titulo || "[título]"}\n\n${v.mensagem || ""}`,
  },
  ocorrencia_aviso_geral: {
    email: (v) => `Olá, ${v.nome_morador || "[nome do morador]"}!\n\n${v.titulo || "[título]"}\n\n${v.mensagem || ""}`,
  },
  manutencao_aviso: {
    email: (v) => `Olá, ${v.nome_morador || "[nome do morador]"}!\n\n${v.titulo || "[título]"}\n\n${v.mensagem || ""}`,
  },
  aviso_publicado: {
    email: (v) => `Olá, ${v.nome_morador || "[nome do morador]"}!\n\n${v.titulo || "[título]"}\n\n${v.mensagem || ""}`,
  },
  chamado_morador: {
    email: (v) =>
      `Olá, ${v.nome_morador || "[nome do morador]"}!\n\nUm chamado foi registrado em seu nome: ${v.titulo_chamado || "[título]"}. Você será avisado quando for concluído.`,
  },
};

export function previaEmail(templateKey, valores) {
  const t = TEMPLATES[templateKey];
  if (!t) return "";
  return t.email(valores);
}
