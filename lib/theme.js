// Tema claro/escuro: a preferência fica em localStorage (chave abaixo) e
// vira o atributo data-theme na tag <html>, que os valores de
// app/globals.css leem pra trocar as variáveis de cor. Sem escolha salva,
// segue a preferência do sistema operacional (prefers-color-scheme).
export const THEME_STORAGE_KEY = "vizinn-theme";

export function getStoredTheme() {
  if (typeof window === "undefined") return null;
  try {
    const valor = window.localStorage.getItem(THEME_STORAGE_KEY);
    return valor === "light" || valor === "dark" ? valor : null;
  } catch {
    return null;
  }
}

export function applyTheme(theme) {
  if (typeof document === "undefined") return;
  if (theme) document.documentElement.setAttribute("data-theme", theme);
  else document.documentElement.removeAttribute("data-theme");
}

export function setStoredTheme(theme) {
  applyTheme(theme);
  if (typeof window === "undefined") return;
  try {
    if (theme) window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    else window.localStorage.removeItem(THEME_STORAGE_KEY);
  } catch {
    // localStorage indisponível (modo privado, etc.) — o tema só não
    // persiste entre sessões, mas continua funcionando na atual.
  }
}

// Roda antes do React hidratar (via <script> inline no <head>) pra
// aplicar o tema salvo de cara, sem o "flash" de trocar de tema um
// instante depois de carregar a página.
export const THEME_INIT_SCRIPT = `
(function () {
  try {
    var tema = window.localStorage.getItem("${THEME_STORAGE_KEY}");
    if (tema === "light" || tema === "dark") {
      document.documentElement.setAttribute("data-theme", tema);
    }
  } catch (e) {}
})();
`;
