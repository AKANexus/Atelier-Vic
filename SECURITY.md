# Segurança e configuração

## Credenciais e identificadores

Não versione tokens de API, a chave secreta real do Turnstile, listas de e-mails administrativos, certificados, arquivos `.dev.vars`, dados de pedidos ou backups. Configure os segredos no ambiente Cloudflare e use arquivos locais ignorados durante o desenvolvimento.

O `wrangler.jsonc` operacional contém IDs de D1/KV, nome do projeto, domínio do Access, audiência (`ACCESS_AUD`) e chave pública do Turnstile. Esses valores identificam recursos, mas não substituem credenciais, um JWT válido ou a autorização de acesso. Foram mantidos para preservar a instalação existente. Para outra instalação, use o modelo `wrangler.example.jsonc` e seus próprios recursos.

As chaves em `.dev.vars.example` são [credenciais oficiais de teste do Turnstile](https://developers.cloudflare.com/turnstile/troubleshooting/testing/). São exclusivas de desenvolvimento. Nunca habilite `LOCAL_DEV_AUTH` em produção.

## Verificação de segredos

Com Gitleaks 8.30.1 instalado, na raiz do repositório:

```powershell
New-Item -ItemType Directory -Force security-reports | Out-Null
git fetch origin --tags
git fetch origin '+refs/heads/*:refs/remotes/origin/*'
gitleaks git . --log-opts="--all" --config .gitleaks.toml --redact=100 --report-format json --report-path security-reports/history.json
```

Se o clone for raso, execute `git fetch --unshallow origin` antes da verificação. A configuração estende as regras padrão e exclui somente linhas de `ACCESS_AUD` no `wrangler.jsonc` com o formato esperado. Ela não ignora o arquivo inteiro, segredos Turnstile ou outros tokens.

Uma análise sem achados não comprova ausência de todo segredo. Revise também anexos, artefatos, logs e dados de terceiros antes de publicar. Os relatórios ficam ignorados pelo Git e devem ser tratados como material privado.

## Relatar um problema

Não publique credenciais, dados de clientes ou detalhes de exploração em issues. Contate o responsável pelo repositório por um canal privado. Se uma credencial real tiver sido exposta, revogue-a ou substitua-a antes de tratar sua remoção do histórico.
