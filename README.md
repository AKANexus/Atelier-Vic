# Ateliê — portfólio e encomendas

Site em português brasileiro, com estimativas em BRL, formulários condicionais e gestão de leads e trabalhos. Hospedagem: Cloudflare Pages Free, Functions/Workers Free, D1 Free e KV Free. Acesso administrativo: Cloudflare Access Free. Não habilite planos pagos.

## Desenvolvimento local

Requisitos: Node.js 22 ou 24 LTS e npm. Use a versão do lockfile: `npm ci`.

```powershell
npm ci
Copy-Item .dev.vars.example .dev.vars
npm run db:local
npm run build
npm run preview
```

Abra `http://127.0.0.1:8788/admin` para configurar o estúdio; abra `/` para o site público. O modo local só aceita os hosts `localhost`/`127.0.0.1` e a porta 8788. Nunca coloque `LOCAL_DEV_AUTH` no Cloudflare. As chaves de teste do Turnstile em `.dev.vars.example` servem apenas para testes. Para atualizar o código, execute `npm run build` novamente.

## Criar o ambiente Cloudflare

1. Na conta escolhida, confira **Compute → Workers plans → Free / Current plan**. As cotas são da conta, compartilhadas entre ambientes e projetos. Não faça upgrade para resolver cotas.
2. Autorize o app **Cloudflare Workers and Pages** no GitHub apenas para `AKANexus/victor-quote-manager`.
3. Crie em **Storage & databases → D1** os bancos `victor-quote-production` e `victor-quote-preview`.
4. Crie em **Storage & databases → KV** os namespaces `victor-art-production` e `victor-art-preview`.
5. Atualize os IDs em `wrangler.jsonc`, mantendo produção e preview separados. IDs de recursos não são credenciais.
6. Autentique o Wrangler com `npx wrangler login`. Complete pessoalmente a autenticação e a autorização no navegador.
7. Aplique as migrações antes de abrir o site:

```powershell
npm run db:production
npx wrangler d1 migrations apply DB --remote --env preview
```

8. Em **Workers & Pages → Create application → Continue to Pages → Import an existing Git repository**, selecione o repositório. Configuração: nome `victor-quote-manager`, branch `master`, preset **Vite**, comando `npm run build`, saída `dist`, diretório raiz do repositório. Use `NODE_VERSION=24`.
9. Confira que produção usa o banco e KV de produção; prévias usam os recursos de preview. Se o painel importar os bindings do Wrangler, não cadastre bindings duplicados.
10. Em **Settings → Runtime → Fail open / closed**, escolha **Fail closed**.
11. Configure Access e Turnstile abaixo. A API administrativa nega acesso enquanto a configuração estiver incompleta. A agenda começa fechada e o portfólio vazio.

### Acesso administrativo antes do domínio

Crie a organização Zero Trust no plano **Free**, para até 50 usuários. O Cloudflare pode pedir um método de pagamento mesmo no plano gratuito; o titular preenche diretamente e revisa o plano antes de aceitar. Não ative uma assinatura paga.

Use a integração de Access do projeto Pages para obter suporte ao domínio `pages.dev`: habilite a política de preview, abra **Manage**, vá à lista **Applications** e clique no nome da aplicação para abrir o editor (`/edit`); então configure uma aplicação para o hostname de produção sem o wildcard. Limite os caminhos a `/admin`, `/admin/*` e `/api/admin/*` na mesma aplicação (mesmo AUD). Deixe o restante do site público. Reative a proteção de preview para os hostnames `*.victor-quote-manager.pages.dev`, com proteção integral das prévias. Veja [as instruções oficiais para Pages](https://developers.cloudflare.com/pages/platform/known-issues/#enable-access-on-your-pagesdev-domain).

Política **Allow**: apenas os dois e-mails fornecidos pelo responsável. Autenticação: **One-time PIN**. Sessão: 8 horas. Não use políticas de bypass. Para produção e preview, registre os valores públicos em `vars` no `wrangler.jsonc`, com os valores corretos de cada aplicação. Guarde os segredos em **Settings → Variables and Secrets**. O arquivo Wrangler é a fonte de configuração de bindings e variáveis de texto; não dependa de edições dessas variáveis no painel, pois um deploy pode sobrescrevê-las:

| Nome                 | Valor                                                                                        |
| -------------------- | -------------------------------------------------------------------------------------------- |
| `ACCESS_TEAM_DOMAIN` | `https://NOME-DO-TIME.cloudflareaccess.com`                                                  |
| `ACCESS_AUD`         | AUD da aplicação do ambiente                                                                 |
| `ADMIN_EMAILS`       | E-mails permitidos, separados por vírgula; use um segredo para manter a configuração privada |
| `EMAIL_ENABLED`      | `false` até configurar o domínio e testar as notificações                                    |

Teste produção, URLs de deployment e preview: nenhuma rota administrativa deve expor dados sem JWT válido, AUD correto e e-mail permitido. A verificação no servidor protege mesmo hostnames esquecidos na configuração do Access. Confirme que a página pública abre em janela anônima. Use o hostname estável de produção para administrar produção: aliases de deployment são protegidos pela aplicação de preview, cujo AUD diferente é rejeitado pela API de produção. Branches de preview usam o AUD e os recursos de preview.

### Turnstile

Em **Application security → Turnstile**, crie um widget gratuito **Managed**. Cadastre o hostname de produção e somente os hostnames de teste que realmente serão usados. Configure:

| Nome                   | Valor                                                 |
| ---------------------- | ----------------------------------------------------- |
| `TURNSTILE_SITE_KEY`   | Chave pública do widget em `vars` no `wrangler.jsonc` |
| `TURNSTILE_SECRET_KEY` | Segredo do widget, armazenado como segredo            |

Não use as chaves de teste em produção. O servidor valida o hostname e a ação `quote`. Faça redeploy depois de alterar bindings/segredos. O limite de submissões válidas é 20 por IP por hora; não substitui o Turnstile nem garante disponibilidade contra todo ataque.

## Operação pelo artista

1. Em **Configurações**, preencha nome, apresentação, contato público, WhatsApp com país e DDD, e revise o texto de uso dos dados.
2. Em **Biblioteca & portfólio**, envie imagens JPEG/PNG/WebP. O navegador produz WebP de até 1600 px, 500 KiB, e miniaturas de até 64 KiB. Os originais não são guardados no site. A biblioteca permite 500 imagens e 300 MiB.
3. Adicione imagens ao portfólio, com título e descrição acessível. A ordem define o destaque da página inicial.
4. Em **Formulários & preços**, crie serviços, preço base, perguntas e adicionais. Condições usam opções de perguntas anteriores. Mudanças na ordem que invalidem condições precisam ser corrigidas antes de salvar/publicar.
5. Em **Biblioteca & portfólio**, marque **Destacar na abertura** em até cinco artes. Em **Artes em destaque**, use as setas para ordenar a seleção. Sem seleção personalizada, o carrossel usa as primeiras cinco imagens do portfólio. **Usar as primeiras 5** volta à seleção automática. As imagens podem ser abertas em tamanho maior; o carrossel permite troca por setas, indicadores, teclado e gesto horizontal no celular.
6. Use **Prévia**, **Salvar** e **Publicar**. A prévia não envia pedidos. Salvar modifica apenas o rascunho. Publicar libera essa versão no site; a propagação de novas imagens no KV pode levar até 60 segundos.
7. Abra a agenda e publique quando contato, serviços, preços e Turnstile estiverem prontos. Valores zero são permitidos para opções sem custo; confirme conscientemente os preços base.
8. Em **Leads & trabalhos**, abra o pedido, use e-mail/WhatsApp para conversar e registre status, preço final, notas e atenção. Aceitar um lead o converte em trabalho. Abrir um pedido não limpa sua atenção automaticamente. Status não seguem uma sequência obrigatória, pois o trabalho e o pagamento são confirmados manualmente.
9. Perguntas, respostas, preço e versão do formulário ficam registrados no pedido. Editar preços ou remover serviços não altera pedidos anteriores.

Para apagar uma imagem, retire todas as referências do rascunho, publique e então exclua da biblioteca. Cópias públicas em cache podem continuar visíveis por até 24 horas. Não use a biblioteca para material privado do cliente. Envios incompletos mantêm uma reserva de armazenamento e aparecem na biblioteca para limpeza; isso evita ultrapassar o limite durante falhas.

## Domínio e e-mail (etapa posterior)

A compra e renovação do domínio são despesas separadas. `pages.dev` permite hospedagem sem comprar um domínio.

1. Adicione o domínio ao plano Free do Cloudflare e ao projeto Pages. Aguarde DNS e TLS. Atualize os hostnames do Turnstile.
2. Acrescente os caminhos administrativos do domínio à aplicação Access. Valide novamente o AUD e todas as URLs alternativas. Não proteja o site público inteiro.
3. Configure Email Routing no domínio e verifique o destino do artista. Se já existir um serviço de e-mail, revise a configuração e não substitua seus registros MX sem planejar a compatibilidade.
4. O Cloudflare permite enviar gratuitamente ao **destino verificado da própria conta**. Envio para destinatários arbitrários exige Workers Paid e está fora deste projeto. Não habilite esse plano. Veja [a regra oficial](https://developers.cloudflare.com/email-service/platform/pricing/).
5. Copie `workers/wrangler.example.jsonc` para um arquivo local ignorado ou arquivo de configuração revisado. Substitua banco, remetente, destino e URL administrativa. Limite o binding `send_email` a `destination_address` do artista.
6. Teste uma notificação para o destino verificado no plano Free. Somente depois defina `EMAIL_ENABLED=true` nos arquivos Wrangler do Worker e do projeto Pages de produção e faça os respectivos deploys. Mantenha preview desativado.

```powershell
npx wrangler deploy --config workers/wrangler.local.jsonc
```

O Worker não tem endpoint público. Um cron de cinco em cinco minutos envia notificações de novos leads e da primeira conversão em trabalho. A tabela `outbox` é salva junto com o pedido; até cinco tentativas automáticas ocorrem com atraso crescente. Falhas aparecem no painel, com nova tentativa manual. Pedidos anteriores à ativação não geram e-mail retroativo. A entrega é pelo menos uma vez: uma falha imediatamente após o provedor aceitar a mensagem pode gerar uma duplicata; nunca cria outro lead.

## Releases e manutenção

- Código: execute `npm test` e `npm run build` antes de enviar para `master`. Commits nessa branch fazem deploy de produção. Branches internas geram previews; não use dados reais nas prévias. Revise dependências e atualizações mensalmente.
- Banco: use novas migrações compatíveis com a versão atual. Faça backup e aplique em preview primeiro. Publicar código não aplica migrações automaticamente. Só libere mudanças que dependam do banco depois da migração.
- Rollback: em Pages → Deployments, restaure o último deployment conhecido. O rollback de código não desfaz banco, perguntas ou preços; use backup/Time Travel quando necessário. Antes de restaurar, registre alterações e interrompa novos pedidos de modo controlado.
- Cotas: verifique Workers, D1 e KV mensalmente e após campanhas. Requests estáticos não invocam Functions. Quotas dinâmicas esgotadas resultam em erros, não upgrade automático. D1 Free permite 500 MB por banco e Time Travel de 7 dias; exportações independentes são necessárias.
- Dados: escolha com o artista uma política de retenção apropriada. Exporte e exclua registros antigos deliberadamente. Não grave contatos, pedidos, tokens ou segredos em logs.
- Acesso: remova pessoas que não precisam mais do painel tanto da política Access quanto de `ADMIN_EMAILS`. Nunca use uma política de acesso público para corrigir problemas de login.

## Backup e restauração

Exporte os pedidos no painel como JSON para consulta. Para uma cópia completa (incluindo histórico, configurações, outbox e imagens), execute semanalmente em computador autorizado:

```powershell
npm run backup
```

O script salva SQL, imagens e manifesto em `backups/`, que não entra no Git. Precisa do Wrangler autenticado e IDs corretos de produção. Guarde cópia adicional em armazenamento privado e protegido, fora do computador de trabalho. Essa cópia local não cria despesa de armazenamento Cloudflare.

Para ensaiar restauração, use um banco de preview novo/vazio e um namespace KV de preview vazio, sem alterar produção:

```powershell
npx wrangler d1 execute DB --remote --env preview --file backups/PASTA/database.sql
npx wrangler kv key put "ID/image" --binding MEDIA --remote --env preview --path backups/PASTA/media/ID_image.webp
npx wrangler kv key put "ID/thumbnail" --binding MEDIA --remote --env preview --path backups/PASTA/media/ID_thumbnail.webp
```

Repita os dois comandos de mídia para cada chave do manifesto. Confira contagem de pedidos, histórico, versão publicada, imagens, preços e acesso no preview. Mantenha e-mails desativados. O backup contém dados pessoais: nunca coloque a pasta no Git ou em uma URL pública.

## Validação

`npm test` cobre preços, respostas inválidas, condicionais e preservação de snapshots. Antes de lançamento, verifique no preview o fluxo de lead completo, retry sem duplicação, uploads, publicação, todos os status, atenção, exclusão, acesso negado, limites, backup e restauração. Dados fictícios de teste devem ficar somente em preview/local.

## Estrutura

- `src/`: interfaces e modelo/validação compartilhados.
- `functions/`: APIs e proteção do painel.
- `migrations/`: evolução do D1.
- `workers/`: notificações por e-mail futuras.
- `scripts/`: backup local.

Sem contas de clientes, checkout, pagamentos automáticos ou upload de referências de clientes nesta versão.
