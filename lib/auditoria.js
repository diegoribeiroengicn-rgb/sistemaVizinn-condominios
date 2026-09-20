// Server-only: grava uma linha de auditoria manualmente. Usado pelas rotas
// que mexem em `membros` (create/update/delete/reset-password) — essas
// rodam com a service role (sem sessão de usuário), então o trigger
// automático (registrar_auditoria_generica no banco) não consegue
// descobrir quem fez a alteração; aqui a gente já sabe, porque
// requireCondominioOwner/requireCondominioAccess resolveu o usuário antes.
export async function registrarAuditoria(supabaseAdmin, {
  condominioId,
  usuarioId,
  usuarioNome,
  papel,
  acao,
  modulo,
  registroId = null,
  dadosAnteriores = null,
  dadosNovos = null,
  status = null,
}) {
  const { error } = await supabaseAdmin.from("auditoria").insert({
    condominio_id: condominioId,
    usuario_id: usuarioId,
    usuario_nome: usuarioNome,
    papel,
    acao,
    modulo,
    registro_id: registroId,
    dados_anteriores: dadosAnteriores,
    dados_novos: dadosNovos,
    status,
  });
  if (error) {
    // Não deixa uma falha de log de auditoria derrubar a operação
    // principal — só registra no console do servidor pra investigar.
    console.error("Falha ao registrar auditoria:", error.message);
  }
}
