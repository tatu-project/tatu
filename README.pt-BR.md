# Tatu

Assistente pessoal brasileiro, open source MIT, com backend online e aplicativo
web instalável no celular e no computador. [Read in English](README.md).

**Estado atual:** [beta privada de QA publicada](https://tatu-brasil-beta-vitti.craftystar18.chatgpt.site).
A verificação local final passou com 186 testes; sondas HTTPS reais confirmaram
bloqueios de acesso indevido. Leitura/proposta pelo MCP nativo autenticado funciona
para a conta verificada. Ainda faltam login/CRUD no navegador, IA real, visual no
celular e tarefa agendada. A publicação no
repositório está pendente neste registro de 12 de outubro; `803e1e6` é a base
pública anterior. Não há espera obrigatória de 30 dias. Veja o [roadmap](ROADMAP.md).

## Usar a beta privada

Abra o endereço privado e entre com a conta dona do Site; o acesso é só do dono.
Esse login ainda precisa de verificação em navegador. Use o Tatu no celular ou computador.
A instalação como PWA é opcional. Você não precisa deixar um PC ligado, instalar
Ollama, baixar modelos, usar Node.js ou abrir um terminal.

A versão candidata reúne conversas, notas, preferências escolhidas pelo usuário,
tarefas diárias, pausa/edição/retomada, histórico, leitor com fontes, conexões de
IA e MCP autenticado. Os recursos têm testes de implementação/cliente; o fluxo
autenticado completo no serviço publicado continua aberto. Não há promessa de
paridade completa com outros assistentes.

Não há conexão Workers AI nem chave Groq configurada: a conversa com IA está
indisponível agora. Após entrar, conecte sua própria chave Groq autorizada pelo
formulário HTTPS do aplicativo e verifique a primeira resposta real. Nunca cole
a chave no chat. Sem conexão, cota ou internet, o Tatu informa a indisponibilidade.

O pedido inicial é receber notícias de IA às **09:00, America/Sao_Paulo**. A busca
atual consulta feeds públicos selecionados sobre IA e aceita de 1 a 10 notícias.
Os fatos são trechos citados do RSS, sem afirmar que uma IA os escreveu. A entrega
é dentro do aplicativo. O agendamento no Site continua desativado até conectar e
verificar seu disparo automático; a configuração independente de Cron tem teste
separado. O teste real do despachante com fila vazia passou, mas nenhuma tarefa
nova ou agenda foi criada; isso não comprova uma execução sem intervenção.

O objetivo confirmado é gerar **resumos em áudio no NotebookLM**. O Tatu exporta
texto com fontes para importação manual no [NotebookLM](https://notebooklm.google.com/),
onde você gera o Audio Overview. A integração automática de áudio pela API do
Tatu não está implementada; uma conta gratuita não concede esse acesso de API.
Entregar só o texto não conclui o objetivo de áudio.

O MCP privado nativo funciona para a conta da plataforma verificada: listar
tarefas retornou `[]`; preparar tarefa retornou uma proposta às 09:00, com três
notícias de IA e confirmação obrigatória no aplicativo. Isso não criou tarefa
nem agenda. OAuth manual independente e login por cookie no navegador ainda
precisam de verificação separada.

## Dados e limites

| Informação                                           | Tratamento na versão candidata                                                    |
| ---------------------------------------------------- | --------------------------------------------------------------------------------- |
| Conversas, notas, preferências, tarefas e resultados | D1 online, separados pela conta autenticada                                       |
| Chave Groq                                           | Criptografia que o servidor pode abrir para chamar a API; não é E2EE              |
| Contexto escolhido para a conversa                   | Enviado ao provedor de IA autorizado                                              |
| Histórico de execução                                | Até 500 execuções finalizadas por conta; pendentes e em andamento são preservadas |

Mensagens, notas e preferências ficam em texto legível para a aplicação, embora
o armazenamento da plataforma seja criptografado. Apagar dados do Tatu não apaga
as cópias eventualmente retidas pelo provedor. O cofre privado com chave somente
do usuário ainda é trabalho separado, assim como apps nativos, controle de
aplicativos/dispositivos e ações em contas conectadas. Veja a
[arquitetura de segurança](docs/SECURITY-ARCHITECTURE.md).

As cotas atuais por conta são 8 pedidos de IA/minuto, 30/dia na rota patrocinada
ou 100/dia com BYOK, contexto de 4.096 bytes, até 1.024 tokens de saída e 2 pedidos
simultâneos. Limites compartilhados/do provedor podem ser menores; a cota externa
é desconhecida. A API limita 240 leituras e 60 alterações/minuto por conta.

O projeto prioriza caminhos gratuitos legítimos. Isso não garante hospedagem,
elegibilidade, IA ilimitada ou disponibilidade contínua. Não existe troca
automática para uma rota paga nem contorno de cotas.

## Desenvolver ou hospedar por conta própria

Os comandos de Node/npm são para mantenedores, não para usar a beta online.
Consulte [desenvolvimento](docs/DEVELOPMENT.md) e
[hospedagem](docs/DEPLOYMENT.md). O caminho independente Workers/D1/Access precisa
de conta, configuração e verificação próprias; não depende da conta do fundador.
O backend Node/SQLite anterior continua como opção local separada.

Para contribuir, leia [CONTRIBUTING.md](CONTRIBUTING.md) e [PROJECT.md](PROJECT.md).
Os [programas de apoio open source](docs/OPEN_SOURCE_SUPPORT.md) ajudam o
mantenedor; a beta privada não comprova adoção ou aprovação de candidatura.

[MIT](LICENSE). Modelos, provedores e dependências mantêm suas próprias condições.
