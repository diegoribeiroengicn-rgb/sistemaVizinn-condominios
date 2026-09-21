// Central definition of the three subscription plans.
// Keep this in sync with the Price objects created in the Stripe dashboard
// (see README for the env vars that map plan id -> Stripe price id).
export const PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: 49,
    unitLimit: 30,
    priceEnv: "STRIPE_PRICE_STARTER",
    description: "Para condomínios pequenos que estão começando a digitalizar a gestão.",
    features: [
      "Até 30 unidades",
      "Portal do condômino",
      "Chamados e avisos",
      "Suporte por e-mail",
    ],
  },
  {
    id: "growth",
    name: "Growth",
    price: 99,
    unitLimit: 100,
    priceEnv: "STRIPE_PRICE_GROWTH",
    description: "O mais escolhido: para condomínios em crescimento com mais demandas.",
    features: [
      "Até 100 unidades",
      "Portal do condômino 24/7",
      "Notificações por WhatsApp e e-mail",
      "Relatórios em PDF e Word",
      "Suporte prioritário",
    ],
    highlighted: true,
  },
  {
    id: "pro",
    name: "Pro",
    price: 199,
    unitLimit: 500,
    priceEnv: "STRIPE_PRICE_PRO",
    description: "Para administradoras e condomínios de grande porte.",
    features: [
      "Até 500 unidades",
      "Portal do condômino 24/7",
      "Notificações por WhatsApp e e-mail",
      "Relatórios em PDF e Word",
      "Múltiplos síndicos",
      "Suporte dedicado",
    ],
  },
];

export function getPlan(planId) {
  return PLANS.find((p) => p.id === planId) ?? PLANS[1];
}

// Server-only: resolves a plan's Stripe Price ID from its env var.
export function getStripePriceId(planId) {
  const plan = getPlan(planId);
  return process.env[plan.priceEnv] || null;
}

// Amount, in cents, charged immediately at signup to validate the card.
export const CARD_VALIDATION_AMOUNT_CENTS = 100; // R$ 1,00
export const TRIAL_PERIOD_DAYS = 14;
