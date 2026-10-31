# Cadastro e publicação simplificados — 30/10/2026

Alterações feitas sobre a auditoria local anterior. Sem commit, push, deploy, migração, mudança de configuração de produção ou alteração de vídeos/compras/documentos reais. Testes exclusivamente com fixtures e mídia sintética.

## Novo fluxo

1. Abrir **New Video** em Videos for Sale.
2. Preencher título, descrição, categoria e preço; enviar vídeo completo, teaser e capa na mesma tela.
3. Selecionar os participantes cadastrados. Se houver apenas um criador disponível, ele já vem selecionado. Participantes já vinculados à mídia ou aos registros do produto são reconhecidos e apresentados automaticamente.
4. Usar **Save Draft** para continuar depois ou **Publish for Sale** para verificar e publicar. Para um vídeo novo, Publish salva automaticamente um rascunho antes da tentativa de publicação. Uma pendência mantém o formulário e o produto salvo; repetir a tentativa não cria outro produto.
5. Quando os registros forem válidos e aplicáveis, o vídeo entra no catálogo sem outra tela de confirmação ou aprovação repetida.

O editor tem duas ações principais de gravação. Slug, data de publicação, destaque e criação de categoria ficam em **Advanced settings**, recolhido por padrão. O slug é gerado pelo título; categorias existentes podem ser selecionadas. O inglês atual da interface foi preservado — não foi introduzida uma nova configuração de idioma.

Na galeria, Publish e Unpublish atuam diretamente no produto. Uma falha na publicação pela galeria abre o editor para corrigir a pendência. As miniaturas, título, preço, estado comercial e estado de revisão continuam visíveis; edição e exclusão confirmada foram preservadas. A retirada comercial e a exclusão permanente continuam respeitando as proteções financeiras e legais da auditoria anterior.

## Verificações automáticas e limites

- O servidor verifica arquivos concluídos, workspace, tipos de mídia, separação de teaser/vídeo completo, preço e direitos administrativos. Capa e teaser são obrigatórios para publicar, mas podem ficar ausentes no rascunho. O rascunho mantém os requisitos mínimos atuais de informações e vídeo completo.
- Identidades e comprovação de maioridade válidas já registradas são reutilizadas pelas verificações existentes. Documentos vencidos, ausentes, rejeitados ou conflitantes continuam bloqueando.
- Consentimentos existentes são avaliados pelo produto, participante, direitos e fingerprint da mídia; não são copiados de uma autorização genérica ou de outro vídeo.
- Revisões válidas do mesmo conteúdo/participantes são reutilizadas, inclusive após editar metadados ou despublicar e republicar. Não foi adicionada nova aprovação manual.
- Mudanças de mídia, criador ou participantes são reavaliadas. A seleção de um participante não comprova identidade nem cria consentimento. Nenhum registro legal é sobrescrito ou removido pela seleção.
- A seleção adicional é registrada por produto usando o mecanismo existente de notas, sem mudar vínculos de mídias compartilhadas. Os participantes já conhecidos permanecem sujeitos às verificações mesmo se não forem selecionados novamente.
- Pendências aparecem na tela com mensagens específicas e acesso aos arquivos/documentação. Exemplos testados: capa ausente, teaser ausente, consentimento específico pendente, participante inválido e revisão de conteúdo pendente.
- Os controles de acesso ao vídeo completo, compras e permissões administrativas não foram ampliados.

## Logotipos

O logotipo do painel agora aponta para `/`, a home pública. O logotipo da confirmação de idade e o do onboarding também são clicáveis. Cabeçalho e rodapé públicos já apontavam para `/` e foram verificados. Tamanhos, imagens e classes visuais foram preservados.

O roteamento atual força inglês e URLs públicas sem prefixo de idioma. Foi mantida essa convenção. Não há seletor ativo de idioma a preservar; adicionar uma experiência multilíngue exigiria um trabalho separado de roteamento e tradução.

## Arquivos deste trabalho

| Arquivo | Alteração |
| --- | --- |
| `src/components/store/StoreVideos.tsx` | Tela única, participantes, categoria, opções recolhidas, dois botões principais, rascunho automático, Publish/Unpublish e feedback. |
| `src/lib/store/admin.ts` | Validação e persistência de participantes; capa/teaser obrigatórios para publicar; revisão reavaliada quando necessário. |
| `src/lib/store/product-fields.ts` | Validação do campo de participantes e preservação quando omitido. |
| `src/lib/store/product-creator.ts` | Associação por produto e reconhecimento de participantes existentes, sem alterar consentimentos. |
| `src/lib/store/types.ts` | Tipos dos participantes selecionados e conhecidos. |
| `src/lib/compliance/service.ts` | Participantes considerados no fingerprint, revisão e verificações; reutilização somente quando aplicável. |
| `app/api/store/products/compliance/route.ts` | Pré-verificação consistente com criador e participantes atuais. |
| `src/components/app/AppHeader.tsx` | Logotipo leva à home pública. |
| `components/compliance/AgeGate.tsx` | Logotipo clicável; confirmação de idade existente preservada. |
| `app/[locale]/onboarding/page.tsx` | Logotipo clicável, preservando a imagem. |
| `scripts/test-create-product-flow.mjs` | Fluxo real em loopback; nova tela, rascunho automático, publicação/despublicação e catálogo. |
| `scripts/test-owner-publication-ui.mjs` | Atualização das expectativas do formulário, sem evidências fabricadas. |
| `scripts/test-age-gate.mjs` | Expectativa alinhada à confirmação única que já existia; ESC, sessão e layout continuam testados. |
| `scripts/test-simplified-publication.mjs` | Novo teste de participantes, preservação, reutilização e bloqueios. |
| `scripts/test-logo-navigation.mjs` | Novo teste de navegação dos logotipos em desktop/celular. |
| Este relatório | Entrega e limites da validação. |

Os demais arquivos já modificados pela auditoria anterior permanecem no workspace e não foram descartados. A imagem não rastreada preexistente em `public/` não foi alterada.

## Resultados dos testes

- Build Next.js com webpack: passou, incluindo TypeScript e geração de páginas; DATABASE_URL substituída por endereço local fictício durante a validação.
- TypeScript (`npx.cmd tsc --noEmit`): passou após ajuste de tipos do reconhecimento de participantes.
- Lint dos arquivos deste trabalho: 0 erros, 4 avisos preexistentes de imagens/imports. O lint global não foi declarado aprovado; as pendências de outras áreas documentadas na auditoria anterior continuam fora desta alteração.
- `test-create-product-flow.mjs`: passou com o formulário e UploadManager reais, três uploads simulados, seleção de criador, categorias, rascunho, recarga, publicação elegível, preço no catálogo, edição, Publish/Unpublish e tentativa nova com salvamento automático. Repetir uma tentativa bloqueada não duplica o produto nem fabrica consentimento.
- `test-simplified-publication.mjs`: passou; seleção persistida por produto, participantes conhecidos reconhecidos, revisão válida reutilizada sem nova aprovação, bloqueios por capa/teaser/consentimento e participantes inválidos, histórico e mídias compartilhadas preservados, visitante sem compra bloqueado.
- `test-logo-navigation.mjs`: passou para painel, cabeçalho/rodapé públicos e confirmação de idade em larguras de 390 e 1280 pixels, sem carregar imagens privadas.
- `test-owner-publication.mjs`, `test-direct-publication.mjs`, `test-owner-publication-ui.mjs`, `test-video-product.mjs`: passaram; identidades, idade na gravação, expiração, consentimentos, revisão, alterações de mídia/criador e direitos mantidos.
- `test-compliance.mjs`, `test-store-delete-ui.mjs`, `test-media-delete.mjs`, `test-media-delete-ui.mjs`: passaram; autorização OWNER/ADMIN, confirmação, preservação financeira/legal, rollback e tratamento de falha R2 mantidos.
- `test-video-access.mjs`, `test-store-purchase.mjs`: passaram; compradores PAID, visitantes, pendências/cancelamentos/reembolsos e proteção de vídeo completo verificados com fixtures.
- `test-age-gate.mjs`: passou; confirmação existente obrigatória, sem bypass por ESC, controle de scroll, sessão e layout móvel preservados.
- `git diff --check`: passou.

## Pendências antes de disponibilizar

1. **CCBill continua pendente.** Publicar no catálogo prepara o vídeo; não habilita compras reais. Nenhuma integração de cobrança foi criada neste trabalho e os avisos no painel deixam isso explícito.
2. Concluir a integração e validação autorizada do checkout/sandbox CCBill antes de anunciar compras operacionais.
3. Fazer uma conferência manual em staging com arquivos e registros sintéticos, verificando PostgreSQL/R2 e a aparência no navegador da administradora. Mocks não comprovam configuração de produção.
4. Para conteúdo sem documentação válida, um responsável precisa completar os registros legítimos no fluxo protegido. O sistema não presume consentimento nem aprova documentação ausente para reduzir cliques.
5. Commit, push e deploy continuam por realizar, conforme solicitado.
