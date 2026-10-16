# Política de retenção e descarte de dados pessoais (fotos e documentos)

> Rascunho interno de operação, não é parecer jurídico. Antes de divulgar publicamente aos
> condomínios clientes, recomenda-se revisão por um advogado especialista em LGPD. O objetivo
> aqui é deixar escrita a regra que hoje só existe na cabeça de quem construiu o sistema.

## 1. O que o AquiHabitto guarda hoje

| Dado | Quem | Onde | Observação |
|---|---|---|---|
| Foto de rosto (opcional) | Morador, visitante/prestador | bucket privado `pessoas-fotos` | Nunca obrigatória, nunca usada para reconhecimento facial automático. |
| Documento (CPF/RG, mascarado na tela) | Morador, visitante/prestador | coluna `documento` em `moradores`/`visitantes` | Mostrado mascarado por padrão nas listagens. |
| Anexos financeiros (boletos, notas, comprovantes) | Condomínio | bucket privado `financeiro-documentos` | Vinculados a um lançamento específico. |
| Anexos de proposta (orçamentos, laudos) | Fornecedor/condomínio | bucket privado `propostas-anexos` | Vinculados a uma proposta/manutenção/obra específica. |
| Registro de entrada/saída (portaria) | Visitante/prestador | tabela `portaria_registros` | Inclui horário do servidor (Brasília), nunca do dispositivo. |
| Trilha de auditoria | Qualquer alteração em moradores/veículos/portaria/visitantes | tabela `auditoria` | Snapshot completo (antes/depois) via trigger genérico. |

Todos os buckets acima já seguem o mesmo padrão: **privados, nunca públicos**, acesso só via URL
assinada e temporária, e isolados por `condominio_id` via RLS — um condomínio nunca acessa o
arquivo de outro, nem por engano.

## 2. O que NÃO existe hoje (e por que esta política é necessária)

Hoje nenhum desses dados é apagado automaticamente. Não há rotina de expurgo, nem botão de
"excluir meus dados" para um morador ou visitante que peça remoção. Tudo o que descreve a seção 3
abaixo é **processo manual**, a ser seguido por quem administra o condomínio (síndico) ou pela
operação do AquiHabitto quando solicitado — não é um mecanismo automático do sistema.

## 3. Regras de retenção recomendadas

Prazos abaixo são uma proposta operacional, não uma obrigação legal específica — não existe uma
lei federal única definindo prazo de guarda para foto de visitante de condomínio (ver pesquisa de
regulação na primeira seção deste relatório). A referência usada é o prazo prescricional cível
geral (3 anos, art. 206 do Código Civil) como limite máximo razoável, e prazos menores por bom
senso operacional:

- **Foto e documento de visitante/prestador avulso**: manter enquanto o registro de
  entrada/saída correspondente existir. Sugestão: condomínio pode optar por anonimizar/apagar a
  foto (mantendo o registro textual de entrada/saída, que tem valor de segurança patrimonial) após
  **90 dias** da visita, salvo se houver ocorrência/chamado vinculado.
- **Foto e documento de morador**: mantidos enquanto a pessoa for vinculada ao condomínio no
  sistema. Ao remover o morador (mudança, venda do imóvel), a foto e o documento completo devem
  ser apagados do Storage em até 30 dias — o registro textual básico (nome, unidade, período de
  residência) pode ser mantido por mais tempo para fins de histórico/auditoria, mas sem foto e sem
  documento completo.
- **Anexos financeiros e de propostas**: seguem o prazo fiscal/contábil aplicável ao condomínio
  (em geral 5 anos para documentos fiscais) — não é um dado pessoal sensível no mesmo sentido de
  foto/documento de pessoa física, então o critério aqui é fiscal, não de privacidade.
- **Trilha de auditoria**: não deve ser apagada por prazo — é o mecanismo de prestação de contas
  do síndico e de defesa em caso de disputa. Mantida indefinidamente, mas sem foto/documento
  bruto dentro dela (o trigger já grava o registro, incluindo colunas de documento — isso deve ser
  revisto se o condomínio pedir expurgo de dado pessoal: expurgar o dado nas tabelas-fonte não
  remove o snapshot já gravado em `auditoria`, que é histórico por natureza).

## 4. Direito do titular (LGPD) — o que fazer quando alguém pedir

Um visitante, prestador ou morador pode pedir acesso, correção ou exclusão dos seus dados
(art. 18 da LGPD). Hoje isso é 100% manual:

1. Pedido chega ao síndico ou à operação do AquiHabitto.
2. Localizar os registros pelo CPF (função `buscarPessoaPorDocumento` em `lib/pessoas.js`) ou nome.
3. Para exclusão: apagar a foto do bucket `pessoas-fotos` (há função auxiliar
   `obterUrlFotoAssinada`/caminho do arquivo já salvo em `foto_path`) e, se a pessoa não tiver mais
   vínculo ativo, remover ou anonimizar o cadastro.
4. A trilha de auditoria referente a essa pessoa permanece (ver seção 3) — informar ao titular que
   o histórico de entrada/saída e o registro de auditoria são mantidos por obrigação de segurança
   patrimonial e defesa do condomínio, mas sem foto nem documento completo após o expurgo.

Não existe hoje automação para nenhum desses passos — é checklist manual.

## 5. Próximo passo sugerido (fora do escopo desta implementação)

Quando houver prioridade, automatizar ao menos o item mais mecânico: uma rotina (cron, como o já
existente `app/api/cron/lembretes`) que apague a foto (não o registro) de visitantes com mais de
90 dias e sem ocorrência vinculada. Isso reduziria o volume de fotos de terceiros guardadas sem
necessidade, sem depender de alguém lembrar de fazer isso manualmente.
