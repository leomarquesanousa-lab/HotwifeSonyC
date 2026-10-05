# Email Verification Audit — Creator Platform

Data: 16 de setembro de 2026.

## Resumo executivo

**O sistema realmente tenta enviar a confirmação, por Resend.** O caminho de envio existe, é aguardado pelo cadastro e trata o erro retornado pelo SDK. No banco apontado pela configuração local, as consultas dos últimos 30 dias encontraram **5 eventos de envio com ID do provedor, 0 eventos de falha de envio e 3 usuários PENDING sem token de confirmação válido**. Dois desses usuários têm histórico de envio; um não tem token cadastrado.

Isso demonstra chamadas anteriormente aceitas pelo provedor, **não entrega na caixa de entrada**. Não foi comprovada uma falha atual de envio em produção, nem uma causa única para “não recebi o e-mail”. O problema de recuperação está comprovado: não existe reenvio, os tokens expiram em 24 horas e uma nova tentativa de cadastro com o mesmo e-mail retorna conflito.

Há também configuração local inadequada para links públicos: APP_URL está presente, mas aponta para loopback e não usa HTTPS. Isso prejudica a ativação se essa configuração for usada para usuários externos; não explica, por si só, ausência do e-mail. Não foi confirmado que o Worker de produção tenha a mesma configuração.

## Escopo e cuidados

- Inspeção do código, SDK instalado e presença/formato das variáveis; nenhum valor de ambiente foi copiado para este relatório.
- Consultas SQL exclusivamente SELECT, com conexão configurada com default_transaction_read_only=on. Não foram alterados usuários, tokens, status ou logs de aplicação.
- Consultas GET ao Resend para listar domínios e histórico existente; nenhuma chamada de envio, reenvio ou verificação de domínio.
- Consultas públicas de DNS do domínio configurado, retornando somente presença de registros, sem nomes/valores da configuração.
- Consulta às documentações oficiais Resend e Cloudflare.
- Não foram executados cadastro, confirmação de token, teste de e-mail, build ou deploy. Este Markdown é o único arquivo criado/alterado nesta investigação.
- Os dados consultados pertencem ao banco referenciado pelo .env deste checkout. Não foi estabelecido que ele seja exatamente o banco usado pelo deployment em que ocorreu a reclamação.

## A–F: respostas diretas

| Pergunta | Resposta e evidência |
|---|---|
| A. Hoje tenta enviar? | Sim, quando o cadastro chega à etapa posterior à criação do token. Há chamada aguardada e registros históricos com ID do provedor. Uma exceção anterior impede que essa etapa seja alcançada. |
| B. Em qual arquivo? | app/api/auth/sign-up/route.ts:187 chama sendVerificationEmail; src/lib/email/send-verification-email.ts:98 chama resend.emails.send. |
| C. Qual serviço? | Resend, SDK npm resend declarado em package.json. API HTTPS; não é SMTP/nodemailer. |
| D. Falta configuração? | Localmente RESEND_API_KEY, EMAIL_FROM, APP_URL e DATABASE_URL estão presentes. APP_URL é local/loopback, inadequada para ativação externa. As três variáveis de e-mail não constam no wrangler.jsonc nem no .env.example. Isso não prova ausência de secrets/bindings no Worker, pois podem estar configurados no painel. |
| E. Envio retorna erro? | Não foi disparado envio para testar. Não há EMAIL_VERIFICATION_SEND_FAILED na janela consultada; os 5 EMAIL_VERIFICATION_SENT têm providerMessageId. As consultas administrativas GET retornaram HTTP 401 restricted_api_key, que é restrição de leitura de uma chave de envio, não evidência de falha do envio. |
| F. Menor correção definitiva? | Não falta implementar o envio inicial nem trocar o provedor. Confirmar configuração efetiva de produção e entrega no painel; corrigir APP_URL se estiver local; implementar reenvio controlado para contas PENDING e exibir a falha específica de confirmação na UI. Recuperação de usuários já presos exige novo token/e-mail, não novo cadastro nem ativação forçada. Nada disso foi executado nesta auditoria. |

## 1. Fluxo completo de cadastro

1. **Frontend:** app/[locale]/sign-up/page.tsx:125 envia POST /api/auth/sign-up com nome, sobrenome, e-mail, senha, confirmação, accountType, aceite e locale.
2. **Validação:** app/api/auth/sign-up/route.ts valida Zod, normaliza e-mail para minúsculas, verifica confirmação de senha e consulta usuário existente. E-mail já cadastrado retorna 409 EMAIL_ALREADY_EXISTS antes de criar token/enviar e-mail.
3. **Usuário:** a mesma rota, linha 136, gera hash Argon2id e cria User com status PENDING. emailVerifiedAt permanece nulo.
4. **Estrutura local:** cria Workspace ACTIVE, WorkspaceMember OWNER e, para conta CREATOR, Creator ACTIVE. Não cria sessão de login neste caminho.
5. **Auditoria:** grava ACCOUNT_CREATED.
6. **Token:** linha 184 chama createEmailVerificationToken(user.id).
7. **Envio:** linha 187 aguarda sendVerificationEmail. Não é uma tarefa esquecida sem await e não depende de cron/fila.
8. **Aceitação:** se o helper retorna sem erro, grava EMAIL_VERIFICATION_SENT com provider=RESEND, expiresAt e providerMessageId; retorna HTTP 201, success=true e verificationRequired=true.
9. **Frontend:** mostra accountCreated e redireciona ao login após 1,5 segundo. Não oferece uma tela funcional de reenvio.
10. **Falha:** se o helper ou a gravação do log de sucesso lança erro, entra no catch específico, registra EMAIL_VERIFICATION_SEND_FAILED e retorna HTTP 503 VERIFICATION_EMAIL_FAILED. A conta e o token criados anteriormente permanecem.

Não há uma transação envolvendo todas essas gravações. Uma falha na criação de workspace, membership, creator, audit ou token também pode deixar estado parcial; o catch externo devolve 500 INTERNAL_SERVER_ERROR. Portanto, conta existente não significa necessariamente que o código chegou ao envio.

## 2. Geração, persistência e consumo do token

src/lib/auth/email-verification.ts:11–32:

- Gera 32 bytes aleatórios e os representa em hexadecimal.
- Calcula SHA-256 do token.
- Persiste apenas tokenHash, userId e expiresAt; o token bruto fica em memória para compor o link.
- A duração é fixa: 24 horas. Não depende de variável de ambiente.
- A função não invalida tokens anteriores; hoje só é chamada no cadastro encontrado.

Modelos em src/prisma/contract.prisma:

| Modelo | Campos relevantes |
|---|---|
| User, linha 4 | id, email único, passwordHash, status com default PENDING, emailVerifiedAt opcional, locale, createdAt, updatedAt |
| EmailVerificationToken, linha 560 | id, userId, tokenHash único, expiresAt, usedAt opcional, createdAt; índices por userId/expiresAt |
| AuditLog | ACCOUNT_CREATED, EMAIL_VERIFICATION_SENT, EMAIL_VERIFICATION_SEND_FAILED e EMAIL_VERIFIED; metadata do envio guarda expiração/provedor/ID quando aceito |

No banco inspecionado, os nomes físicos são public."user", public."emailVerificationToken" e public."auditLog", diferentes da capitalização dos nomes do ORM. Uma primeira consulta com nomes capitalizados retornou 42P01; a introspecção somente leitura identificou os nomes corretos e as consultas posteriores funcionaram. **Esse erro do diagnóstico não é uma falha do fluxo de cadastro.**

### Confirmação

- Página: app/[locale]/verify-email/page.tsx; URL /{locale}/verify-email?token=….
- A página lê o token e envia POST /api/auth/verify-email.
- app/api/auth/verify-email/route.ts calcula o hash e consulta o token.
- Recusa token inexistente, usado ou expirado com INVALID_TOKEN, TOKEN_ALREADY_USED ou TOKEN_EXPIRED.
- Atualiza User para ACTIVE e preenche emailVerifiedAt; depois grava usedAt no token e EMAIL_VERIFIED no audit.
- A página oferece navegação ao login, tanto no sucesso quanto no erro; não há reenvio.
- As atualizações de usuário/token/audit também não são transacionais. Requisições concorrentes e falha intermediária podem produzir registros divergentes; não atribuir automaticamente contagem de eventos ao número de usuários distintos.
- Login, app/api/auth/login/route.ts:199–239, bloqueia PENDING com HTTP 403 EMAIL_NOT_VERIFIED.

## 3. Provedor, remetente e variáveis

### Provedor

src/lib/email/resend.ts lê RESEND_API_KEY no escopo de módulo e instancia new Resend(apiKey). src/lib/email/send-verification-email.ts compõe HTML localizado e chama o SDK com from, to, subject e html. O SDK instalado usa a API HTTPS do Resend. Não foi encontrado outro mecanismo de envio de confirmação via SMTP, SendGrid, Postmark, SES direto ou nodemailer.

src/lib/email/send-password-reset-email.ts compartilha o cliente e a configuração, mas recuperação de senha não constitui reenvio de ativação.

### Variáveis e resultado da inspeção local

| Variável | Função | Resultado sem expor valor |
|---|---|---|
| RESEND_API_KEY | Autenticação de envio | Presente e não vazia no .env; consultas de administração recusadas por restrição da chave |
| EMAIL_FROM | Remetente do e-mail | Presente e não vazia; formato de mailbox reconhecido |
| APP_URL | Origem do link de confirmação | Presente e URL válida, mas loopback e sem HTTPS; não adequada para link externo |
| DATABASE_URL | Persistência de conta, token e audit | Presente; acesso de leitura confirmado |

O .env.example não documenta as três variáveis de e-mail. Nomear as variáveis aqui não revela seus valores. Não foram consultados/expostos secrets efetivos do Worker implantado.

### FROM exato no código

A regra em src/lib/email/send-verification-email.ts:94–96 é: usar EMAIL_FROM se não vazia; caso contrário, usar o literal de código **Creator Platform <noreply@maconfeccoes.com.br>**. Esse literal é o fallback versionado, não a reprodução do valor atual de EMAIL_FROM. O remetente efetivo configurado foi deliberadamente omitido, conforme solicitado.

O link usa APP_URL; se ausente, o código também tem fallback local. Há risco de link apontar para máquina do destinatário quando uma configuração local é usada em ambiente externo. O código não valida a origem nem exige HTTPS antes do envio.

### Local versus Cloudflare/Vinext

- O desenvolvimento local carrega envs; src/prisma/db.ts também importa dotenv/config.
- worker/index.ts lê env.DATABASE_URL para seu cliente de banco por request. E-mail lê process.env, não esse parâmetro diretamente.
- wrangler.jsonc tem compatibility_date 2026-09-13 e nodejs_compat. Para essa configuração, Cloudflare oferece bindings/secrets em process.env; não há base para culpar automaticamente a diferença env versus process.env. [Documentação oficial](https://developers.cloudflare.com/workers/configuration/environment-variables/).
- O wrangler.jsonc inspecionado não menciona RESEND_API_KEY, EMAIL_FROM ou APP_URL. Secrets no painel não aparecem obrigatoriamente no arquivo. Presença no .env/build local não comprova presença no deployment.
- Se a chave faltar no runtime, o código emite um aviso, mas o construtor do SDK instalado também lança erro durante a importação. A falha pode ocorrer antes de entrar no POST/catch do cadastro, impedindo inclusive um diagnóstico específico da rota.

## 4. SPF, DKIM e DMARC

O domínio de envio precisa ser adicionado e verificado no Resend. SPF e DKIM fazem parte dessa configuração; DMARC complementa autenticação/política e reputação, mas não deve ser confundido com pré-requisito universal adicional do método de envio. Usar os registros exatos fornecidos para a conta/domínio e verificar alinhamento. [Adicionar domínio](https://resend.com/docs/add-a-domain), [domínios verificados](https://resend.com/docs/dashboard/domains/introduction), [DMARC](https://resend.com/docs/dashboard/domains/dmarc).

Consultas DNS realizadas sem exibir domínio ou conteúdo:

| Consulta | Resultado |
|---|---|
| SPF no domínio do remetente configurado | Registro encontrado |
| SPF no subdomínio padrão send do domínio | Registro encontrado |
| DKIM no seletor padrão resend._domainkey | Registro encontrado |
| DMARC em _dmarc do domínio | Registro encontrado |

Isso afasta a hipótese simples de ausência total desses registros nos nomes consultados. **Não comprova** que os valores estejam corretos, que esse seja o seletor/return-path efetivo, que o domínio esteja verificado na mesma conta Resend ou que uma mensagem passe nos testes de alinhamento. Não houve modificação de DNS ou solicitação de verificação de domínio.

## 5. Evidência operacional existente

### Banco, janela de 30 dias

| Indicador | Resultado |
|---|---:|
| ACCOUNT_CREATED | 5 eventos |
| EMAIL_VERIFICATION_SENT | 5 eventos |
| Envios com providerMessageId presente | 5 |
| EMAIL_VERIFICATION_SEND_FAILED | 0 eventos |
| EMAIL_VERIFIED | 4 eventos |
| Usuários criados na janela, status ACTIVE | 3, todos com emailVerifiedAt |
| Usuários criados na janela, status PENDING | 3, todos sem emailVerifiedAt |
| Tokens criados na janela | 5 |
| Tokens com usedAt | 3 |
| Tokens não usados e expirados | 2 |
| Usuários PENDING da janela com histórico de envio | 2 |
| Usuários PENDING da janela com token válido não usado | 0 |
| Usuários PENDING da janela sem qualquer token | 1 |

Eventos, usuários e tokens não têm necessariamente relação 1:1. Os dados não permitem afirmar por que o usuário sem token foi criado: pode ser estado parcial, outro caminho ou intervenção anterior. Não foram recuperados nomes, e-mails, tokens, hashes ou corpos de mensagens.

### Resend, consultas sem enviar e-mail

GET /domains e GET /emails?limit=100 retornaram **HTTP 401, restricted_api_key**. Segundo o Resend, essa combinação indica chave restrita a envio, sem acesso às operações administrativas. **Não significa que a chave não possa enviar.** Não é necessário ampliar as permissões da chave de produção para enviar confirmações. Para diagnosticar entrega, usar o painel autorizado do provedor. [Códigos de erro](https://resend.com/docs/api-reference/errors), [listagem de domínios](https://resend.com/docs/api-reference/domains/list-domains), [listagem de envios](https://resend.com/docs/api-reference/emails/list-emails).

Não foi possível consultar com essa chave os estados delivered, bounced, suppressed ou failed dos envios existentes, nem o estado verificado do domínio na conta. Não há evidência para declarar spam, bounce, quota, remetente não verificado ou indisponibilidade do Resend como causa confirmada.

## 6. Erros ocultados ou classificados incorretamente

1. **O helper não ignora result.error.** Em src/lib/email/send-verification-email.ts, após o envio, transforma result.error em exceção. O código não usa apenas try/catch esperando que o SDK sempre lance.
2. **A UI esconde a distinção relevante.** app/[locale]/sign-up/page.tsx:144–157 só trata EMAIL_ALREADY_EXISTS e PASSWORD_MISMATCH. VERIFICATION_EMAIL_FAILED cai em unableToCreateAccount. O usuário não vê que a conta já existe e que o problema foi o e-mail.
3. **A mensagem da API manda solicitar reenvio, mas esse recurso não existe.** Repetir cadastro retorna 409; login bloqueia PENDING; token expirado não se recupera pela página de confirmação.
4. **Conta continua persistida após falha de envio.** O HTTP é 503, não 201, mas User/Workspace/membership/Creator/token já foram gravados e não há rollback. “Cadastro falhou” no frontend não significa ausência da conta no banco.
5. **O audit de falha omite causa técnica.** Guarda provedor/expiração, sem código HTTP/nome de erro do Resend. O console imprime emailError, mas o helper preserva principalmente a mensagem e perde a estrutura do erro do SDK.
6. **Falha de audit pode parecer falha de envio.** EMAIL_VERIFICATION_SENT é gravado dentro do mesmo try do envio. Se o provedor aceitar e o audit falhar, o catch ainda tenta gravar EMAIL_VERIFICATION_SEND_FAILED. Se esse segundo audit também falhar, o catch externo devolve 500 genérico.
7. **Aceitação não é entrega.** SENT registra retorno sem erro e providerMessageId; não há webhook ou reconciliação encontrada para delivered/bounce/suppression. A ausência de log de falha não comprova entrega.
8. **Limites de observabilidade:** não foram lidos logs de requests do Worker de produção. O console do cadastro inclui dados pessoais do body, com senhas explicitamente mascaradas; não deve ser copiado integralmente para diagnóstico.

## 7. Reenvio e inventário da busca

Não foi encontrado endpoint, Server Action, botão funcional ou worker de reenvio de confirmação. A dependência chamada resend é o nome do provedor, não uma funcionalidade de “reenviar”. Forgot-password envia outro tipo de token/e-mail e não substitui esse fluxo.

Foram procurados verify email, email verification, activation, activate, verificationToken, activationToken, sendEmail, resend, SMTP, Resend, SendGrid, Postmark, SES/nodemailer e variantes, além de webhooks de entrega. Os arquivos pertinentes são:

| Arquivo | Papel |
|---|---|
| app/[locale]/sign-up/page.tsx | Formulário e tratamento incompleto da resposta de cadastro |
| app/api/auth/sign-up/route.ts | Criação das entidades, token, chamada de envio, audit e resposta |
| src/lib/auth/email-verification.ts | Token aleatório, SHA-256 e expiração |
| src/lib/email/resend.ts | Instância do provedor e chave |
| src/lib/email/send-verification-email.ts | Remetente, URL, conteúdo e envio real |
| app/[locale]/verify-email/page.tsx | Consumo do link e feedback |
| app/api/auth/verify-email/route.ts | Validação/consumo do token e ativação |
| app/api/auth/login/route.ts | Bloqueio de conta PENDING |
| src/prisma/contract.prisma, contract.json, contract.d.ts | Modelos, mapeamento e tipos gerados |
| src/prisma/db.ts, worker/index.ts | Configuração de banco/env por runtime |
| package.json | Dependência Resend e scripts Vinext |
| wrangler.jsonc, vite.config.ts | Configuração de execução/deploy |
| .env, .env.example | Presença/formato local e lacuna de documentação; valores não reproduzidos |
| app/api/auth/forgot-password/route.ts, src/lib/email/send-password-reset-email.ts | Fluxo distinto que compartilha o provedor |

## 8. Menor correção definitiva recomendada

### Primeiro: fechar a lacuna de diagnóstico, sem novo envio

1. No painel do Resend, localizar os eventos existentes pelos providerMessageId guardados no audit, sem publicar esses IDs ou dados pessoais. Verificar aceitação/entrega/bounce/suppression e motivo. A auditoria já comprovou a existência desses IDs, mas não tem permissão de leitura do histórico pelo token configurado.
2. Conferir no Worker implantado a presença de RESEND_API_KEY e a configuração explícita de EMAIL_FROM e APP_URL. Confirmar o domínio na mesma conta/projeto Resend e o escopo de envio da chave. Não inferir isso do .env local.
3. Corrigir a origem pública de APP_URL se a produção também estiver usando loopback. Se apenas o desenvolvimento usa loopback, não atribuir a ele a falha de produção. Caso o painel identifique rejeição de remetente/DNS/quota, corrigir a condição específica, sem trocar toda a integração.

### Pequena correção funcional necessária, independentemente da entrega inicial

1. Adicionar reenvio controlado para usuários PENDING, reutilizando os helpers existentes. Normalizar e-mail, limitar frequência, evitar enumeração de contas e não criar outra conta/workspace. Gerar token novo e tratar tokens anteriores explicitamente. Não ativar usuários sem confirmação.
2. Expor o reenvio na mensagem pós-cadastro, no bloqueio EMAIL_NOT_VERIFIED e na página de token expirado. Tratar VERIFICATION_EMAIL_FAILED especificamente, explicando que a conta foi criada.
3. Validar configuração de e-mail/origem antes de gravar um cadastro novo e evitar erro de importação global pouco diagnosticável quando a chave faltar. Documentar os nomes das variáveis no exemplo e no procedimento de deploy, sem valores reais.
4. Separar falha de envio de falha de gravação do audit; guardar diagnóstico sanitizado do provedor, sem corpo HTML, token ou dados sensíveis. Usar providerMessageId para distinguir aceitação de entrega.

Transação para as entidades iniciais e consumo atômico do token são melhorias de consistência identificadas, mas não exigem redesenhar o sistema de e-mail ou migrar de provedor. Nenhuma migration parece necessária para a correção mínima de reenvio: os modelos de token e audit já existem.

**Conclusão:** a hipótese “não existe envio implementado” foi descartada. Há aceitação histórica pelo Resend, tokens expirados/ausentes em contas pendentes e ausência comprovada de recuperação. A causa específica da não entrega em produção permanece dependente do histórico do provedor e da configuração efetiva do deployment; não seria correto inventar uma causa definitiva com os dados disponíveis.
