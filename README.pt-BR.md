# Tatu

Assistente pessoal brasileiro, open source sob licença MIT, com backend online
e aplicativo web em português para celular e desktop. Prioriza opções gratuitas,
provedores substituíveis e hospedagem própria opcional. [Read in English](README.md).

**Estado atual:** a versão privada 3 está publicada com monitor da conexão,
teste de resposta separado e controle de histórico por envio. Qwen carregado,
pareamento e respostas na versão 2 são relatos do proprietário; leitura MCP
tem verificação independente. Testes locais, visual desktop/celular com APIs
simuladas, verificações limitadas do gateway e CI Windows/Linux passam. Teste
real controlado na versão 3, histórico/parada/modo ativo, instalação PWA,
qualidade dos guardrails e agendamento continuam abertos.
[ROADMAP.md](ROADMAP.md) separa as evidências.

URLs, IDs, contas, credenciais e registros operacionais privados não entram no
código público. Receba acesso/configuração do responsável pela sua instalação.

## Usar sua instalação

1. Abra o endereço HTTPS privado e entre com uma conta autorizada.
2. Use Chat, Tarefas, notas, memória explícita e o leitor com fontes. O shell
   PWA existe; instalação e visual no celular ainda precisam de validação.
3. Escolha uma rota autorizada de IA. Groq opcional usa o formulário HTTPS,
   nunca o chat. Workers AI exige binding; Colab usa sua própria VM Google.

O caminho online padrão não exige PC ligado, Node.js, Ollama nem modelo local.
O modelo Colab fica na VM Google. Rotas ausentes, computação parada, cotas e
falhas são mostradas claramente; não há resposta inventada ou fallback pago.

Para conversar pelo **Telegram**, siga [o guia do Telegram](docs/TELEGRAM.md)
(webhook no Worker gratuito, só IDs autorizados).

Para **Meu Qwen no Google Colab**, siga [o guia](docs/COLAB-CONNECTION.md).
Receba origem/ID de forma privada e informe-os só nos campos ocultos do notebook.
O pareamento usa chave efêmera e dados criptografados no Tatu. Revise o contexto
exato no Tatu e confirme `PROCESSAR` no modo manual. Modo ativo é opcional, até
20 minutos, e exige benefício pago elegível com unidades Colab positivas.
Não é um backend gratuito permanente.

O painel atualizado distingue pareamento válido de resposta recebida. Seu teste
aritmético público exige autorização, consome um pedido da cota e salva uma
conversa separada, sem histórico anterior, notas ou memórias. Confira resposta,
modelo e tempo reais; receber texto e acertar a conta são resultados separados.
Em Conversas, **Usar histórico desta conversa** vale para o próximo envio, sem
apagar mensagens salvas. O contador inclui somente notas/memórias selecionadas:
zero não significa histórico desligado.

## Implementado e ainda pendente

| Capacidade                                  | Evidência                                          | Validação restante                                    |
| ------------------------------------------- | -------------------------------------------------- | ----------------------------------------------------- |
| Conversas, notas, memória, tarefas e leitor | Testes SQL/API/interface                           | CRUD autenticado e visual no celular                  |
| Workers AI/Groq e chaves opcionais          | Adapters, cotas e falhas testados                  | Resposta real e ciclo da conexão                      |
| Qwen/Colab pessoal                          | Versão 3; relatos da v2 e testes de segurança/jobs | Teste controlado da revisão atual e parada/modo ativo |
| MCP                                         | Listagem e propostas nativas verificadas           | Confirmação, OAuth independente/diretório público     |
| Boletim diário                              | RSS e execução durável implementados               | Ocorrência real; ponte gerenciada desativada          |
| NotebookLM Audio Overviews                  | Exportação de texto/importação manual              | Áudio pelo usuário; automação Enterprise futura       |

O caso de referência é notícias de IA às **09:00, America/Sao_Paulo**. Fontes
são preservadas e trechos RSS não são apresentados como inferência. A proposta
MCP ainda exige confirmação no Tatu.

A prova histórica da versão privada 2 inclui 205 testes, três migrações/15
tabelas D1 e duas fases de 22 testes negativos no gateway. Em 13 de outubro,
o código público passou 210 testes/build e conector13/notebook original8;
auditoria de produção sem vulnerabilidades conhecidas. A versão 3 de 14 de
outubro passa format/lint/types/226 testes/build e conector13/notebook8.
Navegador desktop/celular valida layout, respostas esperadas/divergentes,
expiração e cancelamento com APIs simuladas; não é inferência Google. O commit
[78f5c2b](https://github.com/tatu-project/tatu/commit/78f5c2bf2816e12879cf41fa5732e54c33290dd9)/
[CI38567151349](https://github.com/tatu-project/tatu/actions/runs/38567151349)
passa Windows/Linux. Dezesseis verificações reais de acesso/estado passam;
origem direta e login positivo pelo navegador são lacunas explícitas. Essas
etapas limitadas não concluem validação real/PWA/guardrails/agendamento.
Não há espera obrigatória de 30 dias.

## Privacidade e limites

- Chaves operacionais usam AES-GCM decifrável pelo servidor: **não é E2EE**.
  Textos ficam em claro na camada da aplicação; contexto selecionado vai ao
  provedor/VM Google. Apagar no Tatu não apaga cópias do provedor.
- Credenciais Colab expiram/revogam e não autorizam APIs comuns/do sistema.
  Expirar bloqueia acesso; limpeza física depende de acesso posterior configurado/
  revogação/exclusão/retenção, sem promessa de apagamento por prazo ou de zerar
  fisicamente a memória Python.
- Entrada, resposta, requisições e orçamento são limitados. Cotas externas,
  elegibilidade, hospedagem gratuita, GPU e disponibilidade não são garantidas.
- Aplicativos nativos, ações em dispositivos/contas, cofre com chave do usuário
  e áudio automático seguem como trabalho futuro. Paridade não é uma promessa.

Leia [segurança](docs/SECURITY-ARCHITECTURE.md), [implantação](docs/DEPLOYMENT.md)
e [o PRD completo](docs/PRD.md).

## Desenvolver ou hospedar por conta própria

Use Node.js `>=24.11.0 <25` e npm `>=11.6.0 <12`:

```sh
npm ci
npm run ci
npm run build
```

São comandos para mantenedores. `apps/cloud` é o backend principal. O template
público é genérico; builds comuns não precisam de identidade privada. Exportação
gerenciada exige `SITE_PROJECT_ID` válido, informado por processo, e falha sem
ele. Não salve origens/IDs/segredos/capturas privadas em commits/outputs.
[DEPLOYMENT.md](docs/DEPLOYMENT.md) explica Sites e Workers/D1/Access próprios.
Node/SQLite é um perfil legado opcional; sua API sem autenticação fica em loopback.

[PROJECT.md](PROJECT.md) define escopo; [ROADMAP.md](ROADMAP.md), progresso;
[AGENTS.md](AGENTS.md) e [CONTRIBUTING.md](CONTRIBUTING.md), colaboração.
[Programas para mantenedores](docs/OPEN_SOURCE_SUPPORT.md) não subsidiam a IA
pública nem significam aprovação ou adoção.

MIT: [LICENSE](LICENSE). Provedores/modelos/dependências mantêm seus termos.
Vulnerabilidades: [SECURITY.md](SECURITY.md).
