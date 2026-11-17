## Estado atual de produção

Publicado em https://hotwifesonyc.com. Consulte [implantação, persistência e rollback](docs/PRODUCTION_DEPLOYMENT.md). As referências abaixo à entrega somente local descrevem a etapa inicial, anterior ao deploy autorizado. A implementação atual também protege escritas com bloqueio entre processos no mesmo host; passaram seis testes unitários e seis de integração.

# HotwifeSonyC — nova aplicação local

Aplicação em `C:\Demo\HotwifeSonyC\hotwifesonyc-new`, independente do código e banco antigos. Next.js 16.3.4, React 19, TypeScript e CSS próprio. Dependências instaladas nesta pasta e lockfile próprio. Sem banco de dados: conteúdo inicial em JSON e alterações do painel em armazenamento local privado.

## Visualizar

A prévia desta entrega usa http://127.0.0.1:3100.

- Home: `/`
- Video Catalog: `/catalog`
- Administração: `/admin` (redireciona para `/admin/login` sem sessão)

Para iniciar depois:

```powershell
cd C:\Demo\HotwifeSonyC\hotwifesonyc-new
npm.cmd run dev
```

Use apenas um servidor por vez na porta 3100. Para executar o build de produção local:

```powershell
npm.cmd run build
npm.cmd run start
```

As dependências já foram instaladas. Em outra máquina, execute `npm.cmd ci` dentro desta pasta. Node.js 20.9 ou superior. Não copie o `.env` original: nenhum segredo antigo é necessário.

## Acesso ao painel

A conta administrativa local já foi configurada. Abra `.local/initial-password.txt` no VS Code e use essa senha em `/admin/login`. Esse arquivo é privado, ignorado pelo Git e não é servido pelo site. Não compartilhe nem publique seu conteúdo. A senha de teste sintética usada na conferência visual não é a senha deste painel.

Para definir uma senha própria pelo terminal (16 a 256 caracteres):

```powershell
npm.cmd run admin:setup -- --reset
```

O comando pede a senha, invalida sessões anteriores e não altera o site antigo. A entrada é visível no terminal local. O arquivo de senha inicial deixa de representar a senha ativa após um reset. Em instalação nova, use `npm.cmd run admin:setup` sem `--reset`; `--generate` gera uma senha aleatória e grava o arquivo inicial privado.

Autenticação: hash scrypt com salt, sessão assinada de oito horas, cookie HttpOnly/SameSite Strict, Secure em HTTPS, proteção de origem nas alterações e bloqueio temporário após oito tentativas inválidas. APIs privadas usam no-store e noindex. O servidor de prévia escuta apenas em loopback.

## Manutenção pelo painel

- **Introduction:** nome de apresentação, frase inicial, biografia, fotografia principal e retrato. A biografia vazia mantém o aviso de conteúdo pendente. Não complete o texto sem a versão aprovada.
- **Platforms:** nomes, textos, URLs oficiais e ativação dos links. OnlyFans Regular e VIP estão configurados; Fansly aguarda URL. Links vazios não criam ações fictícias.
- **Creator Picks:** adicionar destaques, título/descrição opcionais, selecionar foto existente, texto alternativo, URL, ordem e ativação. Nenhum título ou descrição de destaque foi inventado.
- **Video Catalog:** adicionar/editar número, título, participantes, duração, página original, URL, status e notas; confirmar conferência com a fonte; remover mediante confirmação; importar CSV.
- Clique **Save changes** para efetivar alterações. O painel preserva os campos em caso de erro. Um conflito de revisão retorna mensagem para recarregar em vez de sobrescrever outra edição.

Fotografias novas autorizadas podem ser copiadas para `public/images` pelo responsável técnico e então selecionadas no painel. Não há upload de vídeo ou outro gerenciador de mídia complexo.

## Catálogo e conferência

As seis imagens originais continuam em `reference/catalog/`, fora de `public`. O site não as disponibiliza por URL. `reference/catalog/transcription.tsv` guarda a transcrição; `content/catalog.json` contém os 134 registros estruturados. `docs/catalog-import-report.json` guarda os hashes dos originais e a lista de pendências.

- Total importado: **134**, números **1 a 134**, sem duplicados ou ausências.
- Conferência visual feita nas seis fontes. A importação ainda tem campos não resolvidos: não está inteiramente aprovada.
- **114 ativos**, **19 em revisão**, **1 inativo** (#68, excluído por instrução expressa no documento).
- Notas/revisão: **7, 8, 11, 13, 20, 21, 22, 29, 37, 38, 39, 40, 44, 52, 66, 68, 111, 116, 120, 125**.
- #20 termina em “the” na fonte. #125 está cortado na borda inferior. Não foram completados.
- #39, #40, #52 e #68 não têm duração informada: preservado `—`.
- #13 e #29 têm durações multipartes, mantidas sem somar ou reinterpretar.
- Outras notas envolvem emojis pequenos, grafias e handles ambíguos. Os dados legíveis e as grafias originais foram preservados.
- Não foram inventados links por vídeo, capas ou descrições. O catálogo não oferece reprodução ou download.

O público vê apenas registros ativos, com busca por título/participante, filtro exato por participante, ordem numérica crescente/decrescente e paginação de 18 itens. Nomes aparentemente equivalentes não foram unificados automaticamente.

Para aprovar um item, conferir a fonte/Ron, corrigir o necessário, limpar a nota resolvida, confirmar a conferência e mudar o status para Active. O backend rejeita ativação enquanto houver nota pendente ou falta de conferência.

### Importação CSV

Colunas obrigatórias:

```csv
number,title,participantsRaw,duration
```

`platformUrl` é opcional. Use UTF-8; campos com vírgulas, quebras ou aspas devem seguir CSV com aspas duplas escapadas. O número deve ser novo e único. Use `—` para duração ou participantes não informados. Participantes são separados por `, ` ou ` + `, preservando também o campo original completo.

A importação oferece confirmação, adiciona os registros ao rascunho e deixa todos em revisão, com página 0 (novo registro). Nada é ativado automaticamente. Revise e salve no painel. Duplicados são rejeitados, sem substituir entradas existentes. Os seis documentos oficiais não são expostos nem substituídos nesse fluxo.

## Persistência e recuperação

O painel não altera `content/site.json`, `content/catalog.json` nem a transcrição. A primeira edição cria `.local/content.json`, com o conjunto ativo completo. Cada salvamento cria backup anterior em `.local/backups` e substitui o conteúdo por gravação atômica. O número da revisão impede gravações concorrentes obsoletas em um único processo.

Para restaurar um backup, pare somente o servidor novo, preserve uma cópia do conteúdo atual e copie o backup desejado para `.local/content.json`; reinicie a nova aplicação. Para voltar ao conteúdo inicial, mova esse arquivo para uma cópia de recuperação fora do caminho ativo. Nunca é necessário tocar no banco antigo.

`SONY_DATA_DIR` pode apontar para outro diretório privado próprio desta aplicação. A solução é destinada a um processo Node com disco persistente. Uma futura publicação em ambiente efêmero ou com múltiplas instâncias exigirá adaptar a persistência e o bloqueio de tentativas; isso não foi configurado nem publicado nesta entrega.

## Marca, imagens e original preservado

Logotipo: cópia byte a byte de `../public/logo-hotwifesonyc.png` para `public/images/logo-hotwifesonyc.png`, exibida em cabeçalho, rodapé e aviso adulto, sem filtro, alteração de cor, recorte ou distorção. Dimensões originais: 2137 × 736. SHA-256: `9c7acbedf79186754d37f8aa9ab5bababb5323ded83d5facd89be64d6e2aafda`.

Fotos copiadas dos arquivos existentes: `hero1.png`, `hero3.jpeg`, `hero2.jpeg`. Não foram geradas novas imagens de Sonia. A seleção editorial definitiva segue sujeita à aprovação de Sonia/Ron.

O original usa Next.js/React, next-intl, Tailwind, PostgreSQL/Prisma 8 RC, Cloudflare R2 via S3, Resend e integrações de publicação/vendas. Há alternativa Vinext/Cloudflare em `wrangler.jsonc`. A documentação local de 09/11/2026 registra Hostinger/hPanel como hospedagem que respondia publicamente; o SHA efetivamente implantado não está confirmado. Nenhum acesso a produção foi necessário nesta tarefa.

O painel antigo depende de contas, workspaces, produtos e fluxos de mídia/revisão. Ele não foi reutilizado. Nenhum código, configuração, imagem, vídeo, banco, integração ou domínio do projeto antigo foi modificado. Os arquivos não rastreados preexistentes em docs foram preservados. Não houve deploy ou push.

## Conteúdo adulto, SEO e acessibilidade

Aviso inicial de maioridade com confirmação de 18+ ou idade de maioridade local, lembrada em cookie de sessão sem coleta de nascimento ou documento. Isso é autodeclaração de acesso, não verificação documental. Há saída do site, skip link, foco visível, textos alternativos, campos com labels e suporte a movimento reduzido.

Metadados por página, URLs públicas simples, sitemap somente com Home e Catalog, 404 própria e administração noindex. A prévia inteira usa noindex e robots bloqueado. `SITE_URL` deve ser configurada somente quando domínio e publicação forem autorizados; sitemap e robots são gerados no build. Nenhuma configuração do domínio atual foi alterada.

## Validação

```powershell
npm.cmd run validate:content
npm.cmd test
npm.cmd run test:integration
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
```

Seis testes de conteúdo/autenticação/importação e cinco testes HTTP passaram. Integração executada em 127.0.0.1:3102 com credencial e arquivos sintéticos em `test-results`, sem escrever na prévia principal. Testes cobrem páginas/404, proteção de documentos, links, catálogo, sessão, CSRF, login, edição, releitura, backups, conflitos, conteúdo inválido e logout.

Conferência visual no Chrome: desktop, tablet 768px, smartphone 390px, menu móvel, catálogo e busca “Archer” com oito resultados. Login e interface do painel conferidos em instância sintética isolada na porta 3103, encerrada após o teste. Não houve acesso às plataformas externas com conta ou transação; os endereços e atributos de abertura segura foram conferidos localmente.

## Pendências do Ron

1. Biografia completa de 10/11/2026.
2. URL oficial do Fansly.
3. Confirmação dos 20 registros sinalizados (incluindo a exclusão do #68).
4. Seleção editorial final de fotografias e destaques.

As seis imagens do catálogo foram recebidas e importadas; a pendência anterior dos PDFs foi substituída pela conferência dos campos sinalizados nas imagens fornecidas.
