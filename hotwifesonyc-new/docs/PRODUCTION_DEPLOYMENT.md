# Produção — 16/11/2026 UTC

Domínio: https://hotwifesonyc.com. Release ativa: `sony-new-20261116-01`, build Next `oZq9uBxrrF7aGS6YDOSqt`, Node 22.23.5, Hostinger Passenger/LSNode.

## Instalação e persistência

Raiz privada: `/home/u604106388/apps/hotwifesonyc`.

- Aplicação: `releases/sony-new-20261116-01/nodejs` (standalone).
- Fonte: `releases/sony-new-20261116-01/source`; arquivo final de fonte: `source-final.tar.gz`.
- Dados: `shared/data`, fora das releases, diretório 700 e arquivos 600. Contém conteúdo, autenticação e backups anteriores a cada edição.
- Configuração: `shared/config/preload.cjs`, carregada explicitamente pelo startup. Define `SITE_URL=https://hotwifesonyc.com` e `SONY_DATA_DIR` absoluto para `shared/data`.
- Logs: `shared/logs`. Relatório HTTP: `shared/config/production-http-report.json`.

`hbuilds/current` do domínio aponta para a release nova. `.htaccess` mantém o mecanismo Passenger, Node 22, startup `server.js` e redirecionamento www para o domínio principal. A hospedagem pode manter workers LSNode aquecidos; a ativação exigiu encerramento gracioso do worker do domínio, com conferência do diretório do processo. Não há serviço systemd ou Nginx administrado por este projeto.

Novos deploys devem reutilizar `shared/data` e a configuração privada, nunca sobrescrever esses dados com os JSON iniciais nem gerar outra credencial automaticamente. Escritas têm bloqueio entre processos, revisão otimista, backup e substituição atômica. Um `content.lock` abandonado só deve ser removido após confirmar que nenhum processo escritor está ativo. A limitação de tentativas de login é por processo; a solução requer disco persistente em um único host.

A senha inicial permanece em `shared/data/initial-password.txt`, acessível somente ao proprietário via SSH. Não foi copiada para a documentação ou para a fonte.

## Validação

TypeScript, lint, seis testes unitários, seis de integração e build passaram localmente. Lint, testes unitários, TypeScript e build também passaram no Node 22 remoto. Duas partidas isoladas verificaram leitura, autenticação e manutenção dos dados após reinício antes da ativação.

HTTPS público: homepage, catálogo, login, sessão autenticada, cookie Secure/HttpOnly/SameSite, logout, proteção CSRF, arquivos privados, recursos JS/CSS, três fotos e otimizador de imagens verificados. Catálogo: 134 registros, 114 ativos. Logotipo fonte preservado byte a byte; o CDN redimensiona/recomprime a entrega pública. Links OnlyFans presentes. Biografia completa e URL Fansly continuam pendentes de fornecimento; 19 registros em revisão e um inativo. Não houve teste de transação nas plataformas externas nem execução de navegador em produção.

## Recuperação da versão anterior

Backup verificado por SHA-256 e integridade do arquivo:

`/home/u604106388/backups/hotwifesonyc/pre-new-20261116T030139Z`

Inclui release, fonte, configuração, `.env`, `.htaccess` e dependências antigos. Commit anterior: `f543e9acb869c77f6bcf0eb0d75318cbff225071`. A release antiga permanece em `domains/hotwifesonyc.com/hbuilds/versions/01a1c881-2927-7145-adb3-64a74b5a4539/nodejs`.

Execute no PowerShell para voltar:

```powershell
ssh -i "C:\Users\Leo\.ssh\cloud-startup_ed25519" -p 65002 u604106388@72.62.109.99 "bash /home/u604106388/apps/hotwifesonyc/shared/config/rollback-old.sh"
```

O script confere os pré-requisitos e a release atual, restaura atomicamente o ponteiro antigo e o `.htaccess` do backup, solicita reinício e encerra graciosamente apenas os workers deste domínio que ainda estejam no diretório novo. A próxima requisição inicia a versão antiga. Confirme homepage e catálogo por HTTPS sem cache. Se o ponteiro pertencer a uma terceira release, o script interrompe para revisão manual. Não executado nesta entrega, pois desfaria a publicação; sintaxe e pré-requisitos conferidos.

Não restaure banco ou R2: nenhum deles foi migrado ou alterado. Dados novos permanecem em `shared/data` mesmo após rollback. O backup e as duas releases foram preservados.

## Próximas publicações

O hPanel permanece associado ao repositório/branch `main` e à configuração antiga de deploy automático. Não houve push. Antes de usar Reimplantar ou enviar commits para esse fluxo, alinhe a configuração do hPanel à nova aplicação; o fluxo antigo pode substituir o ponteiro e o roteamento. O commit mostrado no hPanel não identifica esta publicação manual. Use a release, o build ID e a resposta HTTP para identificar a versão ativa.
