# Tatu no Telegram

Status: implementado no Worker com testes automatizados de fixture. Ainda não
foi verificado em um celular real contra a API do Telegram; trate esta página
como guia de configuração, não como prova de funcionamento ao vivo.

O Tatu responde a um único bot do Telegram por instalação, recebendo mensagens
por webhook no Worker gratuito (`POST /api/telegram/webhook`). Só os IDs de
usuário que você autorizar recebem resposta; qualquer outra pessoa, grupo ou
canal é ignorado em silêncio, sem criar conta nem gravar dados.

## Pré-requisitos

- Uma instalação no caminho portátil Workers/D1 (veja
  [DEPLOYMENT.md](DEPLOYMENT.md#independent-workersd1access-lane)) com uma
  origem HTTPS pública (`SITE_ORIGIN`).
- Pelo menos uma rota de IA configurada (Workers AI, Groq da instalação ou a
  sua chave Groq).
- O Telegram precisa alcançar `https://SUA-ORIGEM/api/telegram/webhook` sem
  login. Se a origem estiver atrás do Cloudflare Access, crie uma aplicação do
  Access só para esse caminho com política **Bypass**. A rota se protege pelo
  segredo do webhook e pela lista de IDs autorizados; nenhum outro caminho deve
  ser liberado. O caminho privado Sites não recebe webhooks externos.

## Passo a passo

1. **Crie o bot.** No Telegram, fale com [@BotFather](https://t.me/BotFather),
   envie `/newbot`, escolha nome e usuário e copie o token mostrado. O token é
   um segredo: não cole em chats, issues, código ou no próprio Tatu.
2. **Descubra o seu ID de usuário.** Fale com um bot como
   [@userinfobot](https://t.me/userinfobot) e anote o número `Id`. Para mais de
   uma pessoa, separe os IDs por vírgula (no máximo 16).
3. **Gere o segredo do webhook.** Use de 32 a 256 caracteres `A-Z`, `a-z`,
   `0-9`, `_` ou `-`, por exemplo:

   ```sh
   node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
   ```

4. **Grave os segredos no Worker** (a partir de `apps/cloud`):

   ```sh
   npx --no-install wrangler secret put TELEGRAM_BOT_TOKEN --config wrangler.jsonc
   npx --no-install wrangler secret put TELEGRAM_WEBHOOK_SECRET --config wrangler.jsonc
   npx --no-install wrangler secret put TELEGRAM_OWNER_IDS --config wrangler.jsonc
   ```

   Se qualquer um dos três estiver ausente ou inválido, a rota responde 404 e
   nada é processado.

5. **Aplique as migrações** (a migração `0004_telegram.sql` cria as tabelas do
   Telegram) e publique o Worker:

   ```sh
   npx --no-install wrangler d1 migrations apply tatu --remote --config wrangler.jsonc
   npx --no-install wrangler deploy --config wrangler.jsonc
   ```

6. **Registre o webhook** na raiz do repositório, com as variáveis apenas no
   ambiente do terminal (não as salve em arquivos versionados):

   ```sh
   TELEGRAM_BOT_TOKEN=... TELEGRAM_WEBHOOK_SECRET=... SITE_ORIGIN=https://SUA-ORIGEM npm run telegram:webhook
   ```

   O script chama `setWebhook` com `allowed_updates: ["message"]` e descarta
   atualizações pendentes. Ele imprime só sucesso ou falha, sem segredos.

7. **Teste.** Envie `/start` ao seu bot. Depois peça algo em texto. Para
   conferir o bloqueio, peça a outra pessoa que mande uma mensagem: ela não deve
   receber resposta.

## Comandos

| Comando                     | O que faz                                                                    |
| --------------------------- | ---------------------------------------------------------------------------- |
| `/start`, `/ajuda`, `/help` | Mostra ajuda e limites                                                       |
| `/novo`                     | Começa uma nova conversa; a anterior continua salva                          |
| `/memoria`                  | Lista até 20 memórias salvas, mais recentes primeiro                         |
| `/memoria <texto>`          | Salva uma preferência (textos com senhas ou tokens são recusados)            |
| `/esquecer <n>`             | Apaga a memória de número `n` na lista de `/memoria`                         |
| `/modelo`                   | Mostra as rotas (`groq`, `groq-sponsored`, `workers-ai`) e a escolha atual   |
| `/modelo <rota>`            | Troca a rota (`auto` volta à ordem padrão); rotas não configuradas recusadas |

Texto comum vira uma conversa chamada “Telegram”, salva no D1 com o histórico
usado nas próximas respostas.
Fotos, áudios e outros tipos recebem um aviso de que só texto é suportado.

## Limites honestos

- Rotas gratuitas têm cotas. Quando a IA está indisponível, sem cota, demora
  demais ou responde algo inválido, o Tatu avisa e não grava resposta inventada.
- A preferência de `/modelo` só escolhe entre rotas já configuradas. Se a rota
  escolhida deixar de existir, vale a ordem automática; nunca entra uma rota
  paga que você não configurou.
- A regra “somente provedores que não treinam com seus dados” ainda não é
  verificada automaticamente (etapa 13 do roadmap). Confira a política de cada
  provedor antes de configurá-lo.
- A conta do Telegram é um dono separado da conta do app web (Access/Sites):
  histórico, memórias e escolha de `/modelo` ficam nela e ainda não aparecem no
  app web. Ligar as duas contas é um passo futuro. Por isso a rota `groq` (sua
  chave Groq, cadastrada no app web) ainda não fica disponível no Telegram.
- Memórias salvas pelo Telegram são enviadas à rota de IA escolhida junto com
  cada mensagem, como dados e não como instruções: as mais recentes primeiro,
  até cerca de 1500 bytes. As que não couberem ficam de fora; se a mensagem for
  grande demais para incluir memórias, ela vai sem elas. Apague uma memória com
  `/esquecer <número>`; editar ainda não é possível pelo Telegram.
- Respostas longas são divididas em até quatro mensagens; acima disso a última
  parte é cortada com aviso (a resposta inteira fica salva no histórico).
- Cada atualização é processada no máximo uma vez: ela é registrada antes do
  processamento e não é repetida se algo falhar no meio. Nesse caso reenvie a
  mensagem.
- Uma conversa com 200 mensagens é encerrada sozinha e a próxima mensagem abre
  outra. No limite de 200 conversas, a menos usada recentemente é apagada para
  abrir espaço, e a resposta avisa.
- A ordem de processamento não é garantida se você mandar várias mensagens ao
  mesmo tempo; enquanto uma resposta está em andamento, a seguinte recebe um
  pedido para aguardar.

## Segurança

- O cabeçalho `X-Telegram-Bot-Api-Secret-Token` é comparado em tempo
  constante; segredo errado ou ausente recebe 401.
- Corpo limitado a 64 KB, validação estrita da atualização e texto até 4096
  caracteres. Depois do segredo verificado, atualizações inválidas ou sem suporte
  recebem 200 e são ignoradas, para o Telegram não ficar repetindo e travando
  as próximas. `update_id` repetido é ignorado (idempotência; registros de
  atualização são apagados após cerca de três dias).
- O dono interno é derivado de `telegram:<id do bot>` + ID do usuário; o ID do
  Telegram nunca é usado como chave interna.
- O token e o segredo do webhook entram na lista de segredos recusados como
  conteúdo. Nada do corpo das atualizações nem tokens é registrado em log.
- As chamadas à API do Telegram usam `redirect: 'error'`, tempo limite de 5 s (2 s para o aviso “digitando”),
  leitura limitada da resposta e texto puro (sem `parse_mode`, sem prévia de
  links). Erros nunca incluem a URL com o token.
