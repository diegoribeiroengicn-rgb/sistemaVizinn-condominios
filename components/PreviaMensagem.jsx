"use client";

// Prévia de como a notificação chega por e-mail — pra pegar texto
// redundante ou esquisito antes de enviar de verdade. "[nome do
// morador]" etc aparecem como placeholder porque o nome real só é
// resolvido no envio (pode ser mais de um morador por unidade).
export default function PreviaMensagem({ email }) {
  return (
    <div className="mt-2 rounded-lg border border-navy-100 bg-navy-50/40 p-3 text-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-navy-400">📧 Prévia do e-mail</p>
      <p className="mt-1 whitespace-pre-wrap text-navy-700">{email}</p>
    </div>
  );
}
