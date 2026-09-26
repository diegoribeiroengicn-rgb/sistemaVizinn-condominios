"use client";

import { CATEGORIAS_SUGERIDAS } from "@/lib/fornecedores";

// Entrada de categorias — um fornecedor pode atuar em mais de uma
// (ex: Elétrica e Hidráulica). Só permite escolher da lista fixa
// (CATEGORIAS_SUGERIDAS), a mesma usada no filtro da Rede Vizinn —
// antes era texto livre com essa lista só como sugestão de
// autocompletar, e qualquer variação digitada (plural/singular,
// maiúscula, espaço a mais) fazia o fornecedor nunca aparecer na
// busca por categoria de outro condomínio, porque o filtro compara
// com essa mesma lista.
export default function CategoriasFornecedorInput({ value, onChange }) {
  const categorias = value || [];

  function alternar(categoria, marcado) {
    onChange(marcado ? [...categorias, categoria] : categorias.filter((c) => c !== categoria));
  }

  return (
    <div className="flex flex-wrap gap-2">
      {CATEGORIAS_SUGERIDAS.map((c) => {
        const marcado = categorias.includes(c);
        return (
          <label
            key={c}
            className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${
              marcado ? "border-coral bg-coral-50 text-coral-700" : "border-navy-200 text-navy-600"
            }`}
          >
            <input
              type="checkbox"
              className="sr-only"
              checked={marcado}
              onChange={(e) => alternar(c, e.target.checked)}
            />
            {c}
          </label>
        );
      })}
    </div>
  );
}
