# Ambiente isolado para homologação

Nenhum recurso foi criado. A configuração local contém apenas DATABASE_URL e credenciais R2 do ambiente principal; não há conexão de teste comprovada, credencial de gerenciamento Neon ou CLI autenticada disponível. A integração Neon foi localizada, mas sua instalação/conexão ainda não foi confirmada. Isso impede listar as branches e verificar os endpoints de cada uma.

## Alternativa preparada, pendente de acesso

1. Instalar/conectar a integração Neon à conta que administra este projeto. Consultar projeto, branch principal, branches de desenvolvimento, endpoints e plano/cotas, sem fazer mutações.
2. Se já existir uma branch de teste, confirmar pelo gerenciamento Neon que seu branch ID e endpoint são diferentes dos de produção. O nome da branch ou o nome do banco, isoladamente, não comprova isolamento. Não usar branches com dados reais desnecessários.
3. Se não existir, verificar custos/cotas antes de criar qualquer recurso. Preparar uma branch **schema-only**, com nome `hotwifesonyc-publication-qa`, credenciais próprias e suspensão automática do compute. Não usar uma cópia com dados de produção. Se a opção não estiver disponível, não fazer uma cópia com dados como alternativa automática.
4. A Neon descreve schema-only como estrutura sem dados, adequada para receber fixtures sintéticas: https://neon.com/blog/instant-branches-schema-only-or-with-data-the-choice-is-yours . A disponibilidade e as condições da conta precisam ser verificadas ao conectar.
5. Usar configuração separada, sem substituir `.env`: `TEST_DATABASE_URL`, IDs de projeto/branch/endpoint verificados e APP_URL de loopback. Rejeitar a execução se o endpoint resolver para a branch principal. Não executar migrations, limpeza, seed ou testes na DATABASE_URL principal.
6. Verificar o contrato Prisma e as FKs no ambiente isolado antes de inserir as fixtures. Preparar apenas usuários fictícios, perfis, verificações e documentos de teste claramente identificados; nenhuma identidade de pessoa real.
7. Para upload, usar inicialmente armazenamento local simulado. A validação real de transporte requer bucket R2 de teste separado e credencial restrita a esse bucket; nunca reutilizar as credenciais/bucket de produção. Não provisionar recursos com custo sem informar previamente.
8. Executar navegador → upload sintético → conclusão → salvar → confirmação explícita da revisão de teste → aprovação pela API → publicação → releitura por outra conexão → galeria. Em outro produto temporário, testar exclusão, arquivamento com retenção, recusa sem permissão e rollback. Nunca remover registros reais.

## O que pode ser validado agora

Os testes em loopback cobrem componentes, APIs e serviços reais, com banco em memória e armazenamento simulado. São úteis para integração do fluxo, mas não comprovam FKs, persistência Neon, CORS R2, limites da Hostinger ou o SHA implantado. A homologação com persistência real continua pendente até haver ambiente isolado comprovado.
