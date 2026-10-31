# Auditoria de publicação e comercialização — 30/10/2026

## Resultado e limites

Correções locais implementadas e verificadas com dados sintéticos. Não houve commit, push, deploy, migração ou alteração de dados de produção. Nenhum vídeo privado foi aberto, reproduzido ou baixado; nenhum documento pessoal foi inspecionado. A imagem não rastreada que já existia em `public/` foi preservada.

**A plataforma ainda não realiza vendas:** `/checkout/[slug]` é uma demonstração, com botão desabilitado. Não foi encontrada integração operacional CCBill, callback de pagamento ou webhook que registre uma compra aprovada. Aprovação comercial da conta CCBill não foi verificada. Publicar no catálogo não significa habilitar cobrança.

## Problemas encontrados e corrigidos

1. **Exclusão da biblioteca apagava R2 antes do banco.** Uma referência ou FK podia impedir a remoção do registro depois de seus bytes já terem sido apagados. A rota também removia participantes, mas não categorias. Agora os dois vínculos e o registro são removidos em transação, com recibo de auditoria; R2 somente é acionado após o commit. Falha de banco/auditoria não apaga arquivos.
2. **Permissão e confirmação insuficientes na API de exclusão.** Agora somente OWNER/ADMIN de workspace ativo podem excluir, mediante JSON com `confirmed: true` e validação de origem. OPERATOR e membros comuns não podem excluir. A interface mantém confirmação explícita, impede envio simultâneo, atualiza a lista e informa o resultado.
3. **Ausência de proteção explícita de dependências na biblioteca.** A exclusão agora bloqueia mídia usada como vídeo completo, teaser ou capa em qualquer produto, inclusive rascunhos e arquivados; histórico de distribuição; arquivos compartilhados; pastas e documentos protegidos de participantes; uploads em andamento. A mensagem orienta administrar o produto em Videos for Sale. Compras, consentimentos e documentos não são apagados.
4. **Falha R2 sem estado de recuperação confiável.** A auditoria registra a limpeza como PENDING antes da chamada externa. Sucesso marca COMPLETED. Falha retorna sucesso da remoção da biblioteca acompanhado de aviso explícito de limpeza pendente, mantendo referências privadas apenas na auditoria do servidor. Esse recibo exige recuperação administrativa; não foi criado um worker automático de limpeza.
5. **Upload aceitava associação ao workspace sem exigir função administrativa nem workspace ativo.** As cinco rotas de upload agora reutilizam a autorização administrativa existente e validam origem/JSON. A listagem da biblioteca também exige acesso administrativo ao workspace ativo.
6. **Catálogo e mídia pública não filtravam explicitamente restrições de segurança.** Além do arquivamento feito pela moderação, agora REJECTED/SUSPENDED/REMOVED são filtrados diretamente do catálogo e dos resolvedores públicos. REJECTED também bloqueia novas sessões de reprodução autenticada e novas compras pelo serviço interno. Compras existentes continuam preservadas.
7. **Orientação de publicação pouco visível.** O editor informa como salvar rascunho e onde resolver identidade, participantes, consentimento e revisão. Os cartões mostram separadamente o estado comercial e o estado de revisão, sem redesenhar o painel.
8. **Ferramentas de validação desatualizadas.** O lint inspecionava bundles, snapshots e arquivos de skills gerados. Esses caminhos passaram a ser ignorados. Testes antigos de autenticação/publicação foram ajustados ao comportamento já existente: registro de cliente ativo, login de clientes legados, reaproveitamento de revisão para alterações de metadados e imagem de logo no e-mail. As regras de identidade/idade/consentimento não foram afrouxadas.

## Percurso auditado

| Etapa / rotas | Resultado |
| --- | --- |
| Login, sessão e painel administrativo | Hash, sessão, revogação, CSRF, recuperação e limites de tentativas cobertos por fixtures. Associação administrativa continua separada do cadastro de comprador. |
| `/api/media/multipart/{start,part-url,complete,abort}` e `/api/media/upload-url` | Função administrativa, workspace ativo e origem/JSON verificados. Testes exercitam início e conclusão, metadados obrigatórios e tamanho R2 divergente sem transferir arquivos. |
| `/api/media` e `/api/media/[id]` | Listagem protegida; exclusão confirmada, autorizada, transacional, com preservação de referências e limpeza R2 posterior ao commit. |
| `/api/store/products` e `/api/store/products/[id]` | Rascunho, edição, criação, slug duplicado, mudança de mídia e publicação cobertos pelos serviços reais com banco em memória. |
| `/api/store/products/compliance` e `/api/admin/compliance` | Identidade, idade na gravação, expiração, consentimento específico, direitos, revisão e bloqueios de moderação permanecem obrigatórios. |
| `/videos`, `/videos/[slug]`, `/api/storefront/videos/[slug]/[kind]` | Catálogo só considera publicação disponível e workspace/mídia válidos; resolver público permite teaser/capa, nunca vídeo completo. Restrições de segurança filtradas explicitamente. |
| `/checkout/[slug]` | Demonstração; não cobra, não registra pagamento nem libera conteúdo. |
| Biblioteca do comprador e `/api/account/videos/[id]/{watch,cover}` | PAID libera acesso; visitante, cliente sem compra e compra pendente/cancelada/reembolsada não liberam vídeo completo. Retirada comercial preserva acesso já adquirido, salvo restrição de segurança. |
| Reprodução autenticada | Autorização precede assinatura privada temporária; respostas sem cache. URLs emitidas anteriormente têm prazo de expiração, sem revogação imediata pelo aplicativo. |

## Validações

- Build Next.js: passou, incluindo geração das páginas e TypeScript. Banco real substituído por endereço local de teste durante o build.
- `npx.cmd tsc --noEmit`: passou.
- Lint dos arquivos auditados: **0 erros, 16 avisos** (inclui avisos preexistentes de imagens/itens sem uso). Verificação final adicional das últimas alterações também sem erros.
- Lint geral: **60 erros e 65 avisos** permanecem em outras áreas, principalmente distribuição, performers, onboarding e páginas de autenticação. Não foi declarado como aprovado.
- `scripts/test-auth.mjs`: **15 testes passaram**, sem envio real de e-mail ou acesso ao banco.
- `scripts/test-video-product.mjs`: preservação de mídia, datas, publicação e fusos passaram.
- `scripts/test-compliance.mjs`: conformidade, arquivamento/exclusão de produtos, permissões, histórico de compras, preservação e rollback passaram.
- `scripts/test-owner-publication.mjs` e `scripts/test-direct-publication.mjs`: rascunho/publicação, evidências reutilizadas, identidade, consentimentos, mudança de criador/mídia e bloqueios passaram.
- `scripts/test-create-product-flow.mjs`: formulário real, três uploads locais simulados, rascunho, recarga, publicação bloqueada com motivo e publicação após evidências válidas passaram; requisições limitadas a loopback.
- `scripts/test-store-delete-ui.mjs`: confirmação, cancelamento/ESC, foco, erro/repetição, dupla submissão, filtros e preservação passaram.
- Novos `scripts/test-media-delete.mjs` e `scripts/test-media-delete-ui.mjs`: API real com mocks e interface; confirmação, permissões, referências protegidas, categorias/participantes, rollback, concorrência, falha R2 e atualização da lista passaram.
- Novo `scripts/test-media-upload.mjs`: listagem por função e rotas reais de upload com R2 simulado passaram.
- Novo `scripts/test-store-purchase.mjs`: compra sintética pelo serviço interno, valor/moeda, idempotência, concorrência, desbloqueio, reembolso, agendamento e restrições passaram. Não representa transação CCBill.
- `scripts/test-video-access.mjs` e `scripts/test-media-preview.mjs`: autenticação, escopo, comprador e assinatura temporária passaram.
- `scripts/test-media-preview-ui.mjs` e `scripts/test-watch-video-ui.mjs`: player testado exclusivamente com vídeo WebM sintético local; controles, encerramento e renovação de URL passaram. Fullscreen nativo não foi exercitado.
- Quatro testes de `src/lib/media/video-metadata.test.ts`: passaram com elementos/metadados simulados.
- `scripts/test-homepage-banners.mjs`: regressão de permissões/preservação passou.
- `git diff --check`: passou.

As fixtures em memória são descartadas ao encerrar os testes. Não foram criados registros de teste em produção. A suíte de páginas legais dependente de servidor (`test-compliance-pages.mjs`) não foi concluída nesta execução: a tentativa inicial encontrou o servidor local indisponível. Integrações ManyVids e persistência PostgreSQL reais não foram executadas nesta auditoria.

## Arquivos alterados

- `app/[locale]/app/media/page.tsx`
- `app/api/media/[id]/route.ts`
- `app/api/media/route.ts`
- `app/api/media/upload-url/route.ts`
- `app/api/media/multipart/start/route.ts`
- `app/api/media/multipart/part-url/route.ts`
- `app/api/media/multipart/complete/route.ts`
- `app/api/media/multipart/abort/route.ts`
- `src/components/store/StoreVideos.tsx`
- `src/components/app/MediaPreviewModal.tsx`
- `src/lib/store/types.ts`
- `src/lib/store/public.ts`
- `src/lib/store/purchases.ts`
- `src/lib/compliance/service.ts`
- `eslint.config.mjs`
- `scripts/test-auth.mjs`
- `scripts/test-direct-publication.mjs`
- `scripts/test-media-delete.mjs` (novo)
- `scripts/test-media-delete-ui.mjs` (novo)
- `scripts/test-media-upload.mjs` (novo)
- `scripts/test-store-purchase.mjs` (novo)
- Este relatório.

## Pendências para venda e validação manual

1. Confirmar o estado real de aprovação da conta CCBill e os requisitos aplicáveis com a operadora. A auditoria técnica não equivale a aprovação da CCBill.
2. Implementar a integração autorizada de checkout e confirmação de pagamento no servidor, vinculando comprador/pedido/produto, valor, moeda e identificador único de transação. Validar autenticidade, repetição de notificações, cancelamento, estorno e reembolso antes de ativar cobrança.
3. Validar o ciclo em sandbox CCBill: seleção, checkout, retorno, notificação autenticada, compra persistida e liberação. Retorno do navegador sozinho não comprova pagamento.
4. Em staging com registros fictícios, verificar conectividade PostgreSQL/R2, FKs efetivas, política do bucket privado, CORS do upload, arquivos grandes, interrupção/retomada e comportamento após falha de conclusão multipart. Mocks não comprovam configuração de produção.
5. Validar manualmente a documentação legítima no fluxo protegido por um responsável autorizado, sem substituir evidências por dados inventados. Registros reais não foram inspecionados.
6. Validar acessibilidade visual e confirmação nativa de exclusão no navegador usado pela administradora, e fullscreen do player com mídia sintética.
7. Tratar os erros globais de lint em uma revisão das áreas correspondentes. Nenhum deploy foi realizado.

Para operar: criar produto → selecionar criador → preencher informações → concluir uploads → Save Draft → resolver registros pendentes em Safety & Compliance → Publish. Para retirar uma venda com histórico, usar Remove from Sale; não tentar apagar o arquivo da biblioteca.
