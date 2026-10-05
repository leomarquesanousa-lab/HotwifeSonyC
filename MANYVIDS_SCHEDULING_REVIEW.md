# Revisão do agendamento ManyVids

## Resultado

Agendamento interno implementado no repositório, reutilizando o executor HTTP de publicação imediata. Os botões “Publicar agora” e “Agendar” foram preservados. Não houve publicação real, alteração de registros no banco, aplicação de migration, deploy ou push.

**Ainda não está ativado em produção:** é necessário revisar/aplicar a migration aditiva e posteriormente disponibilizar o Worker com o Cron. Essas ações não foram executadas.

## Como funcionava antes

- A interface desabilitava “Agendar” quando ManyVids estava selecionado e bloqueava o modo diferente de NOW.
- DistributionJob e PlatformPublication já possuíam status e scheduledAt. PlatformPublication também tinha tentativas, timestamps, erros e identificador remoto.
- Faltava persistir as opções completas de publicação para execução posterior.
- O executor aceitava apenas publicação imediata. O Worker atendia requisições HTTP, mas não possuía consumidor periódico de publicações agendadas.
- Não foi identificado parâmetro de agendamento remoto comprovado no fluxo HTTP mapeado. A implementação antiga com browser não comprova suporte equivalente nesses endpoints. O protocolo HTTP foi preservado.

## Como funciona agora

1. O usuário seleciona “Agendar”, escolhe data/hora e vê o fuso utilizado no seletor existente.
2. A interface valida o horário e converte a escolha para UTC. O backend repete a validação de data futura e verifica conta, mídia e opções.
3. Uma transação salva DistributionJob e PlatformPublication como SCHEDULED, scheduledAt em UTC e as opções completas em publishingOptions. Nenhum cliente ManyVids é instanciado nessa operação.
4. O Cron do mesmo Worker roda a cada minuto e procura publicações ManyVids vencidas, ordenadas pelo horário.
5. O executor compartilhado verifica novamente os dados, adquire a publicação de forma condicional, muda para PUBLISHING e incrementa a tentativa.
6. Executa o mesmo publishManyVids utilizado por “Publicar agora”, com as opções persistidas. Não existe um segundo protocolo de publicação.
7. Salva PUBLISHED ou FAILED, timestamps e erros; reconcilia o estado agregado do job. O identificador remoto é preservado quando já conhecido.

Agendar ManyVids junto com outras plataformas na mesma solicitação é recusado com mensagem traduzida: deve-se agendá-lo separadamente. Isso evita prometer execução agendada para plataformas não atendidas por este Cron. Os executores Instagram/Fanvue não foram alterados.

## Execução e prevenção de duplicidade

- O handler scheduled reutiliza o contexto de banco do Worker e aguarda o executor antes de fechar a conexão.
- Uma transação bloqueia a conta e verifica publicações PROCESSING/PUBLISHING em andamento.
- A aquisição exige o status esperado, attemptCount igual a zero e ausência de externalPostId; somente quem atualiza a linha pode iniciar o envio.
- Invocações concorrentes não executam novamente a mesma publicação. Conta ocupada é adiada sem consumir tentativa.
- A rota manual não permite antecipar uma publicação agendada. Publicação já confirmada recebe resposta idempotente.
- FAILED não recebe retry automático. Se houver vídeo remoto ou tentativa anterior, é necessária revisão para evitar novo upload indevido.
- Uma execução agendada interrompida por mais de 20 minutos é marcada FAILED com REMOTE_EXECUTION_INTERRUPTED; o identificador remoto é mantido e não há reenvio automático.
- A proteção é por publicação. Duas solicitações distintas criadas pelo usuário continuam sendo duas publicações distintas.

Cada invocação examina até 20 candidatas e usa um orçamento de execução para uma publicação. O executor agendado tem limite de aproximadamente 10 minutos, incluindo limites das transferências. Filas, conta ocupada, processamento remoto e intervalo do Cron podem atrasar a disponibilidade: o horário escolhido representa o início pretendido do processamento, não disponibilidade garantida no segundo exato.

O Cron foi configurado como `* * * * *` e permaneceu no artefato final Vinext. Cloudflare interpreta expressões Cron em UTC e mudanças de configuração podem levar até 15 minutos para propagar. [Documentação de Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/).

O handler scheduled foi usado para aguardar a execução; tarefas Cron têm limite de duração de 15 minutos. O limite de CPU configurado também continua aplicável e deve ser acompanhado no ambiente real. [Limites do Workers](https://developers.cloudflare.com/workers/platform/limits/) e [handler scheduled](https://developers.cloudflare.com/workers/runtime-apis/handlers/scheduled/).

## Timezone e interface

- Usa o timezone IANA do usuário autenticado, já existente no projeto; se inválido, utiliza UTC.
- Mostra o fuso no seletor e interpreta atalhos de calendário nesse mesmo fuso.
- Armazena o instante em UTC e preserva o nome do fuso no snapshot de opções.
- Rejeita horários passados, datas inválidas e horários inexistentes ou ambíguos na mudança de horário de verão, com mensagens compreensíveis.
- O calendário existente foi reutilizado, sem redesenho do formulário.
- Mensagens novas foram incluídas nos cinco locales: en-US, pt-BR, es-ES, fr-FR e cs-CZ.

## Diagnóstico do teaser

A leitura do banco foi somente leitura. A publicação mais recente consultada estava QUEUED e apontava para uma mídia UPLOADED com durationSeconds, width e height nulos. Não foi feita medição do arquivo; a duração aproximada de 14 segundos foi informada pelo usuário, não inferida ou gravada.

A interface substituía duração ausente por zero e acabava mostrando “Choose a start time within the video”. Além disso, a lista de mídia selecionada podia permanecer desatualizada após uma atualização do catálogo.

A correção distingue metadados ausentes de início realmente inválido, atualiza os metadados a partir do catálogo atual e impede respostas antigas de sobrescreverem a seleção atual. A regra permanece `0 <= início < duração`: 10 segundos em um vídeo de 14 segundos é válido. Durante carregamento, a interface informa que ainda está carregando os dados, sem apresentar validação enganosa.

**A mídia antiga consultada ainda precisa de metadados medidos por backfill controlado ou novo upload válido antes de outro teste.** Nenhum valor foi inventado e nenhum registro foi corrigido manualmente nesta etapa.

## Arquivos criados ou modificados

| Arquivo | Alteração |
|---|---|
| app/[locale]/app/distribution/page.tsx | Habilitação do agendamento, seletor/fuso, validações, envio do snapshot e atualização dos metadados selecionados |
| src/components/app/ManyVidsPublishingOptions.tsx | Remoção do bloqueio de agendamento, catálogo atualizado e validação correta do teaser |
| app/api/distribution/route.ts | Criação transacional do agendamento ManyVids |
| app/api/distribution/options/route.ts | Disponibilização do timezone do usuário |
| app/api/distribution/execute/manyvids/route.ts | Autorização e delegação ao executor compartilhado |
| src/lib/distribution/execute-manyvids.ts | Executor extraído e compartilhado, aquisição condicional e execução agendada |
| src/lib/distribution/manyvids-scheduling.ts | Persistência, seleção de pendências e tratamento de execuções interrompidas |
| src/lib/distribution/schedule-time.ts | Conversão de horário local para UTC e validação de horário de verão |
| src/lib/distribution/job-status.ts | Reconhecimento de PUBLISHING na agregação |
| src/lib/platforms/manyvids/http/teaser-validation.ts | Validação compartilhada de duração/início |
| src/lib/platforms/manyvids/http/local-options.ts | Dimensões no catálogo de mídia |
| src/lib/platforms/manyvids/http/client.ts | Orçamento de tempo opcional para execução agendada |
| src/lib/platforms/manyvids/http/upload.ts | Transferências limitadas pelo orçamento de tempo |
| worker/index.ts | Handler scheduled no Worker existente |
| wrangler.jsonc | Cron a cada minuto |
| src/prisma/contract.prisma | Campo nullable publishingOptions em PlatformPublication |
| src/prisma/contract.json e src/prisma/contract.d.ts | Contratos regenerados |
| migrations/app/20260917T2250_baseline/ | Baseline gerado pela ferramenta de migrations |
| migrations/app/20260917T2251_manyvids_publishing_options/ | Migration aditiva do campo de opções |
| migrations/snapshots/e80392bdce746abf03970fe033403ffc1457071f57040cab1e97a4426352deeb/ | Snapshot gerado do contrato |
| i18n/messages/en-US.json, pt-BR.json, es-ES.json, fr-FR.json e cs-CZ.json | Mensagens traduzidas de agendamento e validação |
| scripts/test-manyvids-scheduling.mjs | Testes isolados de agendamento e concorrência |
| scripts/test-manyvids-schedule-ui.mjs | Teste da página real com APIs simuladas |
| MANYVIDS_SCHEDULING_REVIEW.md | Este relatório |

Arquivos não rastreados que já existiam antes desta tarefa foram preservados e não fazem parte dessa lista de alterações.

## Banco e ativação futura

O delta de banco é somente uma coluna JSON nullable: `PlatformPublication.publishingOptions`. Os campos de data/status existentes foram reutilizados; nenhuma tabela ou sistema paralelo foi criado.

A ferramenta gerou um pacote baseline porque o grafo anterior continha referências/snapshots sem pacotes equivalentes. Antes de aplicar em banco existente, deve-se revisar o baseline e o estado do grafo; não executar bootstrap indiscriminadamente contra banco populado. A checagem offline de integridade passou. Nenhuma migration foi aplicada.

A coluna precisa existir antes de ativar esta versão, pois o ORM atualizado a utiliza. Publicações antigas sem snapshot não podem ser reconstruídas por adivinhação: ao vencer, são marcadas para revisão com SCHEDULE_OPTIONS_MISSING. A ativação do Worker/Cron depende de deploy posterior, fora do escopo autorizado.

## Validação realizada

- Typecheck aprovado, inclusive após build e regeneração dos tipos de rotas.
- Build Vinext aprovado; Cron e handler scheduled presentes no artefato gerado.
- 11 testes locais de agendamento aprovados: persistência sem chamada externa, execução vencida, concorrência, conta ocupada, horários UTC/DST, bloqueio de antecipação, snapshot ausente, falhas e preservação de identificador remoto.
- 16 testes HTTP existentes aprovados, incluindo confirmação final e timeout.
- Teste existente do formulário ManyVids aprovado.
- Teste da página de distribuição aprovado com APIs simuladas: catálogo atualizado, início 10/14 válido, metadados ausentes com mensagem correta, seletor/fuso, payload UTC e nenhuma execução imediata ao agendar. Reexecutado após o ajuste final do calendário.
- Lint dirigido sem erros nos demais arquivos alterados; a página de distribuição mantém sete erros preexistentes, comparados com HEAD. Nenhum erro novo foi introduzido. Avisos preexistentes de imagem/variáveis também permanecem.
- `prisma migration check` aprovado, sem aplicar alterações.

## Limitações restantes

- Não foi testada publicação real nem execução Cron em produção, conforme solicitado.
- A ativação depende da migration e do deploy posterior; configuração local não ativa Cron remoto.
- O vídeo antigo consultado continua sem os metadados necessários.
- Sessão expirada, indisponibilidade do serviço remoto, limites de CPU/tempo e arquivos lentos podem causar falha; os estados/erros ficam registrados.
- Falhas exigem revisão antes de uma nova tentativa, especialmente quando já existe externalPostId. Não foi implementado retry automático inseguro.
- Horários muito concorridos podem formar fila, sobretudo na mesma conta.
- Sete erros antigos de lint da página permanecem fora do escopo desta correção.
