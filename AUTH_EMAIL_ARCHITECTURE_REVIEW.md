# Auth & Email Architecture Review — Creator Platform

Data: 16 de setembro de 2026. Escopo: autenticação e e-mails transacionais. Implementação local, sem deploy, sem migrations, sem alteração de registros reais e sem envio de e-mail.

## 1. Resultado executivo

O envio de confirmação **já existia e usava Resend**. O defeito comprovado de recuperação era: conta criada como PENDING, token expirado ou envio malsucedido, nenhuma ação de reenvio e conflito ao repetir o cadastro. O frontend também escondia a condição específica de “conta criada, envio falhou”.

Agora cadastro, login, sessão, confirmação, recuperação, transporte, templates, limites e auditoria têm responsabilidades separadas. Rotas antigas permanecem compatíveis. Foram adicionados register (alias), resend-verification, logout e change-password. As telas e templates usam Next-Intl nos cinco idiomas: en-US, pt-BR, es-ES, fr-FR e cs-CZ.

**Não foi comprovada a causa de uma mensagem aceita pelo Resend não aparecer na caixa de entrada.** Aceitação pela API não comprova entrega. Corrigir recuperação/configuração e endurecer o transporte não permite declarar resolvida a entregabilidade sem os eventos do provedor.

## 2. Arquitetura anterior

| Área | Implementação anterior | Problema identificado |
|---|---|---|
| Cadastro | POST /api/auth/sign-up criava User, Workspace, WorkspaceMember, Creator, audit, token e enviava e-mail | Operações sem transação; falha intermediária podia deixar cadastro incompleto; UI não diferenciava falha de e-mail |
| Login | Rota extensa com validação, senha, membership, workspace, onboarding e sessão | Responsabilidades misturadas; não havia limite compartilhado de tentativas |
| Verificação | Token aleatório, hash SHA-256, validade de 24 horas, usedAt | Consumo e ativação não atômicos; concorrência e possível reativação indevida de usuário suspenso |
| Recuperação | Forgot e reset existentes; token de 60 minutos | Resposta diferente quando envio falhava revelava existência da conta; consumo não atômico; sessões não revogadas no reset |
| Sessões | Cookie creator_session, token hash, 30 dias | Criação duplicada no login; sem logout central; revokedAt não conferido |
| E-mail | Helpers separados, cliente Resend inicializado ao importar módulo | Chave ausente podia quebrar importação; fallback de remetente e localhost; HTML duplicado, interpolação não escapada |
| Idiomas | Traduções de e-mail e recuperação embutidas nos arquivos | Confirmação sem cs-CZ; mensagens técnicas do login em inglês diretamente na UI |
| Recuperação de ativação | Ausente | Contas PENDING sem token válido ficavam sem caminho funcional |

O login continha uma regra de compatibilidade para contas antigas: Creator ativo e plataforma conectada podem regularizar onboarding incompleto. Essa regra foi preservada no serviço de login, assim como os bloqueios de Workspace e as respostas de destino APP/ONBOARDING.

## 3. Investigação da confirmação que não chega

### Respostas A–G

| Questão | Conclusão |
|---|---|
| A. O sistema tenta enviar? | Sim. A chamada é aguardada após a criação do token. Antes estava em sign-up/route.ts; agora está em auth/registration.ts. |
| B. Qual arquivo envia? | src/lib/email/send-verification-email.ts monta o link/template e chama src/lib/email/client.ts. |
| C. Qual provedor? | Resend por API HTTPS. Não SMTP, Nodemailer, SendGrid, Postmark ou SES direto. |
| D. Configurado? | O diagnóstico local desta revisão retornou Configuration: OK. Isso valida presença e formato local; não comprova configuração do Worker implantado ou entrega. |
| E. Erros escondidos? | A UI antiga mostrava erro genérico. Uma falha ao gravar o audit de sucesso podia parecer falha de envio. O SDK instalado imprimia corpo bruto de erro em desenvolvimento; um teste detectou isso e o transporte foi corrigido. |
| F. Pode ficar PENDING sem e-mail? | Sim, por decisão necessária: não ativar sem confirmação. Agora a resposta de cadastro sinaliza accountCreated e VERIFICATION_EMAIL_FAILED, com reenvio visível. |
| G. Há reenvio? | Agora sim: rota, página e ações no login/cadastro/erro de confirmação. |

### Evidência atual, sem envio

Execução de `npm.cmd run email:test`, sem --to:

```text
Configuration: OK
Authentication: INCONCLUSIVE (sending-only key)
Provider accepted message: NO (not sent)
Message ID: n/a
```

A ferramenta fez somente GET /domains no Resend. A restrição de uma chave de envio impede esse diagnóstico administrativo; **não significa que o envio esteja com autenticação inválida**. Nenhum destinatário foi obtido do banco e nenhum e-mail foi enviado.

### Evidência anterior, não repetida nesta implementação

EMAIL_VERIFICATION_AUDIT.md registra consultas somente de leitura realizadas anteriormente no banco apontado pela configuração local: 5 eventos com ID do provedor, 0 falhas de envio registradas na janela de 30 dias e 3 usuários PENDING sem token válido. Também registra APP_URL local/loopback e presença de SPF, DKIM e DMARC. Esses resultados históricos não foram reconsultados nem apresentados como estado atual de produção.

APP_URL de loopback produz links inadequados para destinatários externos, **mas não explica por si só ausência do e-mail**. A produção agora rejeita origem local ou HTTP ao montar e-mails. O diagnóstico local permite localhost para desenvolvimento.

### O que falta para fechar a causa da entrega

Consultar no painel Resend os IDs já registrados e os eventos delivered, bounced, suppressed, delayed ou rejected; conferir spam/quarentena e domínio/remetente efetivos do deployment. A chave disponível não permite confirmar esses estados por leitura administrativa. Não se deve reenviar para usuários reais nem mudar status para ACTIVE como “teste”.

## 4. Provedor e configuração

| Variável | Uso | Regra |
|---|---|---|
| RESEND_API_KEY | Autenticação API | Obrigatória, resolvida por requisição no Worker; nunca logada |
| EMAIL_FROM | Remetente | Obrigatória; sem fallback oculto; mailbox validado |
| EMAIL_REPLY_TO | Reply-To | Opcional; validado quando presente |
| APP_URL | Origem dos links localizados | Obrigatória; sem credenciais, query, fragment ou subcaminho; HTTPS não local em produção |
| DATABASE_URL | Prisma/PostgreSQL | Configuração existente preservada; não exibida |
| AUTH_TRUST_PROXY | IP no Next fora do Worker | Opcional, false por padrão. Habilitar somente atrás de proxy que sobrescreva x-forwarded-for |
| NODE_ENV | Cookies e validação de URL | Produção exige Secure e origem pública HTTPS |

worker/index.ts passa bindings de e-mail e IP Cloudflare por AsyncLocalStorage, sem modificar process.env por requisição e sem compartilhar credenciais entre requisições. Desenvolvimento Next usa as variáveis locais. O cliente é criado sob demanda, evitando falha no import/build quando a chave não está disponível nessa etapa.

O domínio/remetente deve estar autorizado no Resend. SPF/DKIM são configurados conforme o painel; DMARC complementa política e alinhamento. Não foi alterado DNS. Referências oficiais: [domínios](https://resend.com/docs/dashboard/domains/introduction), [DMARC](https://resend.com/docs/dashboard/domains/dmarc), [chaves de envio](https://resend.com/docs/knowledge-base/setting-up-resend-for-multi-tenants), [idempotência](https://resend.com/docs/dashboard/emails/idempotency-keys).

## 5. Arquitetura final e arquivos

As rotas apenas encaminham para serviços. Os serviços orquestram transações e regras; helpers de token/sessão/audit/limite são compartilhados. Helpers de e-mail montam links, templates produzem HTML/texto traduzidos, transporte chama o provedor.

### Criados

| Arquivo | Responsabilidade |
|---|---|
| app/api/auth/register/route.ts | Alias compatível de cadastro |
| app/api/auth/resend-verification/route.ts | Reenvio com resposta genérica |
| app/api/auth/logout/route.ts | Revogação da sessão atual e limpeza do cookie |
| app/api/auth/change-password/route.ts | Troca autenticada com senha atual |
| src/lib/auth/registration.ts | Cadastro transacional e resultado coerente do envio |
| src/lib/auth/login.ts | Login e regras preexistentes de workspace/onboarding |
| src/lib/auth/confirmation.ts | Consumo atômico e ativação controlada |
| src/lib/auth/recovery.ts | Reenvio/forgot com anti-enumeração |
| src/lib/auth/password-management.ts | Reset e troca de senha |
| src/lib/auth/tokens.ts | Entropia, hashing e validade |
| src/lib/auth/request.ts | Schemas, origem, JSON e erros públicos seguros |
| src/lib/auth/rate-limit.ts | Limites persistentes por identidade/IP |
| src/lib/auth/audit.ts | Eventos seguros e locks transacionais |
| src/lib/email/config.ts | Validação e configuração por contexto |
| src/lib/email/client.ts | Resend sob demanda, transporte sanitizado, timeout e retry |
| src/lib/email/templates/auth-email.ts | Template comum com escape HTML e texto alternativo |
| src/components/auth/ResendVerification.tsx | Ação reutilizável e traduzida |
| app/[locale]/resend-verification/page.tsx | Página pública de solicitação de reenvio |
| scripts/email-test.ts | Diagnóstico local; envio somente com --to explícito |
| scripts/email-test.mjs | Carregador em memória, sem arquivo de credenciais |
| scripts/test-auth.mjs | Testes isolados, sem banco/provedor reais |
| AUTH_EMAIL_ARCHITECTURE_REVIEW.md | Este relatório |

### Modificados nesta revisão

- app/api/auth/sign-up/route.ts, login/route.ts, verify-email/route.ts, forgot-password/route.ts e reset-password/route.ts: delegação aos serviços.
- src/lib/auth/email-verification.ts e password-reset.ts: criação compartilhada, compatível com transações; hashes e prazos preservados.
- src/lib/auth/session.ts: helpers centralizados, revokedAt, logout e proteção contra corrida com reset.
- src/lib/email/resend.ts: export compatível, inicialização sob demanda.
- src/lib/email/send-verification-email.ts e send-password-reset-email.ts: links validados, templates comuns e idempotência.
- app/[locale]/sign-up/page.tsx, login/page.tsx, verify-email/page.tsx, forgot-password/page.tsx e reset-password/page.tsx: recuperação, mensagens localizadas e prevenção de requisição duplicada na confirmação.
- i18n/messages/en-US.json, pt-BR.json, es-ES.json, fr-FR.json e cs-CZ.json: mensagens auth e authEmail; demais namespaces preservados.
- worker/index.ts: contextos de e-mail/IP e log de fechamento do banco sanitizado.
- package.json: comandos email:test e test:auth; nenhuma dependência nova.
- .env.example: nomes/placeholders das variáveis. Este arquivo é ignorado pela regra preexistente `.env*`; as mesmas instruções estão neste relatório para compartilhamento. Nenhum valor real foi copiado.

Não foram modificados nesta revisão: schema/contract Prisma, src/prisma/db.ts, password-hash.ts, protocolo ManyVids, executores ou regras de outras plataformas. O checkout já continha alterações de trabalhos anteriores; elas não foram revertidas nem atribuídas a esta revisão.

## 6. Fluxos finais

### Register / sign-up

1. Origem/JSON, schema, locale, confirmação de senha e limite.
2. Hash Argon2id pelo helper compatível já utilizado no login.
3. Transação com lock da identidade normalizada: impedir duplicata; criar User PENDING, Workspace, membership OWNER, Creator quando aplicável, token de 24h e ACCOUNT_CREATED.
4. Commit, AUTH_REGISTER_SUCCESS e tentativa aguardada de envio.
5. Aceito: 201/verificationRequired e AUTH_VERIFICATION_EMAIL_ACCEPTED com ID do provedor. Isso não afirma entrega.
6. Falhou: 503/accountCreated=true/VERIFICATION_EMAIL_FAILED e audit seguro; UI oferece reenvio e impede novo submit de cadastro concluído.

### Verify

Validar token e quota → localizar hash → lock do usuário → reler validade/usedAt/status → consumo condicional → ativar somente PENDING/ACTIVE → emailVerifiedAt → consumir demais tokens de verificação → audit → commit. Tudo em uma transação. Suspenso/indisponível não é reativado. Inválido, usado e expirado retornam INVALID_TOKEN sem detalhes adicionais.

A página compartilha a promessa de confirmação entre reexecuções do effect (inclusive StrictMode), evitando falso negativo por dois consumos concorrentes. Verificação/reset usam referrer policy no-referrer na página.

### Resend

E-mail normalizado e limite → evento AUTH_RESEND_REQUESTED → apenas PENDING não verificado recebe token novo aleatório → envio com locale do usuário → audit accepted/failed. Resposta pública idêntica para conta ausente, inelegível e falha do provedor. UI informa tentativa condicional, sem prometer entrega.

Tokens anteriores ainda válidos não são destruídos antes do envio: uma falha do provedor não inutiliza o link que o usuário já recebeu. Todos são consumidos quando uma confirmação ocorre. Token usado nunca é reutilizado.

### Login

Validação/limite → verificar hash → status User → membership/Workspace e regras de onboarding preservadas → criação de sessão sob lock, relendo status e hash da senha → audit/tentativa → cookie e destino. Conta inexistente também executa derivação de senha para reduzir a diferença de tempo mais evidente. EMAIL_NOT_VERIFIED aparece somente após senha correta e agora oferece reenvio.

### Forgot password

E-mail/limite → evento de solicitação → usuário elegível ACTIVE/PENDING recebe novo token de 60min → e-mail localizado e audit. Resposta genérica inclusive em erro de envio. Contas suspensas não recebem caminho de recuperação que altere seu bloqueio.

### Reset password

Validar token/senha/quota → hash de senha → transação e lock do usuário → reler e consumir token válido → atualizar senha → consumir tokens irmãos → revogar sessões ACTIVE daquele usuário → audit → commit e limpar cookie. Não altera o status de confirmação da conta.

### Change password

Requer sessão válida e senha atual. Sob lock, relê sessão/status/hash antes de atualizar. Consome tokens de reset pendentes e revoga outras sessões, mantendo a atual. Contrato JSON: currentPassword, password, confirmPassword. Não foi adicionada uma nova tela de configurações fora do escopo das páginas solicitadas.

### Logout

POST JSON de mesma origem → obter cookie → localizar hash → revogar somente essa sessão e gravar audit em transação → expirar cookie com os mesmos atributos. Sem sessão, retorna sucesso idempotente. Contrato: POST /api/auth/logout com corpo `{}`.

## 7. Banco e compatibilidade

| Modelo | Campos relevantes |
|---|---|
| User | id, email único, passwordHash, status, emailVerifiedAt, locale, timezone |
| EmailVerificationToken | userId, tokenHash único, expiresAt, usedAt, createdAt |
| PasswordResetToken | userId, tokenHash único, expiresAt, usedAt, createdAt |
| Session | userId, tokenHash único, status, expiresAt, revokedAt, lastSeenAt, clientType, ipAddress, userAgent |
| LoginAttempt | email, successful, ipAddress, userAgent, createdAt; preservado no login |
| AuditLog | action, userId, entityType/entityId, metadata, createdAt; eventos e contadores com índices existentes |
| Workspace / WorkspaceMember / Creator | Estrutura e regras existentes preservadas |
| TwoFactorMethod / RecoveryCode | Modelos existentes, fora do fluxo revisado; não foi adicionada autenticação de dois fatores |

Sem migration. O runtime Prisma usa db.transaction e tx.orm; locks PostgreSQL transacionais serializam decisões por usuário/identidade e buckets de limite. Os testes simulam esse contrato; não executam concorrência em PostgreSQL real.

Cookies continuam com nome creator_session, 30 dias, HttpOnly, SameSite=Lax, path=/ e Secure em produção. SHA-256 e formato do token continuam compatíveis. Nenhuma sessão existente foi revogada durante esta implementação. Revogação acontece futuramente por logout/reset/troca de senha solicitados pelo usuário.

getCurrentSession/requireSession e exports dos helpers antigos foram mantidos. Foram encontrados 43 arquivos consumidores/referências de sessão na aplicação; não houve substituição do contrato usado por onboarding, mídia, distribution, performers e plataformas.

## 8. Segurança e observabilidade

- Tokens de 32 bytes aleatórios; somente SHA-256 no banco; validade e uso único conferidos atomicamente.
- Cadastro/transições críticas e respectivos audits essenciais em transação; falha de audit operacional do provedor não transforma aceite em rejeição.
- Limites em AuditLog com identidade/IP hash, sem tokens brutos. Por identidade/IP: login 10/60 por 15min; register 3/10 por 60min; resend e forgot 3/20 por 60min; verify 10/60 por 15min; reset 5/30 por 15min; change 5/20 por 15min.
- Worker usa o IP fornecido pela Cloudflare; cabeçalhos encaminhados de cliente não são confiados por padrão no Next local.
- Mutação exige JSON; Origin e Sec-Fetch-Site cross-site são rejeitados. Clientes sem Origin continuam possíveis, mas formulários cross-site não passam pela exigência JSON.
- Resend/forgot retornam mesmo status/corpo; pequena janela mínima aleatória reduz distinções simples de tempo, mas **não é tempo constante**.
- Templates escapam nome e atributos, incluem texto alternativo, não usam Host do request para links e não aceitam URL arbitrária do usuário. Redirects da UI são caminhos locais fixos.
- Transporte usa endpoint Resend fixo, rejeita redirect, timeout de 10 segundos por tentativa, no máximo duas tentativas para falha de rede/429/5xx com a mesma chave de idempotência. Falhas definitivas não são repetidas.
- SafeResend preserva o SDK e substitui somente fetchRequest porque o SDK instalado loga corpos brutos de erro fora de produção. Não modifica console global, NODE_ENV ou dependência instalada. Corpo de erro é descartado; somente código/status controlados saem do transporte.
- Eventos AUTH_REGISTER_SUCCESS, AUTH_VERIFICATION_EMAIL_ACCEPTED/FAILED, AUTH_EMAIL_VERIFIED, AUTH_RESEND_REQUESTED, AUTH_PASSWORD_RESET_REQUESTED, AUTH_PASSWORD_RESET_EMAIL_ACCEPTED/FAILED, AUTH_PASSWORD_RESET_COMPLETED, AUTH_LOGOUT e AUTH_PASSWORD_CHANGED permitem rastreio sem senha/token/cookie/link completo.

## 9. Diagnóstico local reproduzível

PowerShell, sem envio:

```powershell
Set-Location C:\Demo\creator-platform
npm.cmd run email:test
npm.cmd run test:auth
```

Somente se o operador escolher explicitamente um destinatário de teste, o comando `npm.cmd run email:test -- --to <endereço-de-teste>` envia uma mensagem neutra. Esse modo **não foi executado**. Não existe destinatário automático de banco/env. A saída é limitada a configuração, autenticação, aceite e ID sanitizado. Chave limitada resulta em diagnóstico inconclusivo, não em falsa confirmação de autenticação para leitura.

## 10. Validação executada

- 15 testes de serviço passaram com banco em memória, cookies simulados e fetch substituído: entropia/expiração, hashes Argon2 compatíveis em ambos os sentidos, CSRF, cadastro com falha de transporte, rollback de cadastro, confirmação concorrente/conta suspensa, tokens expirados, resend/forgot anti-enumeração, limite concorrente, reset e sessões, logout, troca de senha, login de PENDING, templates nos cinco locales, retry/idempotência e ausência de dados sensíveis nos logs.
- Um teste inicialmente encontrou corpo bruto do provedor nos logs do SDK; o transporte foi corrigido e toda a suíte passou novamente.
- Diagnóstico de transporte local sem envio: configuração OK; leitura inconclusiva por chave de envio, conforme seção 3.
- Typecheck final (`npx tsc --noEmit --incremental false`): aprovado, após regenerar os tipos Next e completar a propriedade readOnly do campo compartilhado de cadastro.
- Lint dirigido: zero erros. Permanece somente o aviso preexistente de `<img>` na página de login; a imagem não foi alterada. O último ajuste do campo de cadastro também passou no lint dirigido.
- Build Vinext (`npm.cmd run build:vinext`): aprovado, incluindo o transporte Resend sanitizado. Depois dele houve apenas o complemento de readOnly do campo de cadastro, validado por typecheck/lint; não houve terceiro build por essa alteração restrita de prop.
- Chaves authEmail e mensagens novas de auth verificadas nos cinco locales, sem chaves ausentes.
- Nenhum teste fez cadastro, reset, confirmação, reenvio ou publicação em serviços reais.

## 11. Riscos restantes

1. Entregabilidade e configuração real de produção ainda exigem painel/eventos do Resend. Não foi feito envio de teste real ou deploy.
2. Testes unitários usam ORM em memória. Atomicidade de PostgreSQL, bindings/IP, redirects e desempenho no Worker devem ser confirmados em staging controlado antes de rollout.
3. Resend/forgot aguardam transporte; variação de latência pode permitir inferências apesar de corpo/status genéricos e padding. Eliminar esse canal de forma mais forte requer processamento assíncrono durável, fora desta mudança sem migrations/filas novas.
4. AuditLog como limitador evita novo schema, mas acrescenta duas linhas por tentativa e depende da disponibilidade do banco. Planejar retenção e proteção de borda contra volume; não foi apagado histórico.
5. Sem IP confiável no Next local, existe bucket compartilhado “unavailable”. Em self-hosting, configurar proxy confiável antes de habilitar AUTH_TRUST_PROXY; não confiar em cabeçalho livre do visitante.
6. Argon2id mantém o custo existente de memória/CPU. Validar limites do plano Cloudflare e concorrência em staging; não foi enfraquecido o hash para caber em ambiente desconhecido.
7. Resposta de cadastro EMAIL_ALREADY_EXISTS mantém comportamento preexistente, portanto ainda permite inferência de existência no cadastro. Não foi modificada essa regra de negócio; recuperação usa resposta genérica.
8. Não há webhook de delivery/bounce nem fila durável: accepted não é delivered; falha de gravação do audit operacional emite AUTH_AUDIT_WRITE_FAILED e pode exigir investigação no provedor.
9. APIs de logout/change-password estão disponíveis; não foi criada uma tela nova de configurações de conta. As páginas de UX explicitamente pedidas foram revisadas.

## 12. Checklist antes do deploy

- [ ] Conferir bindings reais RESEND_API_KEY, EMAIL_FROM, APP_URL e EMAIL_REPLY_TO opcional, sem copiá-los para logs/repositório.
- [ ] Confirmar APP_URL pública HTTPS e domínio/remetente autorizados no Resend; validar SPF/DKIM e política DMARC.
- [ ] Consultar os eventos associados aos IDs de envio já existentes e fechar a causa de não entrega.
- [ ] Executar teste com destinatário controlado explicitamente escolhido e conferir caixa de entrada, spam e eventos de entrega.
- [ ] Em staging, verificar cadastro CREATOR/AGENCY, login de conta antiga, resend, verificação concorrente, forgot/reset, logout e troca de senha.
- [ ] Confirmar IP confiável, same-origin atrás do domínio público, cookie Secure e desempenho Argon2 no Worker.
- [ ] Verificar limites, retenção de AuditLog e alertas de EMAIL_FAILED/AUDIT_WRITE_FAILED.
- [ ] Recuperar contas PENDING com reenvio solicitado pelo usuário; não ativar manualmente nem criar usuários duplicados.
- [ ] Revisar este diff junto às alterações anteriores já existentes no checkout. Nenhum deploy foi executado nesta tarefa.
