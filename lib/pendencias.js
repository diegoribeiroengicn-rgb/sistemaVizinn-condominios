// Server-only: aplica ou descarta uma pendência já aprovada/rejeitada.
// Por enquanto só cobre a tabela `membros` (Acessos/Permissões) — é o
// único recorte com aprovação pendente por agora (ver README).
export async function aplicarPendenciaMembro(supabaseAdmin, pendencia) {
  const { acao, registro_id: registroId, condominio_id: condominioId, dados_anteriores: antes, dados_novos: novos } =
    pendencia;

  if (acao === "criar") {
    const { userId, nome, email, telefone, papel, unidade, bloco, permissoes, requerAprovacao } = novos;
    const { error } = await supabaseAdmin.from("membros").insert({
      condominio_id: condominioId,
      user_id: userId,
      nome,
      email,
      telefone: telefone || null,
      papel,
      unidade: unidade || null,
      bloco: bloco || null,
      permissoes: permissoes || {},
      requer_aprovacao: Boolean(requerAprovacao),
    });
    if (error) throw error;
    return;
  }

  if (acao === "editar") {
    const { nome, telefone, papel, unidade, bloco, permissoes, requerAprovacao } = novos;
    const { error } = await supabaseAdmin
      .from("membros")
      .update({
        nome,
        telefone: telefone || null,
        papel,
        unidade: unidade || null,
        bloco: bloco || null,
        permissoes: permissoes || {},
        requer_aprovacao: Boolean(requerAprovacao),
      })
      .eq("id", registroId)
      .eq("condominio_id", condominioId);
    if (error) throw error;
    return;
  }

  if (acao === "excluir") {
    const { error } = await supabaseAdmin
      .from("membros")
      .delete()
      .eq("id", registroId)
      .eq("condominio_id", condominioId);
    if (error) throw error;
    if (antes?.user_id) {
      await supabaseAdmin.auth.admin.deleteUser(antes.user_id).catch(() => {});
    }
    return;
  }

  throw new Error(`Ação de pendência desconhecida: ${acao}`);
}

// Rejeição de "criar": o login já tinha sido criado antecipadamente (pra
// não guardar senha em texto puro na fila de pendências) — precisa ser
// removido junto, senão fica um login órfão sem acesso a nada mas ainda
// existente.
export async function descartarPendenciaMembro(supabaseAdmin, pendencia) {
  if (pendencia.acao === "criar" && pendencia.dados_novos?.userId) {
    await supabaseAdmin.auth.admin.deleteUser(pendencia.dados_novos.userId).catch(() => {});
  }
}
