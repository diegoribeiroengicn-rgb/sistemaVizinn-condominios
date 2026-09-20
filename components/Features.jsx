const features = [
  {
    icon: "🧾",
    title: "Boletos automáticos",
    text: "Gere e envie boletos para todas as unidades em poucos cliques, com baixa automática.",
  },
  {
    icon: "🏢",
    title: "Portal do condômino 24/7",
    text: "Moradores acompanham boletos, avisos e chamados a qualquer hora, no celular ou computador.",
  },
  {
    icon: "🤖",
    title: "IA assistente",
    text: "Respostas automáticas para dúvidas frequentes e triagem inteligente de chamados.",
  },
  {
    icon: "🤝",
    title: "Sem intermediários",
    text: "Fale direto com o síndico e a administradora, sem burocracia extra.",
  },
];

export default function Features() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6" id="recursos">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="font-display text-3xl font-bold text-navy-900 sm:text-4xl">
          Tudo que o seu condomínio precisa
        </h2>
        <p className="mt-4 text-navy-600">
          Uma plataforma completa para simplificar o dia a dia da administração condominial.
        </p>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {features.map((f) => (
          <div key={f.title} className="card">
            <span className="text-3xl">{f.icon}</span>
            <h3 className="mt-4 font-display text-lg font-bold text-navy-900">
              {f.title}
            </h3>
            <p className="mt-2 text-sm text-navy-600">{f.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
