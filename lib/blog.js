// Constantes e helpers do Blog (conteúdo/SEO) — compartilhado entre o
// painel admin (/admin/blog) e as páginas públicas (/blog, /blog/[slug]).
export const STATUS_LABELS = { rascunho: "Rascunho", publicado: "Publicado" };
export const STATUS_STYLES = {
  rascunho: "bg-navy-100 text-navy-500",
  publicado: "bg-emerald-100 text-emerald-700",
};

// "Como Reduzir a Inadimplência" -> "como-reduzir-a-inadimplencia"
export function gerarSlug(titulo) {
  return String(titulo || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

// Parser minimalista de conteúdo — sem dependência de markdown: um
// bloco separado por linha em branco vira parágrafo; um bloco
// iniciado com "## " vira título de seção; um bloco onde toda linha
// começa com "- " vira lista. Suficiente pra um post de blog bem
// formatado sem precisar de editor rico nem lib nova.
export function blocosDoConteudo(texto) {
  return String(texto || "")
    .split(/\n\s*\n/)
    .map((bloco) => bloco.trim())
    .filter(Boolean)
    .map((bloco) => {
      if (bloco.startsWith("## ")) return { tipo: "h2", texto: bloco.slice(3).trim() };
      const linhas = bloco.split("\n").map((l) => l.trim());
      if (linhas.every((l) => l.startsWith("- "))) {
        return { tipo: "lista", itens: linhas.map((l) => l.slice(2).trim()) };
      }
      return { tipo: "paragrafo", texto: bloco };
    });
}

// Negrito inline: "texto **importante** aqui" -> partes com { negrito: true }
// pra quem renderiza (páginas públicas e preview) montar <strong>. Sem lib de
// markdown — só o suficiente pra não aparecer "**" literal no texto.
export function partesInline(texto) {
  const str = String(texto || "");
  const partes = [];
  const regex = /\*\*(.+?)\*\*/g;
  let ultimo = 0;
  let match;
  while ((match = regex.exec(str))) {
    if (match.index > ultimo) partes.push({ texto: str.slice(ultimo, match.index), negrito: false });
    partes.push({ texto: match[1], negrito: true });
    ultimo = regex.lastIndex;
  }
  if (ultimo < str.length) partes.push({ texto: str.slice(ultimo), negrito: false });
  return partes;
}

// Aceita link comum do YouTube (watch?v=, youtu.be/, shorts/, já embed/) e
// devolve só o ID do vídeo, pra montar a URL de embed. null se não reconhecer.
export function idYoutube(url) {
  const match = String(url || "").match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{6,})/
  );
  return match ? match[1] : null;
}
