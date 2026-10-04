# Tatu

Um projeto brasileiro de assistente pessoal gratuito, open source e
auto-hospedável, com licença MIT.

[Read in English](README.md).

**Estado atual:** desenvolvimento inicial. A primeira entrega é um briefing
diário de notícias com fontes. O teste real de confiabilidade de 30 dias ainda
está aberto; o Tatu ainda não está pronto para uso em produção.

## O que funciona hoje

- Preparar e confirmar um pedido diário, como “Todos os dias às 8h, encontre
  as três notícias mais importantes sobre inteligência artificial e me envie”.
- Salvar a tarefa e executar as ocorrências com histórico, tentativas e
  recuperação após reiniciar o processo.
- Buscar notícias em feeds RSS públicos HTTPS, selecionar fontes e gerar
  um resultado com citações.
- Usar síntese por Ollama local quando configurada. O resultado padrão do RSS
  é determinístico e não chama um modelo de IA.
- Entregar o briefing em Markdown na pasta local `data/deliveries`.
- Consultar tarefas, testar uma execução e acompanhar seu histórico no navegador.

O campo Chat hoje prepara pedidos de briefing diário. Conversa geral com IA,
memória pessoal editável, notificações externas, PWA instalável e integração
MCP/ChatGPT ainda precisam ser construídos.

## Instalar e usar

Instale Git, Node.js `>=24.11.0 <25` e npm `>=11.6.0 <12`. Docker e Ollama são
opcionais. Em um terminal:

```sh
git clone https://github.com/tatu-project/tatu.git
cd tatu
npm ci
npm run ci
npm run dev
```

No PowerShell, use `npm.cmd` se a execução do arquivo `npm.ps1` estiver bloqueada.

Abra `http://127.0.0.1:3000`, prepare o pedido e confirme a tarefa. Use
**Testar agora** para conferir o fluxo sem esperar pelo horário agendado.
Leia o arquivo gerado em `data/deliveries`; a página mostra uma prévia das
notícias e o histórico da execução.

Mantenha o computador e os processos ligados para os próximos agendamentos.
Se a rede ou a fonte estiver indisponível, a execução registra a falha.
O comando de desenvolvimento não instala um serviço de inicialização automática.

A configuração npm do repositório desativa scripts de instalação de
dependências. O SQLite usa o binário incluído no pacote para as plataformas
suportadas. Novas dependências que precisem desses scripts exigem revisão.

Para configuração, backup e resolução de problemas, consulte o
[guia de instalação](docs/DEPLOYMENT.md). Para observar execuções diárias,
siga o [protocolo de confiabilidade](docs/RELIABILITY-TRIAL.md).

## Dados e custos

| Dado ou operação               | Onde acontece                                         |
| ------------------------------ | ----------------------------------------------------- |
| Tarefas, execuções e histórico | SQLite na instalação do usuário                       |
| Briefings entregues            | Pasta local `data/deliveries`                         |
| Busca RSS                      | Requisições às fontes públicas configuradas           |
| Síntese opcional por Ollama    | Endpoint local, com o tema e as notícias selecionadas |

O caminho padrão não exige conta de provedor de IA, chave de API, VPS ou banco
remoto. Ele usa os recursos e a conexão do computador do usuário; isso não
significa ausência de consumo de energia ou de requisitos de hardware.

As fontes RSS recebem as requisições e seus metadados de rede. No fluxo atual,
o tema é filtrado localmente; não há envio do histórico de conversa a um
provedor remoto de IA. Se futuramente houver um provedor remoto, o Tatu deverá
explicar os dados enviados antes da conexão.

Proteja a máquina e seus backups. Não coloque credenciais no tema, nas URLs
dos feeds ou em arquivos versionados. A validação atual reconhece padrões
limitados de credenciais; não detecta todos os dados pessoais. O serviço é
individual e local, sem autenticação para acesso remoto.

## Contribuir

Comece pelo [roadmap](ROADMAP.md) e pelo
[guia de contribuição](CONTRIBUTING.md). Correções, testes, documentação e
relatos de uso ajudam a fechar a primeira entrega. O projeto acompanha
evidências reais de manutenção e adoção; ainda não afirma ter uma base de
usuários validada.

[MIT](LICENSE). Modelos, dependências e integrações mantêm suas próprias
licenças e condições de uso.
