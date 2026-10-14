# Ateliê — portfólio e gestão de encomendas

Aplicação web para artistas apresentarem suas obras, receberem briefings e acompanharem encomendas em um painel administrativo. O visitante escolhe um serviço, responde a perguntas condicionais e recebe uma estimativa inicial; o artista conduz a negociação e registra a evolução do trabalho.

O projeto reúne site público, editor de conteúdo, cálculo de orçamento e gestão de leads. A interface é em português brasileiro e os valores são apresentados em reais.

## Funcionalidades

- **Portfólio:** categorias, capas, obras em tamanho integral e visualizador com navegação por teclado.
- **Apresentação do artista:** banner, biografia, textos formatados, contatos e temas com validação de contraste.
- **Briefing em etapas:** serviços, perguntas condicionais, adicionais e estimativa de preço.
- **Painel administrativo:** galeria, organização das obras, formulários, preços e abertura ou fechamento da agenda.
- **Leads e trabalhos:** status, notas, preço final, histórico e conversão de pedido em trabalho.
- **Prévia e publicação:** revisão das alterações antes de aplicá-las ao site público.
- **Notificações:** Worker de e-mail com fila e novas tentativas, disponível após configuração do ambiente.

O fluxo público percorre **Portfólio → Contato → escolha do serviço → briefing → envio do pedido**. No painel, o artista analisa a solicitação, combina os detalhes por contato direto e acompanha o trabalho.

## Arquitetura e tecnologias

| Componente | Responsabilidade | Tecnologias |
| --- | --- | --- |
| Interface | Site público e administração | React 19, TypeScript, Vite |
| Domínio compartilhado | Validação, perguntas condicionais e cálculo | TypeScript, Zod |
| API | Pedidos, configuração, mídia e controle de acesso | Cloudflare Pages Functions |
| Persistência | Configurações, pedidos, histórico e fila de notificações | Cloudflare D1 |
| Mídia | Imagens WebP e miniaturas | Cloudflare KV |
| Acesso e proteção de envio | Autenticação administrativa e validação do formulário | Cloudflare Access, JWT e Turnstile |
| Notificações | Processamento periódico da fila de e-mails | Cloudflare Workers |
| Testes | Regras de negócio, acesso e comportamento da aplicação | Vitest e smoke local de API |

### Decisões técnicas

- **Valores em centavos:** o cálculo usa inteiros e valida respostas, opções repetidas e perguntas não reconhecidas. Respostas de perguntas ocultas não entram na estimativa.
- **Histórico preservado:** cada pedido registra perguntas, respostas e valores utilizados, mantendo o orçamento independente de edições futuras.
- **Controle de concorrência:** revisões detectam conflitos ao editar configurações e pedidos.
- **Entrega de notificações:** a outbox é gravada junto com o pedido; o Worker faz novas tentativas sem criar outro lead. A entrega de e-mail pode ocorrer mais de uma vez em uma falha após o envio.
- **Conteúdo estruturado:** o editor trabalha com texto e marcas permitidas, sem executar HTML arbitrário.
- **Reserva de armazenamento:** uploads reservam metadados antes da gravação no KV; falhas preservam a reserva até limpeza explícita.

## Executar localmente

Requisitos: Node.js 22 ou 24 e npm. Os comandos abaixo são para PowerShell, na raiz do repositório:

```powershell
npm ci
if (-not (Test-Path .dev.vars)) {
    Copy-Item .dev.vars.example .dev.vars
}
npm run db:local
npm run build
npm run preview
```

Se `.dev.vars` já existir, compare suas configurações com o exemplo antes de iniciar.

- Site público: http://127.0.0.1:8788/
- Painel: http://127.0.0.1:8788/admin

No painel, configure o artista, os serviços, as perguntas e as imagens. Use **Prévia** para conferir o conteúdo e **Publicar** para aplicá-lo ao ambiente local. A agenda começa fechada e o portfólio vazio.

O acesso de desenvolvimento aceita apenas `localhost` ou `127.0.0.1` na porta 8788. As chaves de teste do Turnstile e `LOCAL_DEV_AUTH` são exclusivas do ambiente local. Após alterar o código, execute `npm run build` novamente.

## Testes e validação

```powershell
npm test
npm run build
```

A suíte cobre cálculo de estimativas, perguntas condicionais, snapshots históricos, categorias, apresentação, agenda, acesso administrativo e notificações.

Com a aplicação local em execução na porta 8788, o smoke de API pode ser executado em outro terminal:

```powershell
npm run test:local
```

Esse smoke exercita gravações e fluxos administrativos: use uma base local de teste descartável. Para lançamento, valide também o fluxo completo no preview, os acessos, os uploads e a restauração de backup, conforme o guia operacional.

## Implantação e operação

O projeto foi planejado para os planos gratuitos dos serviços Cloudflare utilizados. As configurações de produção, preview, acesso, notificações e backup estão no [guia de operação](docs/OPERACAO.md).

- [Configuração do Cloudflare](docs/OPERACAO.md#criar-o-ambiente-cloudflare).
- [Uso pelo artista](docs/OPERACAO.md#operação-pelo-artista).
- [Domínio e notificações](docs/OPERACAO.md#domínio-e-e-mail-etapa-posterior).
- [Releases e manutenção](docs/OPERACAO.md#releases-e-manutenção).
- [Backup e restauração](docs/OPERACAO.md#backup-e-restauração).

A implantação depende da configuração dos recursos e segredos do ambiente. Notificações ficam desativadas até a preparação e validação do e-mail. O guia preserva os procedimentos operacionais e as restrições de contratação do projeto.

## Limites da versão

- A estimativa não substitui a confirmação do orçamento pelo artista.
- Negociação, confirmação do trabalho e pagamento são acompanhados manualmente.
- Não há conta de cliente, checkout, cobrança automática ou upload de referências pelo cliente.
- O site guarda imagens convertidas e miniaturas; os originais não são preservados.

## Organização do código

- `src/`: interfaces, rotas públicas, domínio e validação compartilhados.
- `functions/`: API e proteção do painel.
- `migrations/`: esquema e evolução do D1.
- `workers/`: processamento de notificações.
- `tests/`: testes automatizados.
- `scripts/`: smoke local e backup.
- `docs/`: guia de implantação e operação.
