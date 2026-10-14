// Prévia fiel do que realmente sai em cada canal — espelha os textos
// aprovados na Meta (ver README, seção WhatsApp) e os corpos de e-mail
// de app/api/notificar/route.js. Mudou o texto lá? Muda aqui também,
// senão a prévia engana.
function substituir(texto, valores) {
  return texto.replace(/\{\{(\w+)\}\}/g, (_, chave) => {
    const valor = valores[chave];
    return valor && String(valor).trim() ? valor : `[${chave}]`;
  });
}

const TEMPLATES = {
  encomenda_chegou: {
    whatsapp:
      "Olá {{nome_morador}}, uma encomenda acabou de chegar para você no condomínio {{nome_condominio}}. Detalhes: {{mensagem}} — Mensagem automática do AquiHabitto",
    email: (v) =>
      `Olá, ${v.nome_morador || "[nome do morador]"}!\n\nChegou uma encomenda para você em ${v.nome_condominio || "[condomínio]"}.\n\n${v.mensagem || "[mensagem]"}`,
  },
  ocorrencia_morador: {
    whatsapp:
      "Olá {{nome_morador}}, uma ocorrência foi registrada em seu nome no condomínio: {{titulo}}. Detalhes: {{mensagem}} — Mensagem automática do AquiHabitto",
    email: (v) =>
      `Olá, ${v.nome_morador || "[nome do morador]"}!\n\nUma ocorrência foi registrada em seu nome: ${v.titulo || "[título]"}\n\n${v.mensagem || ""}`,
  },
  ocorrencia_aviso_geral: {
    whatsapp: "Olá {{nome_morador}}, segue um aviso do condomínio: {{titulo}}. {{mensagem}} — Mensagem automática do AquiHabitto",
    email: (v) => `Olá, ${v.nome_morador || "[nome do morador]"}!\n\n${v.titulo || "[título]"}\n\n${v.mensagem || ""}`,
  },
  manutencao_aviso: {
    whatsapp:
      "Olá {{nome_morador}}, segue um aviso de manutenção programada: {{titulo}}. {{mensagem}} — Mensagem automática do AquiHabitto",
    email: (v) => `Olá, ${v.nome_morador || "[nome do morador]"}!\n\n${v.titulo || "[título]"}\n\n${v.mensagem || ""}`,
  },
  aviso_publicado: {
    whatsapp: "Olá {{nome_morador}}, foi publicado um novo aviso no condomínio: {{titulo}}. {{mensagem}} — Mensagem automática do AquiHabitto",
    email: (v) => `Olá, ${v.nome_morador || "[nome do morador]"}!\n\n${v.titulo || "[título]"}\n\n${v.mensagem || ""}`,
  },
  chamado_morador: {
    whatsapp: "Olá {{nome_morador}}, um chamado foi registrado em seu nome: {{titulo_chamado}}. Você será avisado por aqui quando for concluído.",
    email: (v) =>
      `Olá, ${v.nome_morador || "[nome do morador]"}!\n\nUm chamado foi registrado em seu nome: ${v.titulo_chamado || "[título]"}. Você será avisado quando for concluído.`,
  },
};

export function previaWhatsapp(templateKey, valores) {
  const t = TEMPLATES[templateKey];
  if (!t) return "";
  return substituir(t.whatsapp, valores);
}

export function previaEmail(templateKey, valores) {
  const t = TEMPLATES[templateKey];
  if (!t) return "";
  return t.email(valores);
}
