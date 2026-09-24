import { MODULO_LABELS, PAPEL_LABELS } from "@/lib/permissoes";

export { MODULO_LABELS };

// "sindico" não é uma linha em `membros` (é o dono do condomínio), mas
// é um papel válido pra segmentar conteúdo do chatbot — por isso entra
// aqui além do que já existe em PAPEL_LABELS.
export const PAPEL_ALVO_LABELS = { sindico: "Síndico", ...PAPEL_LABELS };
