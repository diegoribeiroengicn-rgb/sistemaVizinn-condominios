"use client";

// Escolha de canal pra uma notificação específica — reaproveitado em todo
// formulário que tem um "avisar morador(es)" (Ocorrências, Avisos,
// Chamados, Manutenção). "ambos" é o padrão em todo form que usa isso,
// pra manter o comportamento de quem não mexer na escolha.
const OPCOES = [
  { valor: "email", label: "E-mail" },
  { valor: "whatsapp", label: "WhatsApp" },
  { valor: "ambos", label: "Os dois" },
];

export default function SeletorCanalNotificacao({ name, value, onChange }) {
  return (
    <div className="mt-2 flex flex-wrap gap-3 text-sm text-navy-600">
      {OPCOES.map((opt) => (
        <label key={opt.valor} className="flex items-center gap-1.5">
          <input
            type="radio"
            name={name}
            checked={value === opt.valor}
            onChange={() => onChange(opt.valor)}
          />
          {opt.label}
        </label>
      ))}
    </div>
  );
}

// Converte a escolha ("email" | "whatsapp" | "ambos") na lista de canais
// que a API /api/notificar espera.
export function canaisDoValor(valor) {
  return valor === "ambos" ? ["email", "whatsapp"] : [valor];
}
