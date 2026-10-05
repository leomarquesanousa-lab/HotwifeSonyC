# Video Metadata — diagnóstico e correção da ingestão

## Diagnóstico anterior às alterações

A publicação ManyVids mais recente no banco consultado é `d3daebea-cf5f-4cb3-9869-201075ae5135`, criada em `2026-09-17T03:33:52.089Z`. Relaciona o seguinte MediaAsset:

| Campo solicitado | Valor encontrado |
|---|---|
| id | `9d80edd3-a2e9-4936-bd2e-3e24a0b921cb` |
| originalFileName | `C0368.MP4` |
| mediaType | `VIDEO` |
| status | `UPLOADED` |
| storageProvider | `R2` |
| fileSize | `1384190108` bytes |
| durationSeconds | `null` |
| width | `null` |
| height | `null` |
| objectKey | `workspace/eb097a48-11c3-44ed-93de-c4bec42b1baa/performer/413f83aa-4b1f-4264-bcad-adc92a9d14c6/library/7200a7b5-2a25-4831-bf71-9f99b8a89086/media/9d80edd3-a2e9-4936-bd2e-3e24a0b921cb/C0368.MP4` |

O objectKey é a referência persistida solicitada, não uma URL assinada. Nenhuma credencial foi incluída.

**Causa específica:** os três campos durationSeconds, width e height estão ausentes. A primeira condição avaliada pelo executor é a duração nula; as dimensões também falhariam. fileSize está positivo e abaixo do limite de 10 GiB do executor. Não há indicação de falha do protocolo ManyVids: a recusa ocorre antes de claim, sessão ou upload remoto.

A publicação ainda está QUEUED, attemptCount=0 e sem externalPostId. O erro desta fase não é persistido em lastErrorCode porque a tentativa não foi iniciada pelo executor. Isso é consistente com o erro informado e com a mídia da publicação mais recente; não foi consultado um log HTTP de produção para correlacionar outro request.

As consultas SELECT, realizadas com default_transaction_read_only=on, encontraram **23 vídeos UPLOADED, todos com os três campos nulos**. Nenhum registro foi atualizado nesta tarefa.

## Onde o fluxo estava incompleto

1. `src/components/app/UploadManagerProvider.tsx` tinha acesso ao File e a file.size, mas não abria o vídeo para medir duração/dimensões antes do upload. Enviava ao start somente nome, MIME, tamanho e destino.
2. `app/api/media/multipart/start/route.ts` era o único produtor de MediaAsset.create encontrado no fluxo de mídia. Gravava os três metadados explicitamente como null.
3. `app/api/media/multipart/complete/route.ts` concluía as partes e gravava UPLOADED/ETag/data de conclusão. Não recebia, extraía ou atualizava duração/dimensões; tampouco verificava o tamanho do objeto concluído.
4. `app/api/media/upload-url/route.ts` apenas gera uma URL de PUT e um identificador; não registra MediaAsset nem tem um caminho alternativo encontrado que preencha esses campos.
5. A página de distribuição já lia videoWidth/videoHeight após onLoadedMetadata para ajustar o aspect ratio da prévia. O editor de thumbnail também consultava dimensões/duração do elemento de vídeo. Esses dados eram apenas estado visual e não voltavam ao MediaAsset.
6. Não foi encontrado um processamento assíncrono/ffprobe que completasse os campos após a ingestão.

Portanto, o defeito afetava **novos uploads pelo código anterior e mídias antigas**, não apenas uma migração histórica. O schema já contém durationSeconds, width e height como Int opcionais e fileSize como BigInt; não é necessária migration.

## Correção implementada

### Captura real antes do upload

`src/lib/media/read-video-metadata.ts` cria um elemento de vídeo local com URL de objeto do File. Lê duration, videoWidth e videoHeight em loadedmetadata/loadeddata, sem upload ou cópia integral do arquivo para um ArrayBuffer. A URL de objeto é liberada e o elemento limpo após sucesso, erro ou timeout de 30 segundos.

O UploadManager executa essa leitura antes de chamar multipart/start e envia videoMetadata tanto no início quanto na conclusão. Se o navegador não consegue ler o formato/arquivo, o upload não começa e é exibido um erro claro. Não há duração/resolução padrão nem fallback fictício. Cancelamento durante a leitura é respeitado antes de iniciar o multipart.

### Contrato e persistência

`src/lib/media/video-metadata.ts` centraliza validação e identificação dos campos ausentes:

- Duração finita, positiva e compatível com o campo Int existente.
- Largura/altura inteiras positivas, compatíveis com Int.
- O tamanho de entrada precisa ser inteiro seguro positivo; o tamanho confirmado é obtido do R2.
- Como durationSeconds é Int, a duração fracionária medida é arredondada para cima ao segundo inteiro. Isso preserva a granularidade do schema e não transforma, por exemplo, um teaser de 30,1 segundos em um teaser de até 30 segundos. Não se usa valor fixo; a medição original é a origem do valor.

`multipart/start` recusa VIDEO sem metadados válidos antes de criar o multipart ou o registro, e grava os valores medidos junto com UPLOADING. Imagens continuam com o comportamento anterior, sem exigir metadados de vídeo.

`multipart/complete` verifica os metadados persistidos antes de concluir o multipart. Para uploads iniciados por uma versão anterior, permite receber a medição no próprio complete quando a persistida ainda não existe. Sem uma medição válida, não marca UPLOADED.

Depois de concluir o multipart de vídeo, faz HeadObject no bucket/key registrados do MediaAsset. ContentLength deve ser positivo e exatamente igual ao tamanho originalmente informado pelo File. Diferença retorna MEDIA_SIZE_MISMATCH e não promove a mídia. Metadados, tamanho confirmado e UPLOADED são gravados na mesma atualização.

A validação do servidor rejeita ausência/números inválidos e confirma tamanho real no armazenamento. Duração/resolução são medições do navegador; não foi introduzido um decodificador server-side nem uma prova criptográfica desses valores. Esse limite é explícito: o servidor não descobre sozinho dados de um vídeo antigo, nem preenche valores inventados se um cliente não os enviar.

Uma falha de HeadObject ou de persistência após concluir o objeto não produz sucesso. O multipart já pode ter sido concluído nesse cenário; a recuperação operacional de um objeto concluído com estado local pendente continua exigindo revisão. Não se deve considerar ausência de UPLOADED prova de que nenhum byte foi armazenado.

### Publicação e compatibilidade

- O protocolo e o executor ManyVids não foram alterados.
- A tela de distribuição identifica duração/dimensões/tamanho ausentes e explica o bloqueio de publicação ManyVids para uma mídia antiga.
- A rota local de criação de distribuição repete a checagem quando os destinos incluem MANYVIDS, **antes de criar job/publicações**. Evita novos jobs órfãos por essa falha conhecida.
- As implementações e validações de publicação Instagram/Fanvue não foram alteradas. Distribuições sem ManyVids preservam o comportamento anterior, inclusive para mídias antigas; o bloqueio novo é específico ao destino ManyVids. Em uma seleção mista que inclui ManyVids, o job é recusado antes da criação se o vídeo não tem metadados.
- Novos vídeos concluídos pelo fluxo corrigido possuem os quatro campos. Mídias já existentes não são excluídas, reclassificadas ou atualizadas automaticamente.
- Clientes antigos que tentarem iniciar vídeo sem o novo contrato recebem erro explícito para atualizar a página. Um upload já iniciado pode concluir se fornecer medições válidas; não há exceção que aceite valores ausentes silenciosamente.

## Backfill seguro — estratégia separada, não executada

**O vídeo C0368.MP4 precisa de backfill medido antes de outro teste ManyVids.** A correção do upload não preenche retroativamente seu registro. Evite reenviar o mesmo arquivo apenas para preencher campos: o fluxo possui bloqueio de nome duplicado na pasta.

Procedimento administrativo proposto para uma ferramenta futura ou operação explicitamente autorizada:

1. Começar em dry-run e receber uma lista explícita de MediaAsset.id; nunca varrer e gravar toda a biblioteca automaticamente.
2. Resolver workspace/creator/bucket/key no banco; aceitar apenas VIDEO/R2/UPLOADED e bloquear assets em publicação PROCESSING. Não receber URL arbitrária ou credenciais pela linha de comando.
3. Ler HeadObject para tamanho e ETag. Medir o objeto original com uma ferramenta apropriada, como ffprobe sobre uma cópia local controlada obtida pelo SDK R2. Não passar URL assinada na linha de comando/logs. Uma cópia original fornecida localmente só é válida após comprovar que corresponde ao objeto registrado; igualdade de nome sozinha não basta.
4. Extrair duração e dimensões reais do stream de vídeo, considerando a orientação/display dimensions. Não usar taxa de bits, nome do arquivo, tamanho ou resolução presumida para estimar valores ausentes.
5. Revalidar com as mesmas regras da ingestão. Mostrar somente ID, valores atuais/propostos e resultado da comparação do objeto. Se houver erro, formato inesperado ou metadados contraditórios, parar para revisão.
6. Somente em uma execução separada com aplicação explicitamente autorizada, reler o registro e o HeadObject; exigir bucket/key/ETag/tamanho inalterados. Fazer atualização condicional curta dos campos ausentes, sem substituir valores válidos diferentes, apagar assets ou alterar publicação/conta.
7. Remover somente a cópia temporária criada pela ferramenta, se houver, após validar seu caminho. Não apagar o arquivo original do usuário ou o objeto R2. Registrar auditoria sem URLs assinadas ou credenciais.
8. Conferir os quatro campos antes de retomar um teste autorizado. A publicação identificada nesta auditoria ainda não tem tentativa nem ID remoto, mas qualquer novo teste deve reler esse estado antes de decidir reutilizar/criar publicação. O backfill não deve executar publicação.

Essa estratégia não cria um bypass da validação nem uma ferramenta que aceite números arbitrários para corrigir somente um registro. Nenhum backfill, download de vídeo ou publicação foi executado nesta tarefa.

## Arquivos da correção

- `src/lib/media/video-metadata.ts` — contrato e validações compartilhadas.
- `src/lib/media/read-video-metadata.ts` — captura local real.
- `src/lib/media/video-metadata.test.ts` — testes simulados de limites, tamanho e ciclo de vida da captura.
- `src/components/app/UploadManagerProvider.tsx` — mede e transmite metadados.
- `app/api/media/multipart/start/route.ts` — exige/grava metadados e tamanho inteiro válido.
- `app/api/media/multipart/complete/route.ts` — valida, confirma tamanho R2 e só então marca pronta.
- `app/api/distribution/route.ts` — preflight de metadados exclusivamente para destino ManyVids.
- `app/[locale]/app/distribution/page.tsx` — informa campos ausentes e bloqueia o botão ManyVids.
- `VIDEO_METADATA_INGESTION.md` — diagnóstico, comportamento e estratégia de backfill.

## Verificações

Quatro testes locais simulados passaram: normalização sem valores fictícios; identificação da mídia antiga incompleta; rejeição de tamanho R2 divergente/ausente; captura no elemento de vídeo e limpeza após sucesso/erro/timeout. Não houve acesso real ao R2 nesses testes.

Lint dirigido aos helpers, testes, UploadManager e rotas modificadas passou sem erros ou avisos. A página de distribuição conserva os mesmos oito erros preexistentes de hooks/ordem de declaração identificados na tarefa anterior; não foram suprimidos nem refatorados fora do escopo.

Build Vinext aprovado; next typegen e tsc --noEmit --incremental false aprovados após o build final. Não foi executado upload real para validar decodificação no navegador do usuário ou a chamada HeadObject com o objeto real. Nenhum deploy, backfill ou publicação foi realizado.
