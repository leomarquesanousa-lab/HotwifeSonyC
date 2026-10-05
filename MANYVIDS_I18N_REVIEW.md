# ManyVids — revisão de internacionalização

Locales: en-US (referência), pt-BR, es-ES, fr-FR e cs-CZ.

## Mudanças desta revisão

- Next-Intl existente: namespaces manyVids e videoUploadMetadata nos cinco JSONs já carregados por i18n/request.ts. Nenhum carregador ou sistema de tradução paralelo.
- Formulário, metadados, placeholders, validações, buscas, bloqueios, prévias e progresso usam traduções. Bloqueios e erros de busca ficam em estado como chaves e acompanham mudanças de locale.
- Datas de termos assinados e números da biblioteca usam useFormatter. Nomes dos arquivos, pessoas, documentos enviados pelo usuário, IDs e produtos são preservados.
- O catálogo local retorna agreementDate como dado; o rótulo de termo assinado é apresentado no idioma ativo. A API de opções foi revisada e não precisou de alteração.
- Erros do executor são apresentados por código traduzido, com fallback traduzido para códigos desconhecidos. Inclui VIDEO_METADATA_REQUIRED e REMOTE_CONFIRMATION_TIMEOUT.
- O erro recente de leitura de metadados no upload passou a ser um código interno traduzido na interface; testes existentes foram ajustados ao código.
- Tags continuam no campo existente separado por vírgulas. Não existem controles separados Add tag/Custom tag neste formulário; não foram adicionadas funcionalidades.

## Arquivos alterados nesta revisão

- app/[locale]/app/distribution/page.tsx
- src/components/app/ManyVidsPublishingOptions.tsx
- src/lib/platforms/manyvids/http/local-options.ts
- src/components/app/UploadManagerProvider.tsx
- src/lib/media/read-video-metadata.ts
- src/lib/media/video-metadata.test.ts
- i18n/messages/en-US.json
- i18n/messages/pt-BR.json
- i18n/messages/es-ES.json
- i18n/messages/fr-FR.json
- i18n/messages/cs-CZ.json
- MANYVIDS_I18N_REVIEW.md (este registro)

## Ocorrências preservadas fora do escopo

A busca em app/**/*.tsx e src/components/**/*.tsx encontrou os textos abaixo. Dicionários antigos dentro das páginas já selecionam idioma; sua presença em português não significa vazamento no modo inglês. Foram preservados para não refatorar outras telas ou Instagram/Fanvue. Entradas espanholas com palavras iguais às portuguesas foram descartadas.

| Arquivo e linha | Texto encontrado | Motivo para preservar |
| --- | --- | --- |
| `app/[locale]/app/distribution/page.tsx:282` | Não foi possível carregar as opções de publicação. | Dicionário legado selecionado por locale; preservado para não refatorar telas antigas. |
| `app/[locale]/app/distribution/page.tsx:282` | Selecione um vídeo antes de gerar com IA. | Dicionário legado selecionado por locale; preservado para não refatorar telas antigas. |
| `app/[locale]/app/distribution/page.tsx:282` | Não foi possível gerar a legenda. | Dicionário legado selecionado por locale; preservado para não refatorar telas antigas. |
| `app/[locale]/app/distribution/page.tsx:282` | Legenda gerada por IA. Revise antes de publicar. | Dicionário legado selecionado por locale; preservado para não refatorar telas antigas. |
| `app/[locale]/app/distribution/page.tsx:282` | Selecione pelo menos uma plataforma antes de gerar legendas por plataforma. | Dicionário legado selecionado por locale; preservado para não refatorar telas antigas. |
| `app/[locale]/app/distribution/page.tsx:282` | Não foi possível gerar legendas por plataforma. | Dicionário legado selecionado por locale; preservado para não refatorar telas antigas. |
| `app/[locale]/app/distribution/page.tsx:282` | A IA gerou legendas específicas por plataforma. Revise antes de publicar. | Dicionário legado selecionado por locale; preservado para não refatorar telas antigas. |
| `app/[locale]/app/distribution/page.tsx:282` | Selecione um vídeo. | Dicionário legado selecionado por locale; preservado para não refatorar telas antigas. |
| `app/[locale]/app/distribution/page.tsx:282` | Escolha a data e o horário da publicação. | Dicionário legado selecionado por locale; preservado para não refatorar telas antigas. |
| `app/[locale]/app/distribution/page.tsx:282` | Falha ao publicar no Instagram. | Dicionário legado selecionado por locale; preservado para não refatorar telas antigas. |
| `app/[locale]/app/distribution/page.tsx:282` | Carregando área de publicação... | Dicionário legado selecionado por locale; preservado para não refatorar telas antigas. |
| `app/[locale]/app/distribution/page.tsx:282` | Publicar em Todo Lugar | Dicionário legado selecionado por locale; preservado para não refatorar telas antigas. |
| `app/[locale]/app/distribution/page.tsx:282` | Escolher um vídeo | Dicionário legado selecionado por locale; preservado para não refatorar telas antigas. |
| `app/[locale]/app/distribution/page.tsx:282` | Pronto para publicar | Dicionário legado selecionado por locale; preservado para não refatorar telas antigas. |
| `app/[locale]/app/distribution/page.tsx:282` | vídeo disponível | Dicionário legado selecionado por locale; preservado para não refatorar telas antigas. |
| `app/[locale]/app/distribution/page.tsx:282` | Selecione um vídeo | Dicionário legado selecionado por locale; preservado para não refatorar telas antigas. |
| `app/[locale]/app/distribution/page.tsx:282` | Legenda e Publicação | Dicionário legado selecionado por locale; preservado para não refatorar telas antigas. |
| `app/[locale]/app/distribution/page.tsx:282` | Gerar com IA | Dicionário legado selecionado por locale; preservado para não refatorar telas antigas. |
| `app/[locale]/app/distribution/page.tsx:282` | A IA usa o nome do vídeo, seu contexto e as plataformas selecionadas para sugerir uma legenda e hashtags. | Dicionário legado selecionado por locale; preservado para não refatorar telas antigas. |
| `app/[locale]/app/distribution/page.tsx:282` | Gerar por plataforma | Dicionário legado selecionado por locale; preservado para não refatorar telas antigas. |
| `app/[locale]/app/distribution/page.tsx:282` | Publicar agora | Dicionário legado selecionado por locale; preservado para não refatorar telas antigas. |
| `app/[locale]/app/distribution/page.tsx:282` | Publicação agendada | Dicionário legado selecionado por locale; preservado para não refatorar telas antigas. |
| `app/[locale]/app/distribution/page.tsx:282` | Selecionar Plataformas | Dicionário legado selecionado por locale; preservado para não refatorar telas antigas. |
| `app/[locale]/app/distribution/page.tsx:282` | Escolha os destinos desta publicação. | Dicionário legado selecionado por locale; preservado para não refatorar telas antigas. |
| `app/[locale]/app/distribution/page.tsx:282` | Resumo da Publicação | Dicionário legado selecionado por locale; preservado para não refatorar telas antigas. |
| `app/[locale]/app/distribution/page.tsx:282` | Escolher vídeo | Dicionário legado selecionado por locale; preservado para não refatorar telas antigas. |
| `app/[locale]/app/distribution/page.tsx:282` | Escolha uma mídia da biblioteca deste criador. | Dicionário legado selecionado por locale; preservado para não refatorar telas antigas. |
| `app/[locale]/app/distribution/page.tsx:282` | Nenhum vídeo encontrado | Dicionário legado selecionado por locale; preservado para não refatorar telas antigas. |
| `app/[locale]/app/distribution/page.tsx:282` | Agendar publicação | Dicionário legado selecionado por locale; preservado para não refatorar telas antigas. |
| `app/[locale]/app/distribution/page.tsx:282` | Horário da publicação | Dicionário legado selecionado por locale; preservado para não refatorar telas antigas. |
| `app/[locale]/app/distribution/page.tsx:282` | outra(s) publicação(ões) permanecem na fila. | Dicionário legado selecionado por locale; preservado para não refatorar telas antigas. |
| `app/[locale]/app/distribution/page.tsx:327` | Vídeo publicado como Reel | Dicionário legado selecionado por locale; preservado para não refatorar telas antigas. |
| `app/[locale]/app/distribution/page.tsx:329` | Imagem ou vídeo publicado nos Stories | Dicionário legado selecionado por locale; preservado para não refatorar telas antigas. |
| `app/[locale]/app/distribution/page.tsx:333` | O Reel do Instagram exige um vídeo. Selecione um vídeo ou escolha Post/Story. | Dicionário legado selecionado por locale; preservado para não refatorar telas antigas. |
| `app/[locale]/app/distribution/page.tsx:335` | Post e Story agendados ainda precisam salvar o formato junto da publicação. Por enquanto, use Publicar agora para Post/Story. | Dicionário legado selecionado por locale; preservado para não refatorar telas antigas. |
| `app/[locale]/app/distribution/page.tsx:438` | Selecionar todas | Dicionário legado selecionado por locale; preservado para não refatorar telas antigas. |
| `app/[locale]/app/performers/page.tsx:133` | Gerencie performers, informações de conformidade, documentos e relações de conteúdo. | Dicionário legado selecionado por locale; preservado para não refatorar telas antigas. |
| `app/[locale]/app/performers/page.tsx:140` | Atualizar | Dicionário legado selecionado por locale; preservado para não refatorar telas antigas. |
| `app/[locale]/app/performers/page.tsx:144` | Adicione seu primeiro performer para começar a organizar documentos de conformidade e conteúdos relacionados. | Dicionário legado selecionado por locale; preservado para não refatorar telas antigas. |
| `app/[locale]/app/performers/page.tsx:156` | Crie um perfil de performer para organizar conformidade, documentos e relações de mídia. | Dicionário legado selecionado por locale; preservado para não refatorar telas antigas. |
| `app/[locale]/app/platforms/page.tsx:317` | Atualizar conexões | Dicionário legado selecionado por locale; preservado para não refatorar telas antigas. |
| `app/[locale]/app/platforms/page.tsx:350` | A conexão foi feita, mas não foi possível gerar o token de longa duração. | Dicionário legado selecionado por locale; preservado para não refatorar telas antigas. |
| `app/[locale]/app/platforms/page.tsx:365` | Use um nome fácil para identificar esta conta na hora de publicar. | Dicionário legado selecionado por locale; preservado para não refatorar telas antigas. |
| `app/[locale]/onboarding/platforms/page.tsx:233` | Atualizar conexÃµes | Dicionário legado selecionado por locale; preservado para não refatorar telas antigas. |
| `app/[locale]/onboarding/platforms/page.tsx:256` | A autorizaÃ§Ã£o do Instagram foi concluÃ­da, mas a conta conectada ainda nÃ£o apareceu. Use Atualizar conexÃµes uma vez. Se continuar desconectada, serÃ¡ necessÃ¡rio verificar a resposta de /api/platforms. | Dicionário legado selecionado por locale; preservado para não refatorar telas antigas. |
| `app/[locale]/onboarding/platforms/page.tsx:279` | Conecte o Reddit para publicar em comunidades autorizadas. | Dicionário legado selecionado por locale; preservado para não refatorar telas antigas. |
| `app/[locale]/onboarding/platforms/page.tsx:290` | O Facebook autorizou a conta, mas nÃ£o foi possÃ­vel gerar o token de acesso. Tente novamente. | Dicionário legado selecionado por locale; preservado para não refatorar telas antigas. |
| `app/[locale]/onboarding/platforms/page.tsx:291` | O Facebook foi conectado, mas nÃ£o foi possÃ­vel gerar o token de longa duraÃ§Ã£o. Tente novamente. | Dicionário legado selecionado por locale; preservado para não refatorar telas antigas. |
| `app/[locale]/onboarding/platforms/page.tsx:306` | O Instagram foi conectado, mas nÃ£o foi possÃ­vel gerar o token de longa duraÃ§Ã£o. | Dicionário legado selecionado por locale; preservado para não refatorar telas antigas. |

## Strings técnicas preservadas no backend

Estas mensagens já existiam e continuam no contrato interno das APIs. A interface revisada usa os códigos e suas traduções, não estes textos. Foram preservadas para limitar a revisão à apresentação e não alterar o executor/protocolo.

| Arquivo | Texto interno preservado |
| --- | --- |
| app/api/distribution/execute/manyvids/route.ts | Não foi possível registrar o resultado. Revise a publicação antes de tentar novamente. |
| app/api/distribution/route.ts | Esta mídia antiga precisa de extração de metadados antes de publicar no ManyVids. Nenhuma distribuição foi criada. |
| app/api/media/multipart/start/route.ts | O vídeo precisa de duração e dimensões válidas antes de iniciar o upload. Atualize a página e selecione o arquivo novamente. |
| app/api/media/multipart/complete/route.ts | Duração e dimensões estão ausentes. O vídeo não foi marcado como pronto para publicação. |
| app/api/media/multipart/complete/route.ts | O tamanho no armazenamento não corresponde ao arquivo original. O vídeo não está pronto para publicação. |

Também há textos antigos em inglês no upload genérico e nas rotinas de thumbnail/Instagram da página de distribuição. Não foram refatorados nesta revisão do novo ManyVids. O dicionário antigo do onboarding apresenta caracteres corrompidos (por exemplo, Atualizar conexÃµes); isso requer uma correção separada de codificação.

## Validação

- Typecheck: aprovado.
- Build Vinext: aprovado; tipos de rotas regenerados em seguida.
- Igualdade de chaves e formatação ICU nos cinco locales: aprovada.
- 20 renderizações estáticas locais, cobrindo geração/customização e performers por conta/documentos: aprovadas, sem chamadas de rede.
- 81 referências literais de tradução conferidas com o catálogo inglês.
- Inspeção manual do formulário e painel de metadados, complementada por varredura AST: nenhum texto literal de UI no ManyVidsPublishingOptions e nenhum literal português no painel ManyVids.
- Quatro testes existentes de metadados: aprovados.
- Lint dos componentes auxiliares/helper/teste: zero erros; permanece o aviso preexistente de img na prévia.
- Lint da página de distribuição: oito erros preexistentes de hooks/imutabilidade e quatorze avisos. A dependência t agora aparece no aviso já existente do efeito que inicializa metadados; ampliar suas dependências poderia apagar edições do formulário, por isso não foi feita uma refatoração desse efeito.
- Verificação por renderização estática e leitura de código; não foi realizado teste interativo autenticado no navegador.

Nenhuma publicação, deploy, alteração no banco ou modificação no protocolo ManyVids/Instagram/Fanvue foi executada.
