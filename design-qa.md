# Validação de interface

Este documento descreve como revisar a interface atual do Atelier Vic. Não é um certificado de aprovação nem um registro de execução dos testes.

Registros anteriores referenciavam capturas em diretórios pessoais e versões antigas do formulário em modal. Essas referências foram removidas do documento atual. O fluxo atual usa páginas de Portfólio, Sobre e Contato, com o briefing dentro de Contato.

## Ambiente

Use a instalação local descrita no README, com dados fictícios. Não use a produção para ensaiar pedidos, editar preços ou trocar imagens. Revise desktop (1280 × 720), tablet (768 × 1024) e celular (390 × 844).

## Roteiro de verificação

- Portfólio: categorias com nomes e capas, categorias vazias ocultas, imagens sem recorte indevido e retorno à lista.
- Visualizador: navegação entre obras da categoria, setas, Escape, contenção do foco e retorno à obra de origem.
- Sobre e Contato: textos formatados, links de contato e navegação direta ou por refresh.
- Briefing: três etapas, respostas preservadas ao voltar, perguntas condicionais, estimativa e tratamento de erros e reenvio.
- Agenda: aberta e fechada; alterar disponibilidade não publica outras edições pendentes.
- Administração: prévia sem envio real de pedidos, publicação, categorias, capas e tratamento de conflito de revisão.
- Temas: paletas e cores personalizadas, contraste, legibilidade e ausência de overflow horizontal.
- Rotas antigas: redirecionamento para o destino atual, incluindo Contato.
- Acesso: painel protegido fora do modo local; prévias remotas com a proteção configurada.

## Evidências

Ao executar a revisão, registre commit, data, ambiente, navegador, resolução e resultado de cada cenário. Use apenas dados fictícios em capturas destinadas ao repositório. Não inclua diretórios pessoais ou links para evidências que os leitores não conseguem acessar.

Testes automatizados e build estão descritos no README. Uma nova revisão visual, inclusive com tecnologias assistivas, deve ser registrada separadamente; não deduza aprovação visual a partir do build ou de testes unitários.
