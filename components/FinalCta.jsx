export default function FinalCta({ onStart }) {
  return (
    <section className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6">
      <h2 className="font-display text-3xl font-bold text-navy-900 sm:text-4xl">
        Pronto para simplificar seu condomínio?
      </h2>
      <p className="mx-auto mt-4 max-w-xl text-navy-600">
        Crie sua conta agora e tenha o dashboard do seu condomínio funcionando em minutos.
      </p>
      <button onClick={onStart} className="btn-primary mt-8 px-8 py-4 text-base">
        Começar 14 dias grátis
      </button>
    </section>
  );
}
