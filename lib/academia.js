// Constantes do módulo Academia Vizinn — vídeos administrados pelo
// painel admin, consumidos pelo dashboard do condomínio conforme o
// nível de acesso de cada vídeo (ver função usuario_tem_acesso_academia
// e as policies do bucket academia-videos em supabase/schema.sql).

export const NIVEL_ACESSO_ORDER = ["publico", "teste_14_dias", "assinante"];
export const NIVEL_ACESSO_LABELS = {
  publico: "Público",
  teste_14_dias: "Teste 14 dias",
  assinante: "Assinante",
};
export const NIVEL_ACESSO_STYLES = {
  publico: "bg-emerald-100 text-emerald-700",
  teste_14_dias: "bg-amber-100 text-amber-700",
  assinante: "bg-sky-100 text-sky-700",
};

export const STATUS_LABELS = { rascunho: "Rascunho", publicado: "Publicado" };

export const TAMANHO_MAXIMO_VIDEO = 200 * 1024 * 1024; // 200 MB — folga confortável pra até 5min
export const TAMANHO_MAXIMO_THUMBNAIL = 5 * 1024 * 1024; // 5 MB

const STATUS_ASSINANTE = ["active", "promessa", "cortesia"];

// Só pra decidir o que mostrar (cadeado ou não) na listagem — quem
// decide de verdade se o arquivo abre é a policy do bucket
// academia-videos no banco (usuario_tem_acesso_academia), que usa a
// mesma regra. Mantidas em dois lugares de propósito: aqui é só
// UI, lá é o controle de acesso real.
export function pareceAcessivel(nivelAcesso, statusCondominio) {
  if (nivelAcesso === "publico") return true;
  if (nivelAcesso === "teste_14_dias") return statusCondominio === "trialing" || STATUS_ASSINANTE.includes(statusCondominio);
  if (nivelAcesso === "assinante") return STATUS_ASSINANTE.includes(statusCondominio);
  return false;
}
