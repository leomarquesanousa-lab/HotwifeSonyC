# ManyVids HTTP Migration Audit

Data: 16 de setembro de 2026. Repositório: `C:\Demo\creator-platform`.

Escopo: auditoria estática do checkout atual, exclusivamente das responsabilidades e dependências da integração ManyVids. Não foram consultados serviços externos, executadas rotas, abertas sessões de browser, utilizados cookies, realizados uploads, builds, migrations ou testes que alterem estado. Este documento é o único arquivo criado pela auditoria; nenhuma implementação foi modificada.

Convenção: **confirmado** significa encontrado no código local; **risco/inferência** significa consequência possível dessa implementação; **não encontrado** limita-se ao código inspecionado. Nenhum endpoint remoto é considerado funcional apenas por aparecer em uma string ou comentário. A investigação externa anterior não é usada como prova de implementação neste repositório. Linhas citadas são aproximadas e correspondem ao checkout auditado.

## 1. Executive Summary

A integração está dividida em três partes desconectadas:

1. Uma interface de distribuição ativa que cria `DistributionJob` e `PlatformPublication`, prepara metadados ManyVids e chama `/api/platforms/manyvids/upload-test`.
2. Uma implementação legada de publicação por Playwright, cuja rota está em `legacy-manyvids-browser/`, fora de `app/api` e excluída pelo `tsconfig.json`. Não há handler ativo correspondente ao caminho chamado pela interface no código auditado.
3. Três rotas HTTP de teste ativas, mais uma busca HTTP de performers. Elas consultam sessão/renovação e criam uma sessão de upload com metadados fixos, mas não executam a publicação HTTP completa.

Achados prioritários:

- **Fluxo interrompido:** a interface grava jobs antes de chamar uma rota não registrada no checkout. A existência das funções legadas não equivale a uma publicação executável atualmente.
- **Participante descartado:** o frontend envia `performerId`, `performerUsername` e `performerLabel`; o handler legado não lê esses campos, e `fillEditPage` chama `chooseNoCoPerformers` incondicionalmente.
- **Sem confirmação persistente:** o legado retorna um ID externo e flags visuais, mas não atualiza `PlatformPublication`/`DistributionJob`. O save é inferido pela ausência de mensagens de erro após um clique.
- **Credenciais globais:** os testes HTTP utilizam variáveis de ambiente, sem vincular a sessão remota ao workspace, creator e conta selecionados. O helper compartilhado de criptografia não está integrado ao ManyVids.
- **Documentos locais:** os modelos de performers, documentos e agreements são uma base reutilizável; não há submissão/associação documental ao ManyVids no fluxo encontrado.
- **Runtime:** o legado depende de Chromium local, disco e perfil persistente. O deploy Vinext usa um Worker e não configura um serviço de browser remoto. Declarar `runtime = "nodejs"` no legado não fornece essa infraestrutura.

A migração deve preservar biblioteca de mídia, autorização local, modelos genéricos e interface de coleta; substituir o executor, a gestão de sessão e a confirmação de publicação; e adicionar persistência das opções específicas, associação de participantes e controle de execução recuperável. Não basta trocar o clique final por um fetch.

## 2. File Map

Os caminhos desta tabela são relativos à raiz indicada acima, para facilitar compartilhamento. “Remover” significa somente depois de substituir consumidores e validar a migração; nenhuma remoção foi executada.

### Arquivos diretamente relacionados

| Arquivo | Responsabilidade | Camada | Relevância ManyVids | Ação proposta |
|---|---|---|---|---|
| `app/[locale]/app/distribution/page.tsx` | Seleção de mídia/contas, formulário, busca de creator remoto, thumbnail, envio e progresso | Frontend | Entrada de publicação; chamada à rota legada ausente | Modificar, preservar UX e separar contrato de execução |
| `src/lib/distribution/manyvids.ts` | Download R2, Chromium, upload por UI, editor, save | Backend legado | Executor de aproximadamente 4.300 linhas | Substituir; extrair apenas lógica independente de DOM |
| `src/lib/platforms/manyvids/browser.ts` | Perfis persistentes, abertura, verificação visual e descoberta de upload | Backend legado | Sessão por diretório/Map em memória | Substituir; remover após migração |
| `legacy-manyvids-browser/connect-route.ts` | Abre browser e redireciona para plataformas | Backend inativo | Antigo GET connect | Substituir; não restaurar cegamente |
| `legacy-manyvids-browser/status-route.ts` | Verifica UI e grava conta como CONNECTED/MANAGED_BROWSER | Backend inativo | Antigo GET status | Substituir |
| `legacy-manyvids-browser/upload-area-route.ts` | Abre tela de upload e procura controles | Backend inativo | Diagnóstico de UI | Remover após migração |
| `legacy-manyvids-browser/upload-test-route.ts` | Valida FormData/mídia/conta e chama stageManyVidsVideo | Backend inativo | Antigo POST upload-test | Substituir executor e contrato; preservar validações de autorização |
| `app/api/platforms/manyvids/upload-create-test/route.ts` | Busca de sessão, refresh e POST create com arquivo fixo | Backend ativo, teste | Prova parcial HTTP; cria estado remoto se chamado | Extrair utilitários; retirar rota de teste do produto após migração |
| `app/api/platforms/manyvids/auth-refresh-test/route.ts` | Testa refresh e detecta nomes de Set-Cookie | Backend ativo, teste | Diagnóstico, sem persistência | Substituir por serviço de sessão; depois remover rota |
| `app/api/platforms/manyvids/auth-cookie-minimum-test/route.ts` | Compara três combinações de cookies | Backend ativo, teste | Diagnóstico, não autenticação de produção | Remover após consolidar contrato validado |
| `app/api/performers/manyvids/search/route.ts` | Proxy HTTP de busca com PHPSESSID/XSRF | Backend ativo | Única busca ManyVids conectada à UI | Modificar para credenciais por conta e resposta tipada |
| `app/[locale]/onboarding/platforms/page.tsx` | Catálogo e connectPlatform | Frontend | Ainda aponta para `/api/platforms/manyvids/connect` | Modificar |
| `app/[locale]/app/platforms/page.tsx` | Listagem/nomes/conexão de contas | Frontend | Exibe ManyVids, mas connectPlatform não possui ramo ManyVids | Modificar disponibilidade e conexão |
| `src/lib/platforms/catalog.ts` | Catálogo compartilhado | Shared | ManyVids AVAILABLE, MANAGED_BROWSER, officialApi false | Modificar de acordo com a implementação real |
| `app/[locale]/app/performers/[id]/page.tsx` | Documentos e agreements locais | Frontend | Base documental com referências ManyVids | Manter; integrar seleção documental explicitamente |
| `app/api/ai/platform-captions/route.ts` | Sugestões de texto por plataforma | Backend | Prompt menciona título/descrição promocional ManyVids | Manter; revisar contrato de saída se necessário |
| `src/components/app/DashboardClient.tsx` | Dashboard e nomes de plataformas | Frontend | Rótulo ManyVids; não publica | Manter |
| `next.config.ts` | File tracing do Next | Configuração | Inclui Playwright para `/api/platforms/manyvids/*` | Remover tracing de browser depois da migração |
| `tsconfig.json` | Configuração TypeScript | Configuração | Exclui `legacy-manyvids-browser` | Manter exclusão durante transição; revisar após retirada |

### Dependências compartilhadas e adjacentes

| Arquivo | Responsabilidade | Camada | Relevância | Ação proposta |
|---|---|---|---|---|
| `app/api/distribution/route.ts` | Cria job e publicações | Backend | Executado antes do ramo ManyVids | Modificar para configuração durável, atomicidade e idempotência |
| `app/api/distribution/options/route.ts` | Lista creators, mídias, categorias e contas conectadas | Backend | Alimenta a página de distribuição | Manter; revisar capacidade/publicabilidade |
| `app/api/distribution/execute/instagram/route.ts` | Executor específico Instagram | Backend | Outro consumidor do fluxo compartilhado; não publica ManyVids | Preservar; referência de integração, não copiar protocolo |
| `src/lib/distribution/instagram.ts` | Serviço de publicação Instagram | Backend | Compartilha abstrações/dados, não é executor ManyVids | Preservar |
| `app/api/platforms/route.ts` | Catálogo e contas por workspace | Backend | Expõe estado ManyVids | Manter; alinhar semântica de conexão |
| `app/api/platforms/accounts/[id]/display-name/route.ts` | Nome local de conta | Backend | Usado pela UI compartilhada de plataformas | Manter |
| `src/lib/auth/session.ts` | getCurrentSession/requireSession | Backend | Autorização do usuário Creator Platform | Manter; não confundir com sessão ManyVids |
| `src/lib/platforms/token-crypto.ts` | AES-256-GCM para segredos | Backend/shared | Reutilizável, ainda sem consumidor ManyVids | Manter e integrar com contrato de sessão adequado |
| `src/lib/storage/r2.ts` | Cliente S3/R2, bucket, download assinado e upload de buffer | Backend/shared | Origem do vídeo, thumbnails e documentos | Manter; adaptar consumo para evitar buffer integral de vídeo |
| `src/components/app/UploadManagerProvider.tsx` | Upload local de mídia para R2 | Frontend | Pré-requisito da mídia UPLOADED, não upload ManyVids | Manter separado |
| `app/api/media/route.ts` | Biblioteca/filtros de mídia | Backend | Seleção da fonte | Manter |
| `app/api/media/upload-url/route.ts` | URL de upload local | Backend | Ingestão R2 | Manter |
| `app/api/media/multipart/start/route.ts` | Inicia multipart R2 | Backend | Não é `/uploader/create` ManyVids | Manter |
| `app/api/media/multipart/part-url/route.ts` | Assina parte R2 | Backend | Não é assinatura remota ManyVids | Manter |
| `app/api/media/multipart/complete/route.ts` | Completa ingestão e registra estado de mídia | Backend | Habilita uso da biblioteca | Manter |
| `app/api/media/multipart/abort/route.ts` | Cancela multipart R2 | Backend | Ingestão compartilhada | Manter |
| `app/api/media/[id]/preview/route.ts` | Preview local | Backend | Picker e visualização | Manter |
| `app/api/media/[id]/thumbnail-source/route.ts` | Fonte para escolher thumbnail | Backend | Editor local de imagem | Manter |
| `app/api/media/[id]/thumbnail/route.ts` | Salva thumbnail local | Backend | Não significa thumbnail aplicada no ManyVids | Manter |
| `app/api/media/[id]/thumbnail/ai/route.ts` | Geração local de thumbnail | Backend | Preparação do asset | Manter |
| `app/api/media/categories/route.ts` | Categorias da biblioteca | Backend | Organização local, não taxonomia remota | Manter |
| `app/api/media/[id]/categories/route.ts` | Associações de categoria local | Backend | Filtro da biblioteca | Manter |
| `app/api/media/[id]/route.ts` | Exclusão de mídia local | Backend | Ciclo de vida da fonte usada pelos jobs | Manter; revisar bloqueios com jobs ativos |
| `app/api/performers/route.ts` | Lista/cria performers locais | Backend | Biblioteca e participantes locais | Manter |
| `app/api/performers/[id]/route.ts` | Consulta/edição/exclusão de performer | Backend | Relações documentais e de mídia | Manter; revisar retenção/vínculos de publicação |
| `app/api/performers/[id]/documents/route.ts` | Lista/salva documentos em R2 e banco | Backend | Base documental, sem submissão remota | Manter e adicionar integração separada |
| `app/api/performers/[id]/documents/[documentId]/route.ts` | GET autorizado com redirecionamento ao arquivo | Backend | Recuperação de documento | Manter |
| `app/api/performers/[id]/agreements/route.ts` | Lista/cria Agreement e evento de auditoria | Backend | Template MV_CO_MODEL_V12 | Manter; não tratar DRAFT como consentimento aprovado |
| `app/api/performer-library/route.ts` | Pastas e operações da biblioteca | Backend | Fonte e ciclo de vida de assets vinculados | Manter |
| `src/lib/performers/library.ts` | createDefaultPerformerLibrary | Backend/shared | Organização local | Manter |
| `src/prisma/contract.prisma` | Modelos/relacionamentos | Banco | Fonte dos contratos de publicação | Modificar apenas em implementação futura |
| `src/prisma/contract.json` | Contrato emitido | Banco/gerado | Consumido pelo runtime | Regenerar futuramente, não editar à mão |
| `src/prisma/contract.d.ts` | Tipos emitidos | Banco/gerado | Tipagem do ORM | Regenerar futuramente, não editar à mão |
| `src/prisma/db.ts` | ORM e contexto por request | Backend/shared | Todas as leituras/gravações | Manter; respeitar contexto em executor futuro |
| `prisma.config.ts` | Contrato e conexão DATABASE_URL | Configuração | Emissão/evolução de schema | Manter |
| `worker/index.ts` | Entrada Vinext e banco por request | Backend/runtime | Contexto de execução em produção | Modificar apenas se necessário para novo executor |
| `vite.config.ts` | Vinext/Cloudflare/cache/images | Configuração | Build/deploy de produção | Manter; validar compatibilidade do cliente HTTP |
| `wrangler.jsonc` | Worker, bindings e limite de CPU | Configuração | Não define browser remoto ou consumidor de fila de publicação | Revisar ao escolher execução durável |
| `package.json` | Playwright, SDKs, scripts Next/Vinext | Configuração | Build Next instala Chromium | Remover dependência/instalação de browser só após eliminar consumidores |
| `package-lock.json` | Lock de dependências | Gerado | Playwright e dependências transitivas | Atualizar via gerenciador na implementação futura |
| `.gitignore` | Ignora `.runtime`, envs e builds | Configuração | Perfis/segredos não versionados | Manter proteção; não limpar perfis nesta auditoria |

Escopo de inventário: fontes de aplicação, configurações e contratos. Dependências instaladas, bundles gerados, arquivos de ambiente, cookies e perfis persistentes não foram inventariados como código próprio nem tiveram valores secretos copiados. `audit-links.txt` já existia como arquivo não rastreado e não foi usado como evidência de implementação. As três rotas em `app/api/platforms/manyvids/` também estavam não rastreadas no início; fazem parte do checkout atual, não necessariamente de um commit/deploy.

## 3. Current Publishing Flow

### 3.1 Entrada ativa e ponto onde o fluxo se interrompe

1. `DistributionPage`, em `app/[locale]/app/distribution/page.tsx`, carrega `/api/distribution/options` (`loadOptions`, ~1039). A biblioteca usa performers/pastas/mídias locais; isso é diferente do creator remoto selecionado no autocomplete ManyVids.
2. O usuário seleciona creator, mídia UPLOADED e contas de plataforma. A seleção ManyVids exibe título, descrição, preço, tags, thumbnail e busca de performer remoto.
3. `searchManyVidsPerformer` (~1893) consulta `/api/performers/manyvids/search`; a UI lê `data.data?.stars`, guarda `selectedManyVidsPerformer` e não persiste esse vínculo no banco.
4. `submitDistribution` (~3382) valida título não vazio, preço positivo, pelo menos três tags após normalização/limite de dez e presença de thumbnail CUSTOM. Valida também mídia, creator, destinos e data conforme o modo.
5. POST `/api/distribution` (~3570) envia `mediaAssetId`, `platformAccountIds`, caption, captions por conta, publishMode e scheduledAt em ISO. **Não envia título/preço/tags/performer/thumbnail ManyVids como configuração durável.**
6. A rota autentica o usuário, resolve membership, valida mídia UPLOADED e que as contas conectadas pertençam ao mesmo creator. Cria `DistributionJob` e uma `PlatformPublication` por conta como QUEUED ou SCHEDULED. Não executa ManyVids.
7. A UI filtra as publicações MANYVIDS (~3629). Se houver ao menos uma, realiza uma única chamada de staging, e não uma chamada com `platformAccountId` por publicação.
8. Monta FormData com `mediaId`, título, descrição limitada a 5.000, preço, tags, performerId/performerUsername/performerLabel quando selecionado, publishMode, scheduleDate/scheduleTime e thumbnailMode/thumbnail.
9. POST `/api/platforms/manyvids/upload-test` (~3742). **Não há `app/api/platforms/manyvids/upload-test/route.ts` no checkout auditado. O handler está arquivado fora da árvore ativa.** Não foi executada requisição para medir o status HTTP; a ausência do registro é uma constatação de arquivos.
10. A UI espera JSON, `success` e `fileSelected`. Mesmo no cenário legado, não exige `saved` ou confirmação remota para considerar a preparação concluída. Percentuais 8/22/32/58 etc. representam etapas locais, não bytes enviados ou progresso ManyVids.
11. O ramo Instagram é processado posteriormente, por rota própria. Uma exceção no ramo ManyVids pode interromper esse avanço. Os registros já criados não são revertidos pelo catch da interface.

### 3.2 Backend legado: caminho existente no código, mas inativo como rota

1. `legacy-manyvids-browser/upload-test-route.ts::POST` recebe FormData, normaliza preço/tags e valida campos, thumbnail MIME, membership, MediaAsset do workspace, status UPLOADED e mediaType VIDEO.
2. Busca a primeira PlatformAccount MANYVIDS CONNECTED do creator da mídia. Não recebe o ID da publicação/conta selecionada; seleção de múltiplas contas não fica representada com precisão.
3. Chama `stageManyVidsVideo` (~3796) com dados da mídia e formulário. Não encaminha performer nem documentos nem destinos store/premium/club.
4. O executor obtém URL R2 assinada por uma hora; faz GET, carrega o vídeo inteiro por `arrayBuffer`, grava arquivo em `os.tmpdir()/creator-platform-manyvids` e abre Chromium com perfil `.runtime/manyvids/{creatorId}`.
5. Abre `https://www.manyvids.com/upload-video`, procura input de arquivo e botão de upload. Registra IDs Edit-vid já presentes para evitar selecionar um vídeo anterior.
6. Seleciona o arquivo, clica em upload e `waitForEditUrl` procura uma URL nova `/Edit-vid/{id}` por navegação, links ou botões. O código não implementa multipart remoto diretamente: delega isso ao site dentro do browser.
7. Navega ao editor, preenche título/descrição e seleciona “No” para co-performers, conteúdo AI e 3D.
8. Preenche preço, thumbnail, tags e agendamento; tenta garantir teaser e fechar modais/popups.
9. Clica `#saveVideo`. Após 1,8 segundo, procura `.error:visible`, `.alert:visible`, `[role="alert"]:visible`. Ausência de texto de erro é tratada como sucesso; não há confirmação de resposta nem releitura persistida.
10. Retorna `externalVideoId`, URL e flags fileSelected/editPageOpened/fieldsFilled/priceFilled/thumbnailApplied/tagsFilled/scheduleConfigured/saved.
11. **Termina no JSON da requisição.** Não grava ID/URL/resultado em PlatformPublication, não finaliza DistributionJob, não incrementa attemptCount. O finally mantém Chromium aberto; o arquivo temporário principal de vídeo não é removido nesse finally. Há unlink específico da thumbnail em outro trecho, não confundir com limpeza do vídeo.

### 3.3 Conexão legada e divergência de telas

O onboarding ainda chama `/api/platforms/manyvids/connect` (`connectPlatform`, ~1166–1236), mas não há handler ativo. A página principal de plataformas possui ramos explícitos para Fanvue/Instagram/Facebook e não para ManyVids; o catálogo ainda anuncia ManyVids AVAILABLE/MANAGED_BROWSER. O handler legado de status marcaria CONNECTED com base em heurística visual; quando a verificação falha, retorna connected false sem necessariamente atualizar a conta antiga para DISCONNECTED.

## 4. Browser Automation

Dependência encontrada: `playwright` ^1.63.0, Chromium. Não foram encontrados consumidores Puppeteer nem Server Actions de browser no código próprio pesquisado.

### 4.1 Gestão de sessão: `src/lib/platforms/manyvids/browser.ts`

| Funções | Comportamento/dependência | Destino na migração |
|---|---|---|
| sanitizeCreatorId, getCreatorProfilePath, ensureRuntimeDirectory, ensureCreatorProfile | Diretórios persistentes `.runtime/manyvids` por creator | Substituir por sessão vinculada a conta; não transferir caminho como identidade |
| openManyVidsBrowser (~297), getPrimaryPage | launchPersistentContext, abre home, bringToFront | Substituir |
| inspectLoginState (~186), isManyVidsUrl, locatorIsVisible | Infere login pela URL e ausência de password/sign-in | Substituir por verificação remota de identidade validada |
| verifyManyVidsSession (~381), isProfileInUseError | Reutiliza contexto ou abre headless; detecta lock do perfil | Substituir; preservar distinção de falhas sem depender de lock de disco |
| hasActiveManyVidsSession, getActiveManyVidsSession, getManyVidsPage | Map em memória no processo | Substituir por estado durável, não compartilhado implicitamente entre instâncias |
| openManyVidsUploadArea, findManyVidsUploadControl | Navega e procura input/botão por texto | Remover |
| closeManyVidsBrowser | Fecha contexto registrado | Remover quando browser não for mais usado |

No Windows a abertura normal é visível; em outros sistemas é headless. A verificação de perfil persistido usa headless true. `openManyVidsUploadArea` pode criar contexto próprio e deliberadamente mantê-lo aberto, sem o mesmo ciclo de registro do Map principal.

### 4.2 Executor: `src/lib/distribution/manyvids.ts`

| Funções / linha aproximada | Responsabilidade |
|---|---|
| getExternalVideoId (~142), waitForEditUrl (~153) | Identifica novo vídeo por URL/DOM; exclui IDs prévios |
| chooseOptionNearQuestion (~384) | Localiza perguntas/opções por DOM e fallback |
| chooseNoCoPerformers (~646), chooseNoAiGenerated (~656), chooseNo3d (~666) | Escolhas fixas de conteúdo; não representam dados do usuário |
| fillManyVidsPrice (~676) | Preço via controles da página |
| cropAndSaveManyVidsThumbnail (~756) | Crop por mouse e ações na UI |
| normalizeManyVidsThumbnail (~1116) | Processamento de imagem executado com recursos do browser/canvas |
| applyManyVidsThumbnail (~1288) | Arquivo de thumbnail, input, crop, preview e limpeza específica |
| readManyVidsTagCount (~1503), fillManyVidsTags (~1533) | Autocomplete/chips, contagem e até três tentativas por tag |
| toManyVidsTimeLabel (~2093), configureManyVidsSchedule (~2129) | Labels de horário, calendário e opções do editor |
| ensureManyVidsTeaser (~2669) | `.js-teaser-container`, criação a partir do vídeo e polling visual |
| closeManyVidsTeaserModal (~2942), closeManyVidsGenericPopup (~3247) | Fallbacks de fechar modal, inclusive DOM/Bootstrap |
| saveManyVidsEditPage (~3427) | Clique final e inspeção de alerts |
| fillEditPage (~3530) | Coordena preenchimento e validações visuais |
| stageManyVidsVideo (~3796) | R2 → arquivo local → Chromium → upload → edição → save |

O executor abre seu próprio contexto no mesmo diretório usado pelo helper de sessão, sem compartilhar seu Map. Isso permite conflito de perfil e concorrência por creator. Não há mutex durável de publicação identificado.

### 4.3 Build e runtime

- `package.json::build`: instala Chromium com PLAYWRIGHT_BROWSERS_PATH=0 e executa next build; start também define essa variável.
- `next.config.ts`: inclui playwright/playwright-core no tracing de rotas ManyVids.
- `build:vinext` e `deploy:vinext`: caminho separado; não executam o script build Next que instala Chromium.
- `wrangler.jsonc`: nodejs_compat, bindings de assets/cache/images, limite de CPU 30.000 ms; não configura browser remoto, queue de publicação ou cron executor ManyVids.
- `worker/index.ts`: possui fetch handler com ORM por request e fechamento do banco; nenhum executor ManyVids de background encontrado nessa entrada.
- Os imports relativos dos antigos connect/status/upload-area continuam com `../../../../../src/...`, incompatíveis com a localização atual na raiz `legacy-manyvids-browser`. A exclusão de compilação não os transforma em código pronto para reativar.

## 5. Existing HTTP Logic

Esta seção lista somente URLs e comportamentos escritos no repositório. Não assume os endpoints de uma futura migração.

| Arquivo/função | HTTP remoto existente | Sessão/payload | Limite atual |
|---|---|---|---|
| performers/manyvids/search::GET | GET `https://www.manyvids.com/bff/search/creators?keywords=...` | PHPSESSID, XSRF-TOKEN, X-XSRF-TOKEN decodificado, Accept, Referer, User-Agent | Envs globais; retorna JSON upstream sem schema tipado; não associa participante |
| auth-refresh-test::POST | GET `https://api.manyvids.com/auth/token/v1` | MANYVIDS_COOKIE_HEADER, Origin/Referer e headers de browser | Detecta nomes de cookie; não persiste token ou conta |
| auth-cookie-minimum-test::runCookieTest | Mesmo GET, três chamadas sequenciais | PHPSESSID; PHPSESSID+XSRF; header completo | Não estabelece por si só quais cookies são suficientes; rota de diagnóstico |
| upload-create-test::POST, etapa SESSION_CHECK | GET BFF com keyword fixa | PHPSESSID/XSRF | HTTP ok é usado como sessionValidated; não verifica identidade/ownership |
| upload-create-test::POST, etapa AUTH_TOKEN_REFRESH | GET auth/token/v1 | Cookie completo; extrai mv.access-token de Set-Cookie | Atualiza somente header em memória para a próxima chamada |
| upload-create-test::POST, etapa UPLOAD_CREATE | POST `https://api.manyvids.com/uploader/create` | JSON file {name,size,id,isRemote,type}, meta {user_id}; cookie atualizado | Metadados fixos, size 12.510.858, MIME video/mp4; sem mídia real e sem bytes |
| stageManyVidsVideo | GET URL assinada R2 | Objeto MediaAsset autorizado no handler legado | Download integral para memória/disco; não é upload HTTP ManyVids |

Utilitários candidatos a extração: `getSetCookieValues`, `getCookieFromSetCookie`, `replaceCookieValue`, `decodeXsrfToken`, `readResponseBody`, `safeText`, `normalizeKeywords`, `safeResponseText`, `getSetCookieInfo`. Precisam de revisão: fallback de Set-Cookie agregado não é cookie jar completo; truncar texto não equivale a remover segredos; JSON desconhecido deve ser validado antes de orientar estado.

O teste create interpreta JSON da resposta externa uma vez e devolve `data`; não constrói contrato normalizado de uploadId/key, nem persiste checkpoint. Não há cliente HTTP ManyVids comum, renovação com lock, timeout explícito/AbortController ou retries estruturados nas rotas de teste analisadas. Algumas chamadas usam redirect manual, outras o comportamento padrão do fetch: a política é inconsistente.

Não foram encontradas implementações HTTP locais de assinatura/listagem/envio/conclusão/aborto de partes ManyVids, registro/processamento remoto, associação documental, edição, save final ou destinos. O comentário que menciona saveVideo.php no teste é uma descrição de algo que ele NÃO executa, não uma implementação.

## 6. Feature Map

| Área | Código atual | Estado e direção da migração |
|---|---|---|
| session/auth | getCurrentSession; browser.ts; rotas auth-*-test; legacy status; token-crypto | Separar usuário local de identidade ManyVids; preservar autorização local, substituir heurística visual e env global |
| upload | stageManyVidsVideo; upload-create-test; R2 | Legado delega bytes ao site; HTTP só cria sessão com fixture. Preservar fonte R2; implementar transporte recuperável validado futuramente |
| thumbnail | UI: seekThumbnailVideo, saveThumbnailBlob, cropImageToThumbnail, handleThumbnailFile, generateAiThumbnail, saveCurrentFrameAsThumbnail; APIs locais; funções de browser | Reaproveitar seleção/asset local. Substituir aplicação/crop remoto; AUTO/CUSTOM não prova resultado publicado |
| teaser | ensureManyVidsTeaser e closeManyVidsTeaserModal | Só DOM; sem configuração/persistência HTTP. Preview local da biblioteca é outra função |
| tags | Normalização frontend/handler; fillManyVidsTags/readManyVidsTagCount | 3–10 é regra codificada localmente, não validada nesta auditoria contra servidor. Preservar entrada/normalização, substituir autocomplete DOM por contrato remoto validado |
| performers | Performer/MediaAssetPerformer locais; searchManyVidsPerformer; proxy BFF | Diferenciar UUID local de ID remoto. Seleção de um creator remoto não é persistida nem consumida no executor |
| consent/documents | PerformerDocument, Agreement, AgreementSigner, AgreementAuditEvent; rotas locais | Armazenamento/documentação local, sem envio ManyVids; remover escolha fixa No como substituto de consentimento |
| metadata | manyVidsTitle/Description; titleFromFileName; fillEditPage | Preservar metadados; hoje opções específicas não entram no job e se perdem ao recarregar |
| pricing | Vírgula → ponto, Number, >0; fillManyVidsPrice | Preservar intenção/validação básica; definir moeda/precisão/valor canônico antes de persistir; não supor suporte a gratuito |
| scheduling | publishMode, scheduledAt ISO no job; scheduleDate/Time separados no FormData; configureManyVidsSchedule | UI inicia staging mesmo em SCHEDULED; sem executor temporal ManyVids identificado. Resolver timezone e semântica de upload antecipado versus execução futura |
| destinations | platformAccountIds na distribuição | São contas/plataformas, não destinos internos store/premium/club. Não há contrato/flags desses destinos no input do executor |
| publish | submitDistribution → rota ausente; saveManyVidsEditPage no legado | Substituir por execução vinculada a publicationId e confirmação remota/persistente |
| status | UI progress, StageManyVidsVideoResult, PlatformAccount.status; modelos de job | Percentuais locais e booleans visuais; sem reconciliação ManyVids no banco |
| retries/logging | loops DOM, três tentativas por tag, waitForTimeout, console MANYVIDS_* | Sem retry durável/idempotência. Preservar códigos úteis, adicionar contexto e redaction; não repetir efeitos incertos automaticamente |

Agendamento: `toManyVidsTimeLabel` só distingue minutos 30 ou 00; `configureManyVidsSchedule` contém ajuste para opções de meia hora. Não transportar essa regra DOM como regra de negócio HTTP sem validar. Há três representações a reconciliar: horário local do navegador, ISO do job e data/hora textual enviada à página ManyVids.

Os métodos com canvas/video no frontend são recursos normais do navegador do usuário, não Playwright. Remover automação servidor não exige eliminar o editor local de thumbnail; porém a normalização dentro do executor usa Page/canvas e não é uma função de imagem independente pronta para reutilizar.

## 7. Database Models

Fonte: `src/prisma/contract.prisma`, namespace public. Runtime `@prisma/orm-postgres`, via `db.orm.public`; não presumir Prisma Client clássico ou um schema.prisma padrão. Contratos gerados: contract.json e contract.d.ts. Nenhuma migration foi realizada.

| Modelo | Campos/relacionamentos relevantes | Uso e lacuna ManyVids |
|---|---|---|
| User / Session / WorkspaceMember | Session.tokenHash/status/expiresAt; userId; workspaceId; role; User.timezone | Autorização local, não cookies remotos. Rotas escolhem membership com first; papel administrativo específico não é exigido nos testes |
| Workspace / Creator | workspaceId, ownerUserId, displayName, status; relações com contas, mídia e jobs | Limites de tenancy e propriedade; manter |
| PlatformAccount | workspaceId, creatorId, platform, status, externalAccountId/Username/DisplayName, connectionType, accessTokenEncrypted, refreshTokenEncrypted, tokenExpiresAt, lastVerifiedAt/lastSyncAt, lastErrorCode/Message | Legado escreve CONNECTED/MANAGED_BROWSER e timestamps, sem identificar conta remota ou persistir cookies/tokens. Unique [creatorId, platform, externalAccountId] não resolve seleção de conta no handler legado |
| MediaAsset | workspaceId, creatorId, folderId, originalFileName, objectKey único, bucketName, storageProvider, contentType, fileSize BigInt, mediaType, status, durationSeconds, width/height, thumbnailObjectKey, objectEtag, timestamps de upload/processamento e erros | Fonte reutilizável. ETag R2 não é automaticamente o ETag de um upload em outro serviço |
| MediaCategory / MediaAssetCategory | nome/normalizedName por workspace; mediaAssetId/categoryId | Taxonomia local; não IDs de tags ManyVids |
| Performer | workspaceId, displayName/legalName, contato, dateOfBirth, status, notes | Não possui campo de conta/ID ManyVids |
| MediaAssetPerformer | workspaceId, mediaAssetId, performerId; chave composta mídia/performer | Associação local de participantes, sem mapeamento externo |
| PerformerLibraryFolder | performerId, parentId, name, normalizedName, folderType, systemKey, isSystem/isRequired, status | Organização da origem; não pasta/documento remoto |
| PerformerDocument | performerId/workspaceId, documentType, title, status, objectKey, bucketName, contentType, fileSize, documentNumber, issuedAt/expiresAt, notes | Documento em R2; não tem remoteDocumentId, remoteVideoId, submissão/aprovação ManyVids |
| Agreement | performerId/workspaceId, templateKey CO_PERFORMER_RELEASE, templateVersion MV_CO_MODEL_V12, status DRAFT, agreementType, contentDescription, agreementDate, governingLaw/jurisdiction, dados legais, fieldSnapshot, consentVersion | Base local; não comprova assinatura ou envio. Inclui unsignedPdfObjectKey, signedPdfObjectKey, auditPdfObjectKey, finalDocumentSha256 e timestamps, mas presença de campos não prova workflow completo |
| AgreementSigner | agreementId, role, legalName/email, status, signingTokenHash/ExpiresAt, signatureMethod/ObjectKey/Text, consentAccepted/At, viewedAt/signedAt, IP/UserAgent | Modelo para assinatura; não confundir consentAccepted com aprovação ManyVids |
| AgreementAuditEvent | agreementId/signerId, eventType, metadata, IP/UserAgent, createdAt | Auditoria local de agreement; não log de submissão remota |
| DistributionJob | workspaceId, creatorId, mediaAssetId, status DRAFT, publishMode NOW, defaultCaption, scheduledAt, startedAt/completedAt, lastErrorCode/Message | Rota grava QUEUED/SCHEDULED. Não possui snapshot de título/preço/tags/documentos/destinos ManyVids |
| PlatformPublication | distributionJobId, platformAccountId, platform, status PENDING, caption, scheduledAt, externalPostId/Url, attemptCount, startedAt/publishedAt/failedAt, lastErrorCode/Message | Unique [distributionJobId, platformAccountId]. Campos adequados a resultado geral, mas legado não os atualiza; não há uploadId/parts/checkpoint/processamento/configuração específica |
| AuditLog | userId, action, entityType/Id, metadata, IP/UserAgent | Reutilizável para ações locais; não encontrado uso como trilha completa de publicação ManyVids |

Lacunas a projetar, não alterações já decididas: snapshot versionado de opções por publicação; vínculo de performer local/ID remoto e documentos selecionados; sessão/cookie jar por conta; checkpoint de upload e IDs remotos; execução/lease/idempotência; estado de processamento/validação e eventos de tentativa. Avaliar modelos específicos ou configuração tipada, sem sobrecarregar caption ou accessTokenEncrypted com significados ambíguos.

## 8. API Routes / Server Actions

### Rotas ManyVids registradas em app/api

| Rota | Método | Responsabilidade | Observação |
|---|---|---|---|
| `/api/performers/manyvids/search` | GET | Busca remota; keyword 2–100 caracteres | Exige sessão e membership local; usa credenciais globais |
| `/api/platforms/manyvids/auth-refresh-test` | POST | Testa renovação via GET remoto | Exige sessão local, não ownership de conta específica |
| `/api/platforms/manyvids/auth-cookie-minimum-test` | POST | Executa três consultas remotas com cookies distintos | Pode renovar cookies no serviço; não é cliente de sessão reutilizável |
| `/api/platforms/manyvids/upload-create-test` | POST | Sessão → refresh → criação de multipart | Pode criar estado remoto; não é diagnóstico estritamente read-only |

### Caminhos referenciados/legados, sem route.ts ativo correspondente

| Caminho lógico | Método do arquivo legado | Implementação arquivada |
|---|---|---|
| `/api/platforms/manyvids/connect` | GET | connect-route.ts |
| `/api/platforms/manyvids/status` | GET | status-route.ts |
| `/api/platforms/manyvids/upload-area` | GET | upload-area-route.ts |
| `/api/platforms/manyvids/upload-test` | POST | upload-test-route.ts |

Os nomes acima não significam que o Next esteja registrando esses arquivos: pasta legacy e nomes `*-route.ts` não equivalem à estrutura app/api/.../route.ts.

### Rotas compartilhadas envolvidas

| Rota | Métodos | Papel |
|---|---|---|
| `/api/distribution/options` | GET | Dados iniciais da interface |
| `/api/distribution` | POST | Cria job/publicações; não executa ManyVids |
| `/api/distribution/execute/instagram` | POST | Ramo de outra plataforma na mesma submissão; dependência de regressão |
| `/api/platforms` | GET | Catálogo e contas/estado |
| `/api/platforms/accounts/[id]/display-name` | PATCH | Nome local exibido na seleção |
| `/api/media` | GET | Biblioteca/filtros |
| `/api/media/upload-url` | POST | Upload local |
| `/api/media/multipart/start`, `/part-url`, `/complete`, `/abort` | POST | Multipart R2 local |
| `/api/media/[id]/preview`, `/thumbnail-source` | GET | Fonte de preview/thumbnail |
| `/api/media/[id]/thumbnail`, `/thumbnail/ai` | POST | Preparação de thumbnail local |
| `/api/media/categories` | GET, POST | Categorias locais |
| `/api/media/[id]/categories` | GET, POST, DELETE | Vínculos locais |
| `/api/media/[id]` | DELETE | Ciclo de vida do asset |
| `/api/performers` | GET, POST | Participantes locais |
| `/api/performers/[id]` | GET, PATCH, DELETE | Cadastro e dependências |
| `/api/performers/[id]/documents` | GET, POST | Arquivos locais |
| `/api/performers/[id]/documents/[documentId]` | GET | Recupera documento autorizado |
| `/api/performers/[id]/agreements` | GET, POST | Agreements locais |
| `/api/performer-library` | GET, POST, PATCH, DELETE | Pastas/arquivos e dependências |
| `/api/ai/caption`, `/api/ai/platform-captions` | POST | Sugestões de texto, não publicação |

Não foram encontradas Server Actions (`use server`) participando da publicação ManyVids. O fluxo usa handlers HTTP e funções de backend. Não foi encontrado `/api/distribution/execute/manyvids` nem consumidor de fila ManyVids.

## 9. Reusable Code

1. **Autorização e limites de workspace/creator:** getCurrentSession e verificações de propriedade da mídia/conta. Reutilizar com resolução explícita da conta/publicação e papel autorizado, em vez de first ambíguo.
2. **Biblioteca de mídia e storage:** MediaAsset, R2, preview e thumbnails locais. Preservar objectKey/bucket/contentType/tamanho/metadados; não duplicar upload de ingestão R2 como protocolo ManyVids.
3. **Modelos de distribuição:** DistributionJob/PlatformPublication fornecem identidade, estados, resultado e tentativas. Precisam ser realmente atualizados pelo executor e complementados com configuração/checkpoints.
4. **Interface de conteúdo:** campos, seleção de arquivo/thumbnail, validação básica de preço/tags, texto assistido por IA. Desacoplar transporte e substituir progresso artificial por estado persistente.
5. **Normalização pura:** titleFromFileName, sanitização de entrada, parsing de tags/preço e keyword podem ser extraídos e tipados. Limites de 180/5.000/3–10 são regras locais; revalidar antes de apresentá-los como exigência atual do provedor.
6. **Criptografia:** encryptPlatformToken/decryptPlatformToken usam AES-256-GCM, IV aleatório de 12 bytes, chave hex de 32 bytes, formato v1. Variáveis PLATFORM_TOKEN_ENCRYPTION_KEY, fallback FANVUE_TOKEN_ENCRYPTION_KEY. Preservar compatibilidade com outros consumidores; não alterar formato global indiscriminadamente.
7. **Utilitários HTTP:** parsing controlado de resposta, detecção de redirects e códigos por etapa podem ser reaproveitados após centralização, schema validation e redaction. Não reutilizar metadados fixos do teste como entrada de produção.
8. **Performers/documentos/agreements:** manter arquivos e relações locais. Adicionar vínculo externo e evidência de submissão separadamente; não apagar base documental ao remover Playwright.

Não são diretamente reutilizáveis em HTTP: seletores, espera de modal, mouse crop, forced click, waitForEditUrl, heurística de login por ausência de senha e sucesso inferido da ausência de alerts.

## 10. Replacement Plan

Plano proposto, sem implementação e sem declarar endpoints remotos ainda não presentes no código.

| Área atual | Substituição necessária | Condição para retirar legado |
|---|---|---|
| Perfil Chromium + Map + status visual | Serviço de sessão por PlatformAccount, segredo cifrado, identidade/expiração verificadas e renovação controlada | Contrato de sessão validado e reconexão definida |
| upload-test sem publicationId | Execução por publicação/conta explicitamente autorizada | Configuração durável e isolamento por conta funcionando |
| Download integral e file input | Transporte HTTP com limites de memória, checkpoint e retomada | Protocolo remoto documentado e resultados conferidos |
| Busca por Edit-vid novo | Captura/persistência do ID devolvido pela etapa remota apropriada | IDs e estado reconciliados sem DOM |
| fillEditPage e helpers | Serialização tipada de metadados e operações remotas validadas | Paridade de campos e tratamento de erros comprovados |
| chooseNoCoPerformers/AI/3D fixos | Dados explícitos do conteúdo e participantes | Sem declarações silenciosas incompatíveis com a mídia |
| Documentos apenas locais | Seleção e associação rastreável por publicação/performer | Evidência de submissão e semântica de status definida |
| Save com clique | Verificação explícita de resposta + releitura/status conforme contrato | Publicação confirmada sem inferência visual |
| UI orquestrando vários efeitos | Orquestração durável independente da aba | Retomada após fechar navegador e isolamento de falha por destino |
| Rotas *-test expostas | Serviço interno consolidado e diagnóstico restrito/redigido | Nenhum consumidor depende dos testes |
| Playwright/tracing/install Chromium | Remover dependências após zerar usos | Busca de imports/scripts e checks de build concluídos |

O plano não propõe reativar automaticamente os arquivos legacy nem copiar endpoints da investigação externa sem validação do contrato. Toda mutação remota futura deve estar fora desta auditoria.

## 11. Risks and Dependencies

### Riscos prioritários

1. **Declaração incorreta de participantes:** seleção da UI é descartada e o executor marca No. Também marca No para AI e 3D sem coletar essas decisões no input.
2. **Estado remoto versus estado local:** jobs são criados antes da chamada ausente e não são atualizados pelo legado. Reenvio pelo usuário pode criar jobs duplicados; a unique publication/job/account não impede duplicação entre jobs diferentes.
3. **Seleção de conta perdida:** uma chamada para qualquer quantidade de publicações ManyVids e `.first()` de conta no handler. Não há garantia de publicar na conta escolhida quando houver múltiplas.
4. **Sessão compartilhada globalmente nos testes:** auth local permite acionar uma sessão ManyVids do ambiente sem correlação com a conta/workspace. A keyword de teste com HTTP ok não valida ownership.
5. **Falso sucesso de save:** 1,8 segundo e ausência de alert não demonstram persistência/publicação; alert genérico também pode causar falso erro. A UI verifica fileSelected, não publicação confirmada.
6. **Worker versus browser local:** nenhuma configuração de serviço Chromium remoto; filesystem/perfil/processo persistente pressupostos pelo legado não correspondem ao caminho de deploy mostrado. Compatibilidade do futuro HTTP com runtime deve ser verificada, sem presumir que todos os módulos Node se comportem igualmente.
7. **Memória e recursos:** vídeo inteiro em arrayBuffer, arquivo temporário e contextos mantidos abertos. Execuções concorrentes podem conflitar no perfil; retry total pode repetir upload/save.
8. **Ausência de payload durável:** banco guarda caption/schedule, mas não título/preço/tags/thumbnail/participantes/destinos. Um worker não consegue reconstruir a intenção apenas com o job atual.
9. **Timezone e agendamento:** ISO, strings locais, slots de meia hora e defaults não são reconciliados explicitamente. Não há executor temporal ManyVids encontrado; status SCHEDULED por si só não agenda execução.
10. **Cookie parsing e redaction:** getSetCookie fallback e substituição manual não cobrem cookie jar completo; truncamento de body não remove dados sensíveis. Respostas upstream são devolvidas em diagnósticos, algumas sem truncamento de JSON.
11. **Atomicidade:** criação de job e publicações é sequencial, sem transação explícita nessa rota; falha intermediária pode deixar conjunto parcial. Não foi executado teste de concorrência.
12. **Regressões multiplataforma:** distribuição, criptografia, banco, biblioteca e UI são compartilhados. Mudanças no contrato genérico precisam preservar Instagram/Fanvue e outras contas; retirar apenas a dependência ManyVids onde aplicável.
13. **Persistência documental:** modelo local de assinatura não prova aprovação remota. Remoções locais de performer/documento/mídia precisam considerar publicações ativas e evidências já vinculadas antes de estender relações.
14. **Checkout versus deploy:** rotas de teste estão não rastreadas. Este relatório não confirma que produção contenha esses mesmos arquivos ou credenciais.

### Grafo de dependências relevante

```text
DistributionPage
  ├─ distribution/options → Session + ORM → mídia/contas/categorias
  ├─ performers/manyvids/search → envs globais → HTTP remoto
  ├─ APIs locais de mídia/thumbnail/performers/IA
  └─ distribution POST → DistributionJob + PlatformPublication
       └─ UI chama upload-test [handler ativo ausente]
            └─ legacy upload-test → Session + ORM
                 └─ stageManyVidsVideo → R2 + disco + Playwright
                      └─ página ManyVids → upload/editor/save por DOM

Onboarding → connect [handler ativo ausente]
  └─ legacy connect/status/upload-area → browser.ts → perfil Chromium
       └─ legacy status → PlatformAccount CONNECTED/MANAGED_BROWSER

HTTP *-test → Session local + envs → auth/create remotos
  [sem vínculo com DistributionJob, PlatformPublication ou token-crypto]

Worker fetch → createDatabase + runWithRequestDatabase → handlers → close
```

Um executor em fila/background terá de receber/criar seu próprio contexto de banco e ciclo de vida; não pode depender da disponibilidade do AsyncLocalStorage de uma requisição encerrada. Em produção, `src/prisma/db.ts` lança DATABASE_REQUEST_CONTEXT_MISSING quando esse contexto não existe; o fallback global é só de desenvolvimento.

## 12. Recommended Implementation Order

1. **Definir o contrato de intenção:** publicationId, conta/creator/workspace, asset, metadados, preço, thumbnail, participantes/documentos, horário/timezone e destinos internos desejados. Diferenciar IDs locais/remotos e campos opcionais de capacidades ainda não verificadas.
2. **Validar as lacunas do protocolo remoto em etapa separada:** autenticação/identidade, transporte, processamento, save, documentação, scheduling e destinos. Registrar evidências e respostas; esta auditoria não autoriza nem executa mutações remotas.
3. **Projetar persistência e execução:** snapshot versionado, checkpoints, idempotência, lease/concorrência, estados de tentativa e reconciliação. Avaliar extensão de modelos/contratos Prisma e execução compatível com o deploy.
4. **Consolidar sessão HTTP por conta:** criptografia, cookie handling, expiração, renovação, ownership, redaction e reconexão. Só então substituir catálogo/status e o fluxo de conexão das duas telas.
5. **Extrair cliente HTTP e validações reutilizáveis:** limites, timeout, redirect policy, resposta tipada e erros por etapa; retirar fixtures e acesso global a cookies do caminho produtivo.
6. **Implementar transporte da mídia e registro remoto com checkpoints:** manter R2 como origem, evitar buffer integral, persistir identificadores e tornar retomada segura antes de save/publicação.
7. **Implementar participantes e documentos:** vínculo local/remoto, seleção de arquivos, submissão e status conforme contrato validado; eliminar No fixo e não avançar com consentimento ambíguo.
8. **Implementar metadados, preço, tags, thumbnail, teaser, scheduling e destinos:** cada capacidade deve ter validação própria e preservar exatamente a intenção registrada, sem defaults silenciosos não confirmados.
9. **Implementar finalização e reconciliação:** gravar externalPostId/Url e estado somente com evidência; tratar efeito remoto incerto antes de tentar de novo. Atualizar também o job agregado sem confundir upload, processamento e publicação.
10. **Conectar UI à execução persistente:** trocar upload-test, fornecer estado real/progresso por publicação, isolamento de falha entre plataformas e recuperação após recarregar/fechar a aba.
11. **Validar cenários relevantes:** sessão expirada, conta incorreta, múltiplos destinos/contas, timeout após efeito remoto, retomada de partes, documentação insuficiente, agendamento/timezone e regressões nos fluxos compartilhados. Testes de mutação dependem de autorização e ambiente apropriado em trabalho futuro.
12. **Retirar legado e testes expostos:** remover helpers/rotas arquivadas obsoletos, referências de UI, tracing e instalação Chromium após confirmar ausência de consumidores. Tratar perfis/cookies antigos com migração/retenção explícita, sem apagá-los indiscriminadamente. Atualizar lock e contratos gerados pelo fluxo oficial.

Critério de conclusão futuro: uma publicação deve ser identificável por conta/job, recuperar-se de interrupções, preservar participantes e opções, confirmar o resultado remoto e refletir o estado no banco sem Chromium, sem rota de teste e sem depender da aba do usuário. Este documento apenas audita e recomenda; não implementa esse critério.
