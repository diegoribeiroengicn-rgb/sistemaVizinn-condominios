// Gera /robots.txt automaticamente — libera a página pública pro
// Google indexar, mas bloqueia rastreamento de áreas que exigem login
// (dashboard, admin, painel do vendedor) e das rotas de API.
export default function robots() {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/admin", "/vendedor", "/api"],
    },
    sitemap: "https://www.vizinn.com.br/sitemap.xml",
  };
}
