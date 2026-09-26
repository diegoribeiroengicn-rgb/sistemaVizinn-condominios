// Nome de arquivo seguro pra usar como chave no Supabase Storage — ele
// rejeita (erro "Invalid key") nomes com acento ou outros caracteres
// fora do padrão seguro de chave S3. Tira acentos e troca qualquer
// coisa que não seja letra/número/ponto/traço/underscore por "-",
// preservando a extensão original.
export function nomeArquivoSeguro(nomeOriginal) {
  const nome = String(nomeOriginal || "arquivo");
  const semAcento = nome.normalize("NFD").replace(/[̀-ͯ]/g, "");
  return semAcento.replace(/[^a-zA-Z0-9._-]/g, "-");
}
