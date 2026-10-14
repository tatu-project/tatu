# Conectar seu Qwen no Colab ao Tatu

O proprietário observou carregamento, pareamento e respostas Qwen no Tatu em
14 de outubro de 2026, na versão privada 2. Isso é evidência de uso relatada pelo
proprietário, não um teste independente de qualidade, segurança ou disponibilidade.
Os controles de estado, teste e histórico abaixo estão publicados na versão 3,
com testes locais, visual com APIs simuladas e verificações limitadas do gateway.
Ainda falta uma resposta controlada real nessa revisão e validação de histórico/
parada/modo ativo/PWA. Este guia não publica endereço/ID privado.

Se já estiver usando o Tatu, atualize a página do aplicativo. Mantenha o modelo
carregado no Colab e confira o painel de estado. Refaça o pareamento se a sessão
expirou; uma sessão válida não exige novo carregamento do modelo. Depois faça o
teste público descrito abaixo e compare um pedido inofensivo com histórico desligado.

## Preparar o modelo na VM Google

Se Qwen3-8B continua carregado, não recarregue a página. Se a VM reiniciou, mantenha
**8B** e execute as células de configuração, verificação de recursos, instalação
na VM e carregamento do [notebook](../notebooks/qwen-colab-experiment.ipynb).
Pule a demonstração e **Liberar e encerrar** enquanto for usar o Tatu. Pesos/cache
ficam no Colab; uma VM nova pode precisar baixá-los. Nada é instalado no PC.

## Conectar

1. Execute **Preparar conexão pessoal com o Tatu**. Nos campos ocultos, informe
   a origem HTTPS e o ID do projeto recebidos privadamente do operador. São dados
   da sua instalação, nunca valores copiados do repositório ou de um envelope.
   A origem deve ser o host gerado da instalação Sites, sem porta/caminho/query/
   fragmento; o conector valida também o formato do projeto. Esses valores ficam
   apenas na memória da VM, não em código, screenshots ou outputs salvos.
2. Copie a chave pública efêmera **inteira**, incluindo as linhas
   `-----BEGIN PUBLIC KEY-----` e `-----END PUBLIC KEY-----`. Em **Configuração**,
   no bloco **Google Colab**, cole a chave, autorize o processamento na VM Google
   e escolha manual ou sessão interativa. Clique **Gerar conexão com meu Colab**
   e **Copiar código criptografado**. Execute `tatu_pair()` e cole na entrada
   oculta em até dois minutos. Um handoff de célula única pode já estar esperando
   essa entrada. Nunca cole chave de API/senha/segredo em código, chat ou outputs.
3. No chat, selecione **Meu Qwen no Colab**, revise o contexto exato e autorize
   o envio ao Google. Envie uma mensagem. Execute `tatu_once()` e confirme
   `PROCESSAR` para uma mensagem manual, ou use `tatu_active()` no modo ativo
   autorizado. A resposta aparece no Tatu; o notebook não imprime texto privado.

Na cópia antiga ainda aberta, adicione uma célula, copie o
[conector genérico](../scripts/colab_connector.py) e prepare com
`tatu_prepare(origin, project_id)`, usando variáveis recebidas de forma privada
na memória da VM. O notebook atualizado já pede os dois valores com campos ocultos.
Não grave valores literais na célula. A dependência adicional `cryptography` é
preservada se compatível (42.0.2 ou posterior), ou instalada como 50.0.2 somente
na VM; o PyTorch fornecido não é substituído.

O operador também pode fornecer um notebook privado com uma célula de
preparação/pareamento/execução. Ele não pertence ao repositório público. Guarde
a cópia de forma privada; fornecer o arquivo não comprova uma resposta real.

## Saber se está funcionando

O painel **Estado da conexão** mostra o próximo passo e o prazo restante.
**Pareado · resposta ainda não testada** significa que a sessão é válida;
não comprova que a célula está atendendo. Para confirmar o caminho completo:

1. Conclua o pareamento e as confirmações no notebook. No modo manual,
   prepare-se para executar `tatu_once()` e confirmar `PROCESSAR`; na sessão
   interativa, mantenha `tatu_active()` em execução após os consentimentos.
2. Em **O Qwen está respondendo?**, revise e autorize o texto público
   **“Quanto é 17 × 19? Responda apenas com o número.”** e clique em **Testar
   resposta do Qwen**. O teste consome a cota normal e cria uma conversa separada, sem
   histórico anterior, notas ou memórias selecionadas. Não envia sua conversa
   aberta nem seu rascunho; a conversa do teste fica salva e pode ser excluída.
3. Acompanhe **Teste na fila** e **Qwen processando o teste**. No modo manual,
   volte ao Colab e confirme `PROCESSAR` para atender esse pedido.
4. Confira a resposta real, o modelo e o tempo desde o envio. **323** confirma
   o resultado esperado; outro texto confirma recebimento, mas é marcado como
   divergente. Esse teste verifica uma resposta simples, não guardrails,
   pesquisa na internet ou tarefas agendadas.

Use **Cancelar teste** para interromper ou **Abrir conversa do teste** para
inspecionar o resultado. O teste aguarda no máximo dois minutos, respeitando
também a expiração do job e da sessão; sem resposta, confira a célula e as
confirmações no Colab. **Atualizar estado** verifica a sessão, sem executar IA.
O painel não produz uma resposta fictícia nem troca automaticamente de provedor.

## Controlar o histórico de cada envio

Em **Conversas → Contexto que você escolhe compartilhar**, **Usar histórico
desta conversa** começa marcado. Desmarque para enviar o próximo pedido sem
mensagens anteriores. A mensagem atual e as notas/memórias escolhidas continuam
incluídas; nada é excluído do histórico salvo. Revise a seleção e renove o
consentimento Colab antes de enviar. **Nova conversa** também inicia sem os
turnos da conversa anterior.

O contador mostra somente notas e memórias selecionadas: **0** não significa
que o histórico está ausente. Se uma recusa se repetir após mudar de assunto,
compare um pedido público inofensivo com histórico ligado/desligado ou em uma
nova conversa. O relato atual sugere influência do contexto, mas ainda não
identifica sua causa nem comprova um defeito nos guardrails.

O Colab recebe no máximo 12 mensagens de contexto. Quando necessário, o servidor
retira os pares antigos completos, preservando instruções do sistema, mensagem
atual e contexto escolhido. Limites de bytes/tokens continuam valendo; se a
mensagem e o contexto explícito não couberem, reduza-os e envie novamente.

## Modo ativo e parada

Modo ativo exige benefício pago elegível que conceda unidades Colab com saldo
positivo, seleção explícita e consentimento. Elegibilidade positiva foi observada;
não é garantia de saldo futuro. Gemini Pro sozinho não prova unidades. Sem essa
condição, use manual. `tatu_active()` atende até 20 respostas/20 minutos numa
célula interativa, consultando a cada três segundos. Não é agendador, serviço
compartilhado, keepalive, túnel ou promessa de GPU/gratuidade contínua.

Para parar, interrompa a célula, execute `tatu_disconnect()` e **Desconectar** no
Tatu. A chamada local remove referências, preservando o modelo; revogação efetiva
ocorre no Tatu ou na expiração. Python não garante apagar fisicamente a memória.
Encerrar a VM encerra o runtime. Não há reconexão/fallback pago ou repetição
automática de geração/completion. Se uma mensagem foi cancelada ou a lease
expirou, o servidor recusa a resposta tardia.

## Privacidade e limites

O contexto selecionado é processado em claro na VM Google: não é E2EE contra o
executor. Prompts/respostas/credenciais/configuração privada não são salvos em
outputs; o Tatu mantém seu histórico conforme as regras do aplicativo. Não use
conteúdo do futuro cofre privado. Não publique a cópia do notebook com dados da
instalação, capturas privadas ou outputs.

Sessões duram até 20 minutos; input/output são limitados a 1024/256 tokens, com
uma geração por vez. `max_time=60` é um limite suave. Confirmação demorada pode
expirar a lease de 90 segundos. Expirar bloqueia acesso imediatamente, mas
limpeza física do banco depende de acesso posterior configurado/revogação/
exclusão/retenção, não de um apagador por prazo. Configuração desativada não
promete exclusão automática. HTTP usa apenas as rotas fixas de pareamento/
claim/completion na origem explicitamente vinculada, sem proxies/redirecionamentos.

[ADR-0025](decisions/ADR-0025-personal-colab-connection.md),
[ADR-0026](decisions/ADR-0026-public-source-private-installation-configuration.md),
[FAQ do Colab](https://research.google.com/colaboratory/faq.html) e
[termos](https://research.google.com/colaboratory/tos_v6.html) definem este uso
pessoal interativo. Política/recursos podem mudar; não há endosso do Google nem
backend permanente ou acesso de terceiros à computação.
