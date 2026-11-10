# Ajustes administrativos — exclusão, publicação e perfil

## Resultado e limites

Implementação local concluída, com build e testes direcionados aprovados. Nenhum commit, push, deploy, migration, recurso pago, escrita no Neon principal ou alteração no R2 de produção foi realizado. Nenhum vídeo, documento ou consentimento real foi excluído ou modificado. Os arquivos não rastreados anteriores foram preservados.

A homologação com PostgreSQL e armazenamento reais isolados permanece pendente. O incidente relatado na Hostinger não pode ser atribuído com certeza a uma causa sem o SHA implantado, a mensagem/horário da tentativa e os logs do servidor.

## 1. Exclusão: defeitos reproduzíveis e correção

- A loja usava a primeira associação de workspace do usuário. Uma associação MEMBER ou administrativa em workspace inativo podia ser escolhida antes de uma associação administrativa válida, bloqueando a operação. Agora usa a mesma seleção de associação administrativa ativa do fluxo de upload. Teste de regressão cobre os dois casos.
- A consulta que determina se o botão Delete Permanently pode aparecer ignorava erros. Uma falha HTTP/permissão/rede deixava o botão oculto sem explicação. Agora a mensagem aparece com Retry deletion check.
- Os testes confirmaram requisição DELETE após confirmação, recusa sem permissão, prevenção de duplo envio, rollback quando a auditoria falha e atualização imediata da galeria.
- Arquivar continua preservando produto, compras, documentos, consentimentos, auditoria e mídias. A lista Active deixa de mostrar o item; Archived/All permite consultá-lo.
- Exclusão definitiva do produto continua bloqueada se houver compras/histórico ou registros de conformidade. Produtos temporários elegíveis podem ser removidos, com auditoria. Mídias da biblioteca e objetos R2 são preservados em ambos os casos. Não foi criada exclusão de arquivos nem alterada política de retenção.

Esses são defeitos locais comprovados pelos testes. Não foi executada uma exclusão no banco principal para tentar reproduzir o relato de produção.

## 2. Publicação na mesma tela

O editor reutiliza a vinculação revisada da criadora principal, mesmo com outros perfis cadastrados. Uploads e novos produtos recebem essa associação sem criar outra pessoa ou duplicar documentos. A identidade já verificada permanece separada da aprovação do vídeo.

O título pode ser preenchido a partir do nome do arquivo; a categoria inicial é Original. O editor mostra a capa selecionada. Vídeo completo, teaser e capa continuam necessários; o botão Publish for Sale fica indisponível enquanto esses arquivos não estiverem associados e durante o upload.

No primeiro Publish, um rascunho é salvo automaticamente. Se faltar revisão, o editor mantém o formulário e apresenta Review and publish here na mesma página. A data real da gravação e a confirmação da revisão permanecem necessárias. Documentos existentes são sugeridos, sem afirmar automaticamente que cobrem aquele conteúdo. Approve and Publish chama a API existente de conformidade e, após confirmação do servidor, a API de publicação; a galeria é atualizada.

Mudanças não salvas bloqueiam a aprovação pela seção integrada até salvar o rascunho atual. A edição fica bloqueada durante a revisão para evitar publicar uma versão diferente da que está sendo confirmada. Falhas de publicação preservam o formulário e apresentam a mensagem do backend.

Participantes adicionais continuam exigindo identidade, maioridade, consentimento específico e revisão apropriada. O fluxo simplificado de criadora única recusa essa situação e mantém disponível a administração específica já existente em Safety & Compliance; não foi criado um atalho que aprove outras pessoas automaticamente.

A investigação anterior do rascunho existente encontrou arquivos íntegros, mas ausência de consentimento e revisão específicos. Esse produto real não foi publicado nem alterado nesta etapa. A identificação automática resolve preenchimento repetitivo; não transforma documentação genérica em autorização para qualquer vídeo.

## 3. Perfil e avatar

- Cabeçalhos público e administrativo usam avatar circular, iniciais/ícone padrão, nome no desktop e apresentação compacta no celular.
- O menu mantém My Account, My Videos, Settings quando administrativo e a saída pelo endpoint de sessão já existente. Inclui Change profile photo.
- A conta permite enviar JPG, PNG ou WebP de até 2 MB. O servidor verifica sessão, origem, limite e assinatura do arquivo; SVG é recusado.
- A foto é servida somente para a própria sessão autenticada, sem URL pública de armazenamento e sem cache compartilhado. O menu recarrega após a alteração e mantém fallback se a imagem falhar.
- Usa o cliente R2 e o registro imutável AuditLog existentes. Cada versão tem objeto próprio e um evento PROFILE_PHOTO_UPDATED guarda sua referência. Não há nova autenticação, tabela ou migration. Nenhuma foto antiga é apagada; a referência atual depende da preservação desse histórico de conta.

## 4. Testes executados

| Teste | Resultado / alcance |
| --- | --- |
| `scripts/test-compliance.mjs` | Passou: associação administrativa ativa, exclusão/arquivamento, permissões, origem, retenção, compras, auditoria, concorrência e rollback com banco simulado. |
| `scripts/test-store-delete-ui.mjs` | Passou: confirmação, cancelamento/ESC, erro/repetição, erro antes oculto, exclusão temporária, filtros e atualização da galeria em navegador local. |
| `scripts/test-create-product-flow.mjs` | Passou: três uploads sintéticos, associação automática entre vários perfis, rascunho, bloqueio pendente, formulário de revisão na mesma tela, POST real de aprovação, publicação pela API e galeria. |
| `scripts/test-automatic-creator.mjs` | Passou: criadora única válida; participante adicional sem documentos; identidade incompleta; revisão pendente; preservação dos registros e isolamento do vínculo de upload. |
| `scripts/test-creator-verification-ui.mjs` | Passou: documentos sugeridos, confirmação não marcada, preservação do formulário, erros, atualização e recuperação em navegador. |
| `scripts/test-media-upload.mjs` | Passou: handlers reais, função administrativa, workspace ativo, origem, metadados e tamanho, com R2 simulado. |
| `scripts/test-profile.mjs` | Passou: APIs reais, sessão, origem, tamanho/tipo, acesso restrito ao próprio usuário, versões retidas e falha de banco. |
| `scripts/test-account-menu-ui.mjs` | Passou: avatar padrão/personalizado, nome, upload, recarga, links, saída e Escape; larguras 1280, 390 e 320 px. Capturas em `.runtime/account-menu-qa/`. |
| TypeScript e build Next | Passaram. Um único build final desta etapa, com DATABASE_URL fictícia local, sem acesso ao Neon. |
| ESLint direcionado | Sem erros; avisos sobre uso de imagens HTML. Não foi declarado lint global aprovado. |
| `git diff --check` | Passou. |

Os testes integrados usam navegador/componentes/APIs/serviços reais, mas persistência em memória e transporte de armazenamento simulado. Não validam FKs reais, persistência após reinício do servidor, leitura por conexão PostgreSQL independente, CORS de bucket real, limites da Hostinger ou o deploy ativo. Não foram executados testes de escrita no Neon principal.

## 5. Ambiente Neon e pendências

Não foi possível listar branches: não há credencial de gerenciamento Neon/CLI autenticada/configuração de staging disponível. A integração Neon foi encontrada, mas ainda não está instalada/conectada. Isso não comprova ausência de uma branch de testes na conta.

A alternativa está preparada em `docs/AMBIENTE_TESTES_NEON.md`: verificar branches e custos pelo gerenciamento; preferir schema-only, sem dados pessoais, endpoint/credenciais próprios e fixtures sintéticas. Nenhuma branch ou bucket foi criado. Um teste real de upload também requer bucket de teste separado do R2 principal.

Continuam pendentes: conexão de gerenciamento Neon, comprovação do isolamento e das cotas/custos, homologação PostgreSQL/R2 de teste, verificação humana das evidências reais por vídeo e confirmação do SHA/logs da Hostinger.

## 6. Arquivos

Aplicação, incluindo a identificação automática da etapa anterior reutilizada neste trabalho:

- `app/(storefront)/conta/page.tsx`
- `app/api/account/profile/route.ts`
- `app/api/account/profile/photo/route.ts`
- `app/api/media/multipart/start/route.ts`
- `components/account/AccountMenu.tsx`
- `components/account/AccountMenu.module.css`
- `components/account/ProfilePhotoForm.tsx`
- `components/compliance/VideoApprovalCard.tsx`
- `components/storefront/Storefront.tsx`
- `src/components/app/AppHeader.tsx`
- `src/components/app/UploadManagerProvider.tsx`
- `src/components/store/InlineVideoReview.tsx`
- `src/components/store/PermanentlyDeleteVideo.tsx`
- `src/components/store/StoreVideos.tsx`
- `src/lib/auth/profile.ts`
- `src/lib/compliance/service.ts`
- `src/lib/store/admin.ts`
- `src/lib/store/product-creator.ts`

Testes criados/atualizados: `test-compliance.mjs`, `test-store-delete-ui.mjs`, `test-create-product-flow.mjs`, `test-automatic-creator.mjs`, `test-creator-verification-ui.mjs`, `test-profile.mjs`, `test-account-menu-ui.mjs`. O teste existente `test-media-upload.mjs` foi executado sem alteração.

Documentação nova desta etapa: este relatório e `docs/AMBIENTE_TESTES_NEON.md`. Documentos não rastreados que já existiam foram preservados.

## 7. Prontidão

O código está preparado para revisão conjunta, sem dependências novas ou alterações de schema. Ainda não está certificado para um deploy de produção: falta a homologação com persistência real isolada e a confirmação da hospedagem. Nenhum commit, push ou deploy foi realizado.
