const features = [
  {
    icon: "📲",
    title: "Notificações automáticas",
    text: "Avisos por WhatsApp e e-mail direto pro morador ou funcionário certo: encomenda chegou, chamado foi atribuído — sem ninguém precisar lembrar de avisar.",
  },
  {
    icon: "🏢",
    title: "Portal do condômino 24/7",
    text: "Moradores acompanham avisos e chamados a qualquer hora, no celular ou computador.",
  },
  {
    icon: "📄",
    title: "Relatórios profissionais",
    text: "Financeiro, chamados, portaria e mais — exportados em PDF ou Word com um clique, prontos para prestação de contas e assembleia.",
  },
  {
    icon: "🤝",
    title: "Sem intermediários",
    text: "Fale direto com o síndico e a administradora, sem burocracia extra.",
  },
  {
    icon: "🎓",
    title: "Academia Vizinn",
    text: "Vídeos curtos que ensinam a usar cada parte do sistema — do cadastro de morador à emissão de relatório. Alguns são livres pra qualquer visitante, outros liberam no teste grátis ou pra assinantes.",
  },
  {
    icon: "✅",
    title: "Fornecedores validados",
    text: "Uma rede compartilhada entre condomínios Vizinn, com CNPJ único por fornecedor e reputação real baseada em avaliações de outros síndicos — nada fictício.",
  },
  {
    icon: "🔐",
    title: "Acessos por perfil",
    text: "Síndico, conselheiro, zelador, porteiro, condômino — cada papel vê só o que precisa, com permissões configuráveis módulo a módulo.",
  },
  {
    icon: "🛎️",
    title: "Portaria digital",
    text: "Entrada e saída de visitantes, entregadores e prestadores registrada na hora, com histórico consultável por unidade ou data.",
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
