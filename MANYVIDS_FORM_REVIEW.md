# ManyVids — revisão de experiência e comportamento

## Problemas encontrados

- Tags eram strings separadas por vírgulas; o usuário não via a biblioteca remota nem distinguia sugestões de tags existentes.
- A duração padrão de teaser era 30, embora o executor aceite apenas o início no fluxo automático. Isso bloqueava o formulário desde a configuração padrão.
- O campo de frame alterava o estado, mas não posicionava o elemento de vídeo. Além disso, uma escolha local era enviada como frame remoto, capacidade ainda bloqueada.
- A capa personalizada usava um select extenso sem busca ou priorização de contexto.
- Efeitos da página apagavam os metadados ao mudar selectedMediaId; outro bloco reinicializava opções por vídeo/conta. A key por conta também remontava o componente. Objetos chegando novamente podiam produzir seleções intermediárias vazias e perda de edição.
- O formulário considerava a primeira conta ManyVids do criador em vez da conta efetivamente selecionada.
- Opções indisponíveis eram oferecidas como editáveis e o bloqueio só era descoberto depois.

## Correções

1. **Tags:** autocomplete com debounce, cancelamento e descarte de respostas antigas; navegação por teclado, seleção, remoção e prevenção de IDs duplicados. Estado e payload novos contêm id remoto e label. Busca usa a rota local autenticada /api/distribution/manyvids/tags, que reutiliza exclusivamente o endpoint já existente /tags/partial/{query}/tags. O servidor revalida ID/label antes do upload. Strings legadas continuam compatíveis, mas precisam corresponder a tags reais; nunca viram IDs arbitrários. A ação Create new tag aparece desabilitada quando não há correspondência exata.
2. **Ações fora de contexto:** retirados os botões de cadastrar mídia e atualizar catálogo. Catálogo atualiza ao carregar, ao voltar o foco e no evento interno de mídia atualizada, sem reescrever o formulário.
3. **Frame:** o tempo informado posiciona o vídeo; a navegação do vídeo atualiza o tempo. A prévia local fica em previewFrameTime, separada do payload remoto. A tela explica que a capa publicada continua sendo escolhida automaticamente. A prévia não bloqueia a publicação automática.
4. **Imagem personalizada:** seletor visual JPEG/PNG com nome, preview, busca, seleção/remoção e carregamento de mais resultados. Assets associados ao performer vêm primeiro; outros assets autorizados do catálogo do criador continuam pesquisáveis. O aviso de prévia apenas local é mostrado antes de preencher. Publicar com imagem personalizada continua indisponível.
5. **Teaser:** geração automática contém somente source e startTime. Campo Duration removido. A validação usa início finito, >= 0 e menor que a duração do vídeo. Opção personalizada aparece desabilitada.
6. **Mídia antiga:** mensagem curta indicando necessidade de extração. Não foi criado um botão sem implementação real. O pipeline existente de uploads novos mede duração/dimensões antes de iniciar e verifica o tamanho no armazenamento antes de marcar a mídia como pronta; seus testes passaram. Não houve backfill ou alteração no banco nesta revisão.
7. **Rascunhos:** valores editados guardados por criador/vídeo na sessão da aba, sem cookies, tokens, URLs assinadas ou conteúdo de documentos. Re-fetch, troca de conta/locale, remontagem e retorno ao mesmo vídeo não sobrescrevem título, descrição, preço, tags, opções ou participantes. Rascunhos incompletos são preservados; validação rigorosa ocorre ao publicar. Trocas conscientes de criador/vídeo continuam usando seleções separadas; a seleção global da página não foi convertida em uma preferência persistente. Se o navegador recriar a página, o rascunho reaparece ao selecionar novamente o mesmo vídeo. Publicação concluída mantém o reset intencional existente.
8. **Capacidades:** documentação e teaser personalizado aparecem indisponíveis antes do preenchimento; agendamento é desabilitado quando ManyVids participa da distribuição. Quando ManyVids não está selecionado, os controles compartilhados mantêm o comportamento existente. Nenhum executor Instagram/Fanvue foi alterado.
9. **Idiomas:** todas as novas mensagens no Next-Intl existente, em en-US, pt-BR, es-ES, fr-FR e cs-CZ.

## Ainda indisponível / dependências remotas

| Capacidade | Comportamento atual | Dependência |
| --- | --- | --- |
| Criar tag | Ação explícita desabilitada | Endpoint e contrato de criação comprovados |
| Publicar frame exato | Prévia local funciona; envio automático continua explícito | Aplicação remota do frame selecionado |
| Publicar thumbnail personalizada | Busca e seleção servem para prévia; aviso antecipado e publicação desse modo bloqueada | Upload e associação remota da imagem |
| Teaser personalizado | Opção desabilitada | Transferência/associação remota completa |
| Duração exata do teaser | Sem campo editável; ManyVids define a duração | Controle remoto de duração comprovado |
| Documentos de co-performers | Opção desabilitada; rascunhos anteriores continuam visíveis | Upload/associação e confirmação remota dos documentos |
| Agendamento | Indisponível para ManyVids | Contrato remoto comprovado |
| Reparar mídia antiga | Mensagem clara; sem ação fictícia | Extração real e atualização autorizada, em implementação separada |

Store continua sendo o destino suportado. Premium/Club permanecem indisponíveis. Nenhum endpoint remoto foi inventado.

## Arquivos alterados/criados nesta revisão

- app/[locale]/app/distribution/page.tsx
- app/api/distribution/manyvids/tags/route.ts (novo)
- src/components/app/ManyVidsPublishingOptions.tsx
- src/components/app/ManyVidsTagPicker.tsx (novo)
- src/components/app/useManyVidsDraft.ts (novo)
- src/lib/platforms/manyvids/http/types.ts
- src/lib/platforms/manyvids/http/metadata.ts
- src/lib/platforms/manyvids/http/local-options.ts
- src/lib/platforms/manyvids/http/http.test.ts
- i18n/messages/en-US.json
- i18n/messages/pt-BR.json
- i18n/messages/es-ES.json
- i18n/messages/fr-FR.json
- i18n/messages/cs-CZ.json
- scripts/test-manyvids-form.mjs (novo)
- MANYVIDS_FORM_REVIEW.md (este relatório)

## Verificações

- Typecheck: aprovado, inclusive após regenerar os tipos de rotas ao final do build.
- Build Vinext: aprovado.
- Testes HTTP existentes + regressão de tags: 16 aprovados, transportes simulados.
- Testes de metadados: 4 aprovados.
- Chromium isolado: autocomplete, ID/label, respostas antigas, duplicatas, criação desabilitada, frame real em 10 segundos, teaser sem duração, filtro de imagens, refresh, cinco locales, retorno ao vídeo e reload com rascunho incompleto preservado. Aprovado.
- Os testes de interface interceptam todas as APIs e não usam perfil autenticado. Vídeo de teste é gerado localmente, sem download de mídia do usuário.
- Lint dirigido: nenhum erro novo nos arquivos auxiliares. Permanecem 7 erros de hooks/imutabilidade e 13 avisos na página antiga de distribuição; a prévia mantém o aviso existente sobre img.
- Catálogos dos cinco idiomas com as mesmas chaves; 735 mensagens formatadas sem erro; novos componentes sem textos literais de UI.
- Nenhuma publicação real, deploy, migração ou reparo automático de mídia foi executado.
