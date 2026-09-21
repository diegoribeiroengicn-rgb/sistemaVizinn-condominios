"use client";

import { CATEGORIAS_SUGERIDAS } from "@/lib/fornecedores";

// Entrada de categorias em formato de "chips" — um fornecedor pode
// atuar em mais de uma categoria (ex: Elétrica e Hidráulica). Digite e
// pressione Enter/vírgula (ou saia do campo) pra adicionar; sugestões
// vêm de CATEGORIAS_SUGERIDAS mas qualquer texto livre é aceito.
export default function CategoriasFornecedorInput({ value, onChange, inputId = "categorias-fornecedor" }) {
  const categorias = value || [];

  function adicionar(texto) {
    const limpo = texto.trim();
    if (!limpo || categorias.includes(limpo)) return;
    onChange([...categorias, limpo]);
  }

  function remover(categoria) {
    onChange(categorias.filter((c) => c !== categoria));
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      adicionar(e.target.value);
      e.target.value = "";
    }
  }

  function handleBlur(e) {
    if (e.target.value.trim()) {
      adicionar(e.target.value);
      e.target.value = "";
    }
  }

  return (
    <div>
      {categorias.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {categorias.map((c) => (
            <span
              key={c}
              className="inline-flex items-center gap-1 rounded-full bg-navy-50 px-2.5 py-1 text-xs font-medium text-navy-600"
            >
              {c}
              <button
                type="button"
                onClick={() => remover(c)}
                className="text-navy-400 hover:text-coral"
                aria-label={`Remover categoria ${c}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        className="input-field"
        list={inputId}
        placeholder="Digite uma categoria e pressione Enter (pode adicionar mais de uma)..."
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
      />
      <datalist id={inputId}>
        {CATEGORIAS_SUGERIDAS.filter((c) => !categorias.includes(c)).map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
    </div>
  );
}
