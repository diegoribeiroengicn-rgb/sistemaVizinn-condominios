"use client";

// Indicador visual (3 bolinhas) do Nível de Destaque Comercial de um
// fornecedor — informação exclusivamente administrativa/comercial.
// Usar SOMENTE dentro de telas do painel admin (/admin/**), nunca em
// telas visíveis a fornecedor, condomínio ou morador.
export default function BolinhasDestaqueComercial({ nivel = 0, onChange, tamanho = "text-sm" }) {
  const niveis = [1, 2, 3];
  return (
    <span className={`inline-flex items-center gap-1 ${tamanho}`} aria-label={`Destaque comercial nível ${nivel}`}>
      {niveis.map((n) => {
        const preenchida = n <= nivel;
        const conteudo = (
          <span
            key={n}
            className={`inline-block h-3 w-3 rounded-full border ${
              preenchida ? "border-navy-700 bg-navy-700" : "border-navy-300 bg-transparent"
            }`}
          />
        );
        if (!onChange) return conteudo;
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n === nivel ? 0 : n)}
            className="p-0.5"
            aria-label={`Definir nível ${n}`}
          >
            {conteudo}
          </button>
        );
      })}
    </span>
  );
}
