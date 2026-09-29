// Manifesto do app instalável (PWA) — o Next gera /manifest.webmanifest
// automaticamente a partir daqui. É isso que permite "Adicionar à tela
// inicial" no Android/Chrome (com o botão de instalar em
// components/InstalarApp.jsx) e dá ícone/nome/tela cheia ao abrir.
export default function manifest() {
  return {
    name: "AquiHabitto — Condomínio Inteligente",
    short_name: "AquiHabitto",
    description:
      "Gestão condominial completa: chamados, avisos, financeiro, portaria e notificações automáticas por WhatsApp.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f5f0e8",
    theme_color: "#0a1f3f",
    orientation: "portrait-primary",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
