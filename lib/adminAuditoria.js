// Auditoria administrativa (platform-level) — usada por rotas que
// mexem em vendedores, modelos de comissionamento e status de
// comissões. Diferente da auditoria por condomínio (trigger
// automático em supabase/schema.sql), essas tabelas não têm
// condominio_id, então o registro é manual, feito pela própria rota
// depois de uma alteração bem-sucedida.
export async function registrarAuditoriaAdmin(supabaseAdmin, {
  adminUser,
  acao,
  entidade,
  entidadeId,
  dadosAnteriores = null,
  dadosNovos = null,
  motivo = null,
}) {
  const { error } = await supabaseAdmin.from("auditoria_admin").insert({
    admin_user_id: adminUser?.id || null,
    admin_email: adminUser?.email || null,
    acao,
    entidade,
    entidade_id: entidadeId || null,
    dados_anteriores: dadosAnteriores,
    dados_novos: dadosNovos,
    motivo,
  });
  // Auditoria nunca deve impedir a ação principal — só loga o erro.
  if (error) console.error("Erro ao gravar auditoria_admin:", error);
}
