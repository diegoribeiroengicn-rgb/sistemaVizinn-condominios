"use client";

// Foto ampliada em tela cheia — pra dar pra conferir de verdade se é a
// pessoa, em vez de um polegar pequeno. Fecha clicando fora, no X ou
// com Esc.
export default function VisualizadorFoto({ url, onFechar }) {
  if (!url) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-midnight/85 p-4"
      onClick={onFechar}
      role="button"
      tabIndex={-1}
      onKeyDown={(e) => e.key === "Escape" && onFechar()}
    >
      <button
        type="button"
        onClick={onFechar}
        className="absolute right-4 top-4 text-3xl leading-none text-white hover:text-coral"
        aria-label="Fechar"
      >
        ×
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt="Foto ampliada"
        className="max-h-[90vh] max-w-full rounded-lg object-contain shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
