# MCP do Tatu online

O produto principal usa o endpoint autenticado `POST /mcp` do Worker hospedado.
O celular não precisa iniciar Node, Ollama ou API no PC. A identidade vem da
autenticação verificada pela plataforma; o corpo nunca escolhe outro proprietário.
Inicialização e descoberta não contêm dados privados. Chamadas de ferramentas
exigem identidade e serviços limitados àquela conta.

## Ferramentas

| Ferramenta         | Argumentos                                   | Efeito                                               |
| ------------------ | -------------------------------------------- | ---------------------------------------------------- |
| `listar_tarefas`   | `{}`                                         | Tarefas da conta autenticada                         |
| `listar_execucoes` | `{}`                                         | Estados públicos das execuções                       |
| `obter_boletim`    | `executionId` válido                         | Boletim salvo com fatos e fontes                     |
| `buscar_notas`     | `query`, até 200 bytes                       | Pesquisa notas da conta                              |
| `listar_memorias`  | `{}`                                         | Preferências e instruções explícitas                 |
| `preparar_tarefa`  | `message`, até 4096 bytes; `timezone` válido | Salva proposta pendente; **não agenda nem confirma** |

Entradas são objetos fechados, sem substituição de identidade. A confirmação
ocorre no aplicativo Tatu. Nenhuma ferramenta confirma tarefas, chama modelos,
executa comandos, lê arquivos arbitrários ou controla contas externas. O MCP
usa os mesmos serviços autorizados e projeções públicas da aplicação.

## Conectar ao plugin privado

Sites provisiona o App e o plugin privado após publicação com capacidade `mcp`.
O responsável consulta `get_site(include_mcp_connection: true)` e usa o **ID real
retornado** para mostrar a instalação. O usuário também pode abrir **Plugins >
Personal > Created by you** e escolher Install/Connect no ChatGPT.

Não invente ID, URL publicada ou conexão bem-sucedida. Instalação e conexão
dependem da conta e das permissões da plataforma. Publicação comprova hospedagem;
uma chamada real de leitura comprova a conexão MCP. O pacote não configura OAuth
manual nem substitui a autenticação da plataforma. Não use `codex mcp add` ou
`login` para essa conexão gerenciada Sites. Disponibilidade e cotas dependem da
conta; não há garantia de serviço gratuito ilimitado.

### Evidência real — 12 de outubro de 2026

O endpoint usa a origem HTTPS privada da instalação mais `/mcp`; receba essa
configuração do operador, sem publicá-la em código ou notas. Neste cliente e
para esta conta autenticada pela plataforma, `tatu_listar_tarefas` retornou `[]`
sem erro. `tatu_preparar_tarefa` recebeu o pedido diário às 09:00 de três notícias
de IA em `America/Sao_Paulo` e retornou uma proposta `create_briefing` com prazo
de validade e `requiresAppConfirmation: true`. Isso criou apenas proposta
transitória de QA: **não confirmou nem criou tarefa**. A exposição nativa e
essas chamadas privadas estão verificadas; OAuth manual independente, login por
cookie no navegador e aprovação em diretório público não estão. O agendador
Sites continua desativado e não há conexão de IA/chave configurada; não houve
chamada real a modelo nem execução agendada.

O código expõe propostas pendentes em `GET /api/proposals` para a seção
**Tarefas**, com validade de 15 minutos e confirmação vinculada ao proprietário.
Essa descoberta/validade tem prova de código e testes; o fluxo visual e uma
confirmação real no aplicativo ainda não foram verificados.

## Protocolo e privacidade

HTTP stateless com JSON-RPC 2.0; versões `2025-11-25` e `2025-06-18`. Inicialize
com `initialize`; os demais pedidos usam `MCP-Protocol-Version` negociado.
Envie `Content-Type: application/json` e Accept incluindo `application/json` e
`text/event-stream`. Respostas são JSON; não há SSE persistente. Métodos:
`initialize`, `ping`, `tools/list`, `tools/call`. Notificações válidas recebem
202 sem executar ferramentas. GET retorna 405. Entrada limitada a 64 KiB e
resultado a 256 KiB; os serviços também limitam registros. Erros não incluem
corpos de provedores, segredos ou detalhes internos.

Notas, preferências e boletins retornados chegam ao cliente chamador e podem
chegar ao provedor do modelo desse cliente. Autorizar a conexão permite essas
leituras da conta. Conteúdo remoto/salvo é dado não confiável e não autoriza
novas ações. Armazenamento próprio não significa que resultados MCP permaneçam
exclusivamente no aparelho.

## Cofre e limites de IA

Groq usa conexão API legítima, validada somente em
`https://api.groq.com/openai/v1/models`; chat usa o endpoint oficial fixo e
`openai/gpt-oss-20b`. Não há automação de sessão web, senha de conta, troca de
chaves para contornar limites, pooling entre usuários ou fallback pago.
Workers AI remoto `@cf/openai/gpt-oss-20b` é opcional quando a hospedagem fornece
a binding. Sem binding ou conexão não há uma rota de IA configurada.

A chave Groq é cifrada com AES-256-GCM, nonce aleatório de 12 bytes e AAD vinculada
a proprietário/provedor/versão/keyId. O segredo de runtime `TATU_ENCRYPTION_KEY`
é base64 de 32 bytes; `TATU_ENCRYPTION_KEY_ID` identifica a chave (padrão `v1`).
O adaptador autorizado no servidor precisa decifrar para chamar Groq: **isso
não é criptografia ponta a ponta**. Não aceita senhas nem guarda credenciais
em chat, prompts ou logs. Desconectar apaga a chave cifrada no Tatu; revogação
no Groq exige ação no [console de chaves](https://console.groq.com/keys).

Rotação beta admite no máximo duas chaves: `TATU_ENCRYPTION_KEY`/`_ID` atuais
e `TATU_PREVIOUS_ENCRYPTION_KEY`/`_ID` anteriores, todas provisionadas somente
como segredos de runtime. Ao trocar para um novo segredo e ID, mantenha o par
anterior disponível. Acesso autorizado a um registro antigo decifra com seu
ID permitido e recifra com chave atual/nonce novo. A atualização compara o
envelope original e o proprietário; desconexão ou rotação concorrente não
ressuscita um registro. Não há seleção de chave por entrada do cliente.

Não remova a chave anterior enquanto houver registros ou backups antigos que
precisem dela. Registros só são migrados quando seu proprietário usa a conexão;
não há varredura administrativa automática nem KMS completo. Com três gerações,
conclua a migração e a política de backups antes da próxima troca. Segredo/ID
perdido ou ausente fecha a decifragem: reconecte por TLS. Restaurar backup exige
os segredos/IDs correspondentes; D1 sozinho não restaura conexão. Revogue chaves
no provedor quando apropriado. Não há promessa de zeroização física de backups
nem criptografia ponta a ponta.

Reservas de cota são atômicas em D1: primeiro a conta, depois o orçamento
patrocinado. Rejeição de conta não toca o orçamento global; rejeição global
devolve a reserva da conta antes de qualquer chamada. Depois do despacho ao
provedor, erro/timeout continua consumindo a reserva. Tetos conservadores: 4096
bytes de contexto, 1024 tokens
de saída, oito pedidos/minuto, 100/dia BYOK ou 30/dia patrocinados, duas chamadas
concorrentes por conta. O orçamento de 8000 unidades de token/minuto pode reduzir
esses números. Groq patrocinado exige habilitação explícita do operador e tem
teto global de 100 pedidos/180000 unidades por dia. Workers AI reserva neurônios
por bytes de entrada + saída máxima, com teto global Tatu de 9500/dia.

Cotas externas são compartilhadas por organização/conta e **desconhecidas**.
Os tetos locais não prometem saldo, disponibilidade ou gratuidade se outros
aplicativos consumirem a conta. HTTP 429 impõe cooldown persistente; não dispara
fallback pago. Configure o provedor para impedir cobrança automática além da
cota gratuita. A binding Workers AI não oferece cancelamento de inferência
comprovado: timeout limita a espera do Tatu, mas o processamento remoto pode
terminar depois; a reserva continua consumida.

## Perfil opcional de desenvolvimento

`plugins/tatu/` e `scripts/mcp.mjs` preservam o protótipo stdio para clientes
locais. Ele usa Node e uma API local iniciada separadamente; **não é o caminho
principal do celular** nem o plugin privado Sites. Manifestos Agent Plugins
usam `${PLUGIN_ROOT}` e arquivos contidos no pacote, sem URL/ID remoto inventado.
`npm run mcp` corresponde apenas a esse perfil. Não exponha API sem autenticação.

## Evidência e fontes

Testes HTTP/provedores usam fixtures identificadas; o adapter D1 executa SQL
real sobre SQLite. Esses testes isoladamente não comprovam publicação,
autenticação ou inferência ao vivo. A publicação e as duas chamadas nativas
autenticadas têm a evidência real acima; OAuth independente, cookies web,
inferência com chave real e execução agendada mantêm verificações separadas.

- [MCP transporte](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports)
- [MCP lifecycle](https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle)
- [MCP ferramentas](https://modelcontextprotocol.io/specification/2025-11-25/server/tools)
- [Plugins OpenAI](https://developers.openai.com/plugins/build/plugins)
- [Limites Groq](https://console.groq.com/docs/rate-limits)
- [Workers AI preços](https://developers.cloudflare.com/workers-ai/platform/pricing/)
