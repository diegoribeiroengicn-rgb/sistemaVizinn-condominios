"use client";

// Prévia lado a lado de como a notificação chega em cada canal — pra
// pegar texto redundante ou esquisito antes de enviar de verdade.
// "[nome do morador]" etc aparecem como placeholder porque o nome real
// só é resolvido no envio (pode ser mais de um morador por unidade).
export default function PreviaMensagem({ whatsapp, email }) {
  return (
    <div className="mt-2 grid grid-cols-1 gap-3 rounded-lg border border-navy-100 bg-navy-50/40 p-3 text-sm sm:grid-cols-2">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-navy-400">💬 Prévia do WhatsApp</p>
        <p className="mt-1 whitespace-pre-wrap text-navy-700">{whatsapp}</p>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-navy-400">📧 Prévia do e-mail</p>
        <p className="mt-1 whitespace-pre-wrap text-navy-700">{email}</p>
      </div>
    </div>
  );
}
