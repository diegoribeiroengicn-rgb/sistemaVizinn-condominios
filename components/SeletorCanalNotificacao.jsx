"use client";

// Escolha de canal pra uma notificação específica — reaproveitado em todo
// formulário que tem um "avisar morador(es)" (Ocorrências, Avisos,
// Chamados, Manutenção). WhatsApp foi removido do sistema; só resta
// e-mail, então não há mais escolha real — mantido como componente (em
// vez de apagado dos 4 forms que o usam) pra não precisar redesenhar
// cada tela caso outro canal (push) entre no futuro.
export default function SeletorCanalNotificacao({ name, value, onChange }) {
  return (
    <div className="mt-2 flex flex-wrap gap-3 text-sm text-navy-600">
      <label className="flex items-center gap-1.5">
        <input type="radio" name={name} checked readOnly />
        E-mail
      </label>
    </div>
  );
}

// Converte a escolha em lista de canais pra API /api/notificar — hoje só
// "email" existe, então o valor recebido não importa mais.
export function canaisDoValor() {
  return ["email"];
}
