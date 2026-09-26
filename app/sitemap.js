// Gera /sitemap.xml automaticamente — só as páginas públicas (sem
// login), pra ajudar o Google a indexar o site. Nada de dashboard,
// admin ou qualquer rota que exija login: essas nunca devem ser
// indexadas (nem fariam sentido pra um visitante sem conta).
export default function sitemap() {
  const baseUrl = "https://www.vizinn.com.br";
  const agora = new Date();

  return [
    { url: baseUrl, lastModified: agora, changeFrequency: "weekly", priority: 1 },
  ];
}
