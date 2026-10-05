# ManyVids HTTP Implementation

Data: 16 de setembro de 2026.

Atualização do formulário: a seção **Formulário e contrato local — thumbnail, teaser e co-performers** ao final descreve o contrato vigente e substitui os exemplos/restrições de performer único abaixo, mantidos como histórico da primeira entrega.

## Estado da entrega

Implementado um executor HTTP síncrono para publicação **NOW**, conectado à tela de distribuição e sem dependência de Playwright. O legado e as rotas experimentais preexistentes foram preservados. Não foi executada publicação real, conexão com conta ManyVids, migration ou deploy.

O sucesso dos testes locais/build não confirma aceitação do protocolo por uma conta real. Para o primeiro teste são necessários uma sessão cifrada por PlatformAccount, seu externalAccountId remoto e uma mídia R2 com duração/dimensões preenchidas. Nenhum cookie foi extraído do ambiente para preencher contas automaticamente.

## Arquitetura

`POST /api/distribution/execute/manyvids` recebe um publicationId já criado por `/api/distribution`. A rota resolve PlatformPublication → PlatformAccount/DistributionJob → MediaAsset/Creator/Workspace e valida membership, status e propriedade. IDs de mídia, bucket, key e creator remoto não são aceitos do frontend.

O cliente em `src/lib/platforms/manyvids/http/` é separado do executor legado:

| Arquivo criado | Responsabilidade |
|---|---|
| `types.ts` | Input Zod, discriminantes de thumbnail/teaser, erros seguros, helpers de resposta |
| `session.ts` | Envelope versionado cifrado por conta, cookie jar por domínio/path/expiração |
| `client.ts` | Fetch com timeout, redirects recusados, refresh, mvtoken novo por formulário, SHA-256 do corpo exato |
| `upload.ts` | Multipart sequencial, leitura R2 em ranges de 20 MiB, ETags e complete; abort best effort |
| `media-processing.ts` | Registro, thumbnail, teaser e polling, transcoding |
| `performers.ts` | Associação de um co-performer com conta e estado documental derivado |
| `metadata.ts` | Resolução de nomes de tags para IDs e save form-urlencoded |
| `publish.ts` | Ordem das operações e confirmação remota antes de PUBLISHED |
| `http.test.ts` | Testes locais com transportes/respostas simulados, sem chamadas remotas |
| `src/lib/distribution/job-status.ts` | Agregação dos estados de jobs que contêm ManyVids |
| `app/api/distribution/execute/manyvids/route.ts` | Autorização, claim concorrente, persistência e resposta segura |

Arquivos modificados:

- `app/[locale]/app/distribution/page.tsx`: usa publicationId e novo executor, mantém formulário, recusa opções não suportadas antes de criar job e continua os destinos Instagram mesmo se ManyVids falhar.
- `app/api/performers/manyvids/search/route.ts`: exige platformAccountId autorizado e usa sua sessão cifrada, eliminando cookies globais desse caminho.
- `app/api/distribution/execute/instagram/route.ts`: somente reconcilia jobs mistos após sucesso/falha. Falha de agregação não altera o resultado Instagram; protocolo de publicação permanece intacto.
- Este documento.

Não foram alterados schema Prisma, contratos gerados, implementação Fanvue, helpers de criptografia/storage, configurações de build ou arquivos legados. `MANYVIDS_HTTP_AUDIT.md`, `audit-links.txt` e as três rotas de teste ManyVids já estavam não rastreados antes da implementação.

## Fluxo passo a passo

1. UI valida Publish now, thumbnail automática, título, preço e tags; cria distribuição pelo caminho existente.
2. Rota de execução valida input, relações, conta conectada, mídia VIDEO/UPLOADED/R2 e metadados. Apenas uma publicação ManyVids no job é aceita.
3. Sessão cifrada é validada contra externalAccountId. Sem configuração, a operação é recusada antes de enviar mídia.
4. Transação curta bloqueia a linha da conta, verifica publicação PROCESSING e realiza claim condicional da publicação QUEUED/attemptCount=0. Não mantém transação aberta durante chamadas remotas.
5. Publication muda para PROCESSING, recebe startedAt e attemptCount=1. O job é reconciliado.
6. Cliente renova autenticação, obtém mvtoken e resolve cada tag por correspondência exata de nome. IDs repetidos são deduplicados; exige ao menos três IDs distintos. Tags ambíguas/inexistentes geram erro antes do upload.
7. Cria multipart usando metadados reais. Lê cada range R2 pelo bucket/key do MediaAsset, assina a parte, faz PUT sem cookies e coleta ETag. Completa e valida a key devolvida.
8. Registra vídeo com save/stripping. Assim que recebe videoId, persiste externalPostId, antes de thumbnail/teaser/save. Confere creator e ID pela representação remota do vídeo.
9. Solicita thumbnail automática e valida a aceitação da operação, sem aguardar o endpoint de progresso. Não realiza crop nem navegação visual.
10. Solicita teaser com start_time; faz polling legado com origin_Etag e mvtoken fresco. Como os HARs não preservaram os bodies de teaser, estes permanecem unknown. Confirma geração pela presença de teaser.filepath na representação privada já mapeada.
11. Se um performer foi selecionado, envia vidId + coStarIds[] por multipart/form-data com mvtoken. Só passa ao save após resposta de associação com msg e sem erro.
12. Salva metadados por application/x-www-form-urlencoded; charset=UTF-8. Tags são IDs, não textos. Resposta HTTP 200 com error/errors ou success=false é falha.
13. Solicita transcoding/intervalThumbs e executa PUT final. Calcula x-amz-content-sha256 a partir da mesma string JSON enviada.
14. Após save/transcoding/PUT aceitos, consulta estado remoto a cada cinco segundos por até cinco minutos, em janela própria de confirmação. Exige publiclyLaunched=true, isPrivate=false, ID/creator corretos, título/preço esperados e hasCoPerformer=true quando selecionado. Usa a URL retornada pelo ManyVids, validando origem e recusando URL de editor/login; não inventa permalink. Campos ausentes ou ainda não propagados mantêm o polling. ID/creator explicitamente diferentes ou body com erro causam falha imediata. O polling faz somente releituras do mesmo vídeo, nunca novo upload.
15. Somente então grava PUBLISHED, externalPostUrl e publishedAt. Em erro da tentativa grava FAILED e conserva externalPostId se já disponível. Reconcilia o job sem finalizar destinos ainda pendentes.

## Endpoints usados

As operações de teaser e os valores adicionais do save vieram das instruções/HARs sanitizados fornecidos pelo usuário. Endpoints auxiliares de leitura/tags vieram do mapeamento público anterior. Não são apresentados como implementação prévia do repositório nem como teste real executado nesta entrega.

| Método | Host/caminho | Uso |
|---|---|---|
| GET | api.manyvids.com/auth/token/v1 | Renovação inicial |
| GET | www.manyvids.com/includes/init_session.php | mvtoken dinâmico |
| GET | api.manyvids.com/tags/partial/{keyword}/tags | Resolução de tags |
| POST | api.manyvids.com/uploader/create | Multipart |
| GET | api.manyvids.com/uploader/sign/{uploadId}/{part}?key=… | Assinatura de parte |
| PUT | URL assinada do armazenamento | Bytes; não envia cookies; recusa redirect/host inesperado |
| POST | api.manyvids.com/uploader/complete/{uploadId}?key=… | Conclusão multipart |
| DELETE | api.manyvids.com/uploader/abort/{uploadId}?key=… | Limpeza best effort em falha |
| POST | api.manyvids.com/unified-media/unified-upload/v2 | Registro, thumbnail, transcoding |
| POST | www.manyvids.com/api/video/preview | Teaser a partir do vídeo |
| POST | www.manyvids.com/includes/get_edit_preview_vid_status.php | Polling de teaser |
| GET | api.manyvids.com/store/video/{videoId}/private | Evidência do teaser |
| POST | www.manyvids.com/api/coperformers?mvtoken=… | Associação de conta de co-performer |
| POST | www.manyvids.com/includes/saveVideo.php | Save form-urlencoded |
| PUT | api.manyvids.com/v1/store/videos/ | Finalização; premiumStatus=not_included |
| GET | api.manyvids.com/store/video/{videoId} | Estado de lançamento |
| GET | api.manyvids.com/uploader/video/{videoId}/preview-details | ID/owner/metadados/URL |
| GET | www.manyvids.com/bff/search/creators?keywords=… | Busca de performer na UI por conta |

Teaser custom: os endpoints /api/video/custom-preview e /includes/get_custom_preview_status.php foram fornecidos, mas **não são chamados nesta etapa**. Ainda não há transporte autorizado/configurado do arquivo custom até um remote filename/etag confiável. Não aceitamos um filename crítico arbitrário enviado pelo frontend.

## Payload e regras

Exemplo de input do executor, com valores ilustrativos:

```json
{
  "publicationId": "<id local retornado por /api/distribution>",
  "title": "Título",
  "description": "Descrição",
  "price": 12.5,
  "tags": ["nome exato A", "nome exato B", "nome exato C"],
  "performer": { "id": "<ID remoto numérico>" },
  "thumbnail": { "source": "generate_from_video" },
  "teaser": { "source": "generate_from_video", "startTime": 0 },
  "publishMode": "NOW",
  "isAiGenerated": false,
  "is3D": false
}
```

`performer: null` representa explicitamente ausência de co-performer na intenção enviada. Relações MediaAssetPerformer da biblioteca não são convertidas automaticamente em participantes remotos, pois não distinguem proprietário/ator principal/co-performer. Um performer selecionado nunca resulta em co_performer=NO.

thumbnail.source e teaser.source são uniões generate_from_video | upload_custom. CUSTOM é reconhecido, mas rejeitado antes de upload; teaser custom valida duração <=30 e tamanho <50.000.000 bytes antes de indicar falta de suporte. Não há fallback silencioso de custom para geração automática.

No caminho account-only, após associação: co_performer=YES, documentUploadStatus=0, age_and_consent=0. O estado documents_required é explicitamente rejeitado, não convertido em 0. O caminho sem participante não envia documentos. Não interpretar documentUploadStatus como prova universal de aprovação.

Save inclui os valores confirmados vid_token=false, vid_name=false, vid_custom=false; ai_content_select/ai_3d_content_select derivam dos booleans de entrada, cujo default inicial é false. O restante das flags segue o contrato mapeado do primeiro fluxo NOW. Não há promoção Premium/Club avançada.

## Banco e isolamento

PlatformPublication:

- Claim: status PROCESSING, startedAt, attemptCount incrementado de zero para um; limpa failedAt/erros.
- Registro remoto: externalPostId imediatamente após receber videoId.
- Sucesso confirmado: status PUBLISHED, externalPostId, externalPostUrl, publishedAt; failedAt e erros nulos.
- Falha da tentativa: status FAILED, failedAt, lastErrorCode tipado e lastErrorMessage da aplicação. Timeout de consistência após save/PUT retorna REMOTE_CONFIRMATION_TIMEOUT (etapa CONFIRM), preservando externalPostId já gravado; não é tratado como erro de upload. Não persiste body remoto nem URL assinada.
- Validação anterior ao claim não muda estado, porque nenhuma tentativa começou.
- Chamada repetida para PUBLISHED devolve o resultado existente sem novo upload. PROCESSING/FAILED/attemptCount>0 exigem revisão, sem retry total automático.

DistributionJob:

- PROCESSING enquanto existe publicação em processamento.
- QUEUED/SCHEDULED enquanto destinos correspondentes continuam pendentes.
- COMPLETED quando todos estão PUBLISHED.
- FAILED quando o conjunto terminou e há falha.
- startedAt/completedAt e erros agregados são atualizados. Jobs sem ManyVids mantêm o comportamento anterior.

PlatformAccount:

- accessTokenEncrypted contém um envelope ManyVids versionado, criptografado pelo helper compartilhado existente.
- externalAccountId precisa conter o ID remoto correto; a sessão registra o mesmo creatorId e é recusada se houver divergência.
- Set-Cookie válido atualiza somente a sessão cifrada daquela conta. Domínio/path/expiração são preservados. Cookies nunca são enviados à URL de armazenamento.
- Nenhuma variável MANYVIDS_COOKIE_HEADER/PHPSESSID global é usada pelo novo executor ou busca. As rotas de teste antigas continuam intactas e não integram o novo caminho.

## Configuração para o primeiro teste real

1. Disponibilizar DATABASE_URL e R2_ACCOUNT_ID/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY, além da configuração de bucket/endpoint já utilizada pelo projeto. O executor usa o bucket registrado no MediaAsset.
2. Configurar PLATFORM_TOKEN_ENCRYPTION_KEY com chave hex de 32 bytes, consistente entre instâncias. O helper mantém o fallback FANVUE_TOKEN_ENCRYPTION_KEY existente; não trocar chaves sem migração dos outros consumidores.
3. Por uma rotina administrativa server-side confiável, vincular a sessão autorizada à PlatformAccount MANYVIDS correta. **Não enviar cookies no input do executor, no chat, em logs ou no arquivo Markdown.**
4. Montar o envelope abaixo com valores reais somente no ambiente administrativo seguro, chamar encryptManyVidsSession e gravar o resultado em accessTokenEncrypted da conta. Não imprimir plaintext ou ciphertext. Configurar externalAccountId/creatorId/workspaceId corretos e status CONNECTED. A existência do envelope não verifica identidade magicamente; o provisionamento deve conferir a conta de origem.

```ts
// Estrutura, não credenciais utilizáveis; não executar literalmente.
type AccountSession = {
  version: 1;
  creatorId: string; // ID remoto, igual a externalAccountId
  cookies: Array<{
    name: string;
    value: string;
    domain: "manyvids.com" | "www.manyvids.com" | "api.manyvids.com";
    hostOnly: boolean; // preservar atributo real
    path: string;
    expiresAt?: number; // epoch em milissegundos, se houver
  }>;
};
// encryptManyVidsSession(envelope) retorna o valor cifrado para a conta.
```

Não foi criada tela/rota de importação de cookies nem convertido perfil Chromium automaticamente. Este provisionamento é a configuração ainda necessária para o teste real; não se deve reativar o connect legado para fingir uma sessão HTTP configurada.

5. Selecionar uma mídia de teste autorizada já UPLOADED, VIDEO, R2, com fileSize, durationSeconds, width e height preenchidos. Esta implementação não usa ffprobe nem inventa metadados ausentes.
6. Selecionar exatamente uma conta ManyVids, NOW e thumbnail automática. Usar nomes de tags existentes e, quando aplicável, selecionar a conta remota do co-performer. Revisar as declarações de conteúdo.
7. Enviar uma única vez e aguardar. O request é síncrono; observar o registro da publicação no banco caso a aba ou proxy interrompa a resposta.
8. Verificar externalPostId, resultado remoto e estado final local. Se houver FAILED ou PROCESSING após interrupção, revisar o ID já criado antes de qualquer novo job; não zerar attemptCount nem repetir upload às cegas. Não foi implementada retomada automática.

## Limitações restantes

- Sem teste end-to-end em conta real; nenhuma garantia de publicação remota foi inferida dos mocks.
- Sem fila durável; Worker/proxy/cliente pode encerrar requests longos. Há limites de tempo por chamada, polling limitado e deadline do cliente; o build não comprova tempo de execução suficiente para vídeos grandes em produção.
- Uma parte por vez e até 10 GiB pela validação local; capacidade real depende do runtime/rede. Não há retries complexos, partes persistidas ou retomada após crash.
- Crash abrupto pode deixar PROCESSING. O claim por conta impede nova execução simultânea, mas requer revisão operacional para estado abandonado.
- Sem custom thumbnail, upload de teaser custom, documentação de performer sem conta, agendamento de execução ou Premium/Club avançado. A UI preserva seleções, mas recusa recursos não implementados.
- A semântica dos bodies de teaser permanece desconhecida. Logs mostram apenas tipo e contagem de campos, sem keys/valores sensíveis. A leitura privada pode demorar/falhar; nesse caso não presume conclusão.
- Confirmador exige os campos mapeados de leitura. Se a conta receber formato diferente, o executor falha de forma conservadora; capturar apenas estrutura sanitizada para ajustar contrato.
- Resolução de tags exige correspondência única por nome e não cria tags. Não aceita texto como ID no save.
- URLs assinadas aceitas apenas por HTTPS em hosts de armazenamento AWS/R2 conhecidos, sem cookies e sem redirects. Host diferente exige revisão explícita, não relaxamento genérico.
- A seleção e os metadados de execução ainda vêm da requisição atual, sem snapshot completo de opções no banco. Por isso retries/reexecução de falhas não são habilitados nesta etapa.
- Onboarding/catálogo do browser e rotas de teste antigas não foram removidos ou redesenhados; a conexão HTTP é provisionada por conta separadamente.

## Validação local

- Typecheck: `npx next typegen` seguido de `npx tsc --noEmit --incremental false`. Os erros iniciais eram de tipos gerados .next; regenerar esses artefatos resolveu o erro, sem editar código antigo para mascará-lo. O build Vinext reescreve tipos dessa pasta; portanto executar typegen depois do build, não em paralelo com ele.
- ESLint dirigido aos novos serviços/rotas e busca: passou.
- Doze testes de contrato com node:test em `http.test.ts`: passaram em memória via esbuild, sem arquivo temporário de saída e sem chamadas externas. Cobrem form/IDs, consentimento, cookies, hash exato, erros 200, respostas desconhecidas, confirmação de publicação, limites custom e ordem/checkpoint da orquestração. A transferência R2/PUT real e transações de banco não foram exercitadas por esses mocks.
- Build: `npm run build:vinext`, sem deploy. A rota `/api/distribution/execute/manyvids` aparece no build. Avisos existentes de compatibilidade parcial webpack/tamanho de chunks não foram tratados nesta migração.

Os testes e o build precisaram executar fora do sandbox porque o ambiente bloqueou spawn dos compiladores com EPERM. Isso não alterou o escopo: nenhum teste real ManyVids foi executado.

Comando reproduzível dos testes, na raiz do projeto (PowerShell; o nome .cjs abaixo é apenas a identidade do módulo em memória, não um arquivo criado):

```powershell
node -e 'const esbuild=require("esbuild"); const Module=require("node:module"); const path=require("node:path"); esbuild.build({entryPoints:["src/lib/platforms/manyvids/http/http.test.ts"],bundle:true,platform:"node",format:"cjs",packages:"external",write:false}).then(r=>{const filename=path.join(process.cwd(),"manyvids-tests.cjs"); const m=new Module(filename);m.filename=filename;m.paths=Module._nodeModulePaths(process.cwd());m._compile(r.outputFiles[0].text,filename);}).catch(()=>{process.exitCode=1;});'
```

## Ajuste anterior ao primeiro teste real

- Removida toda chamada ao endpoint /unified-media/progress/v1 do executor. Seu HTTP 404 não participa da decisão de falha nem impede thumbnail, teaser, save, transcoding ou confirmação. A confirmação usa /store/video/{id} e /uploader/video/{id}/preview-details; teaser mantém sua releitura privada.
- Polling final: intervalo de cinco segundos, janela de cinco minutos iniciada após PUT, independente do deadline anterior de upload. Mantém as exigências de lançamento, privacidade, identidade, título/preço, co-performer quando aplicável e URL pública. Não reduz evidências para forçar sucesso.
- Identidade presente mas incorreta e erros explícitos são fatais; ausência/atraso dos campos de estado é tratada como consistência eventual. Outros erros HTTP/autenticação continuam sendo erros, sem presumir propagação.
- O erro REMOTE_CONFIRMATION_TIMEOUT conserva o ID remoto e exige revisão do vídeo existente antes de outra tentativa. A persistência da rota não foi modificada.
- Testes adicionais cobrem progresso indisponível sem chamadas, propagação atrasada, falha imediata de identidade/erro e timeout específico sem novo upload. UI, schema, legado e outras plataformas não foram alterados neste ajuste.


## Formulário e contrato local — thumbnail, teaser e co-performers

### Interface

O bloco ManyVids da distribuição está dividido em Metadata, Thumbnail, Teaser, Co-performers e Publish settings. Metadados anteriores foram preservados. Um componente específico, src/components/app/ManyVidsPublishingOptions.tsx, permite:

- Thumbnail gerada, frame opcional com prévia do vídeo/seleção por seek, ou imagem cadastrada na biblioteca com prévia e troca/remoção da seleção.
- Teaser gerado com início e duração, ou vídeo cadastrado na biblioteca com prévia, troca/remoção e checagem de duração até 30 s e tamanho estritamente inferior a 50.000.000 bytes.
- Zero, um ou vários co-performers. Zero exige confirmação explícita na UI; adicionar/remover pessoas não marca automaticamente ausência de co-performers. Cada conta é escolhida pela busca ManyVids; o ID remoto não é um campo de texto livre.
- Pessoas sem conta: seleção do Performer local, PHOTO_ID e RELEASE_FORM ou Agreement finalizado com signedPdfObjectKey. Não duplicamos os arquivos. Links abrem a biblioteca/gestão documental existente em outra aba; após o cadastro, Atualizar biblioteca e documentos recarrega as opções. Não há upload remoto nesses controles.
- Estados account, documents_required e documents_ready. “Documentação pronta” significa disponibilidade local, nunca aprovação ManyVids.
- Publish desabilitado com motivo visível quando a configuração é incompleta, inválida ou depende de capacidade remota ausente. Trocar o vídeo/conta limpa a configuração específica para evitar reutilização acidental de participantes/assets.

### Contrato vigente

POST /api/distribution/execute/manyvids usa performers (array obrigatório), substituindo performer singular. Não existe conversão implícita do formato antigo.

~~~ts
type ManyVidsCoPerformer =
  | { mode: "account"; remotePerformerId: string; label: string }
  | {
      mode: "documents";
      localPerformerId: string;
      idDocumentId: string;
      consentDocumentId: string;
      consentSource: "document" | "agreement";
      label: string;
    };

// Exemplos de partes do input, sem credenciais:
const performers = [
  { mode: "account", remotePerformerId: "123", label: "Pessoa A" },
  { mode: "documents", localPerformerId: "local-id", idDocumentId: "photo-id",
    consentDocumentId: "agreement-id", consentSource: "agreement", label: "Pessoa B" },
];
const thumbnail = { source: "upload_custom", mediaAssetId: "image-asset-id" };
const teaser = { source: "generate_from_video", startTime: 0, duration: 15 };
~~~

Thumbnail aceita {source:"generate_from_video", frameTime?:number} ou {source:"upload_custom", mediaAssetId:string}. Teaser aceita {source:"generate_from_video", startTime:number, duration?:number} ou {source:"upload_custom", mediaAssetId:string}. Nenhum filename remoto, bucket, objectKey, cookie ou token é aceito do frontend.

**Duração explícita versus automática:** o HAR mapeado prova apenas start_time. Duração preenchida representa a intenção solicitada e retorna TEASER_DURATION_NOT_SUPPORTED antes de qualquer operação remota. Não enviamos um parâmetro inventado nem descartamos a duração. Para preservar o caminho existente, o contrato permite duração ausente; a UI explica que esvaziar explicitamente esse campo seleciona a duração automática determinada pelo ManyVids. Não presume que o padrão remoto seja 30 segundos. O formulário inicialmente exibe 30 como intenção editável, não como garantia remota.

### Validação e autorização

GET /api/distribution/manyvids/options?platformAccountId=… é somente leitura local, autenticada e autorizada por membership no workspace da conta MANYVIDS. Retorna somente IDs/rótulos e metadados necessários. Não retorna objectKeys, buckets, conteúdo documental ou PDFs. Não é uma rota de sessão/cookies.

loadLocalOptions restringe assets ao workspace/creator da conta, estado UPLOADED e armazenamento R2. Performers/documentos são do workspace, pois o modelo Performer não pertence a um creator. Somente performers ativos e documentos ativos com arquivo R2, MIME documental aceito, tamanho positivo e não expirados entram no catálogo. Agreement exige COMPLETED, completedAt, ausência de voidedAt, signedPdfObjectKey e bucket; DRAFT/arquivo sem assinatura não é uma autorização pronta.

A rota execute resolve novamente as referências no banco depois de autenticar a publicação e verificar suas relações. Repete os limites de teaser usando duração e tamanho persistidos, nunca metadados enviados pelo frontend. Valida frame e intervalo gerado contra a duração do vídeo; documentos precisam pertencer à mesma pessoa selecionada. Assets alheios, excluídos ou de outro creator não passam. Metadados ausentes bloqueiam; não há análise binária nova de vídeo nesta etapa.

O schema é estrito: rejeita performer incompleto, duplicação do mesmo ID por modo, filenames/URLs de asset arbitrários e co_performer/documentUploadStatus/age_and_consent enviados diretamente pelo frontend. Não detecta automaticamente que uma conta remota e um Performer local representam a mesma pessoa, pois esse vínculo não existe no modelo.

### Comportamento remoto e limites

- Associação de contas envia todos os IDs em coStarIds[] na chamada já existente /api/coperformers. A ordem do fluxo e os endpoints existentes permanecem iguais. Zero não faz chamada de associação.
- Save deriva co_performer=YES somente após associação aceita; sem participantes explícitos usa NO. Para esses caminhos sem documentos, documentUploadStatus=0 e age_and_consent=0 seguem o caso mapeado. documents_required/documents_ready nunca são convertidos em 0: o save recusa ambos até existir submissão documental comprovada.
- CUSTOM_THUMBNAIL_NOT_SUPPORTED, CUSTOM_TEASER_NOT_SUPPORTED, DOCUMENTS_NOT_SUPPORTED, THUMBNAIL_FRAME_NOT_SUPPORTED e TEASER_DURATION_NOT_SUPPORTED são falhas de capacidade anteriores a claim, upload ou registro remoto. As opções permanecem configuráveis na UI, sem fallback silencioso.
- Múltiplas contas de co-performer são representadas e serializadas localmente. A aceitação real de todos os participantes ainda precisa ser validada em teste autorizado; a confirmação remota existente comprova hasCoPerformer, não a lista individual de IDs.
- Permanecem pendentes: transporte remoto de capa/teaser custom; aplicação de frame/duração exatos; submissão/associação de documentos e semântica correspondente dos campos do save; agendamento e Premium/Club avançado. Nenhum endpoint novo ManyVids foi inventado.
- Não houve mudanças em schema/migrations, Instagram/Fanvue, sessão, Chromium, legado ou script de provisionamento nesta etapa. A configuração ainda reside no formulário/request, sem snapshot persistente novo nem retomada de publicação.

### Arquivos desta etapa

- app/[locale]/app/distribution/page.tsx
- src/components/app/ManyVidsPublishingOptions.tsx (novo)
- app/api/distribution/manyvids/options/route.ts (novo)
- app/api/distribution/execute/manyvids/route.ts
- src/lib/platforms/manyvids/http/local-options.ts (novo)
- src/lib/platforms/manyvids/http/types.ts
- src/lib/platforms/manyvids/http/performers.ts
- src/lib/platforms/manyvids/http/publish.ts
- src/lib/platforms/manyvids/http/http.test.ts
- MANYVIDS_HTTP_IMPLEMENTATION.md

### Verificações desta etapa

15 testes HTTP/contrato simulados aprovados, incluindo array de contas, documentos incompatíveis/ausentes, isolamento pelo catálogo autorizado, limites de assets persistidos e campos de consentimento injetados. Sem requisições ManyVids, provisionamento, publicação, migration ou deploy.

Lint da página de distribuição ainda aponta erros preexistentes de hooks/ordem de declaração. Comparação com HEAD: 9 erros anteriores, 8 restantes; nenhum novo erro dessa categoria. Eles não foram suprimidos nem tratados por refatoração fora do escopo. Os arquivos novos e serviços/rotas ManyVids são verificados separadamente.

Verificação final: build Vinext aprovado com as duas rotas ManyVids registradas; next typegen e tsc --noEmit --incremental false aprovados após o build. Lint dirigido dos novos componentes/serviços/rotas passou com zero erros e um aviso de otimização de imagem na prévia. Permanecem os avisos existentes de compatibilidade parcial webpack/tamanho de chunks do build. Não foi feito teste visual autenticado nem teste remoto; os resultados acima são de compilação e testes simulados.
