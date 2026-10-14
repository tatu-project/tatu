# Conectar seu Qwen no Colab ao Tatu

O adaptador pessoal está implantado na versão privada 2. Pareamento real,
primeira resposta no Tatu e modo ativo ainda precisam de comprovação. O exemplo
manual anterior não prova essa integração. Este guia não publica endereço/ID
privado: obtenha-os do responsável pela sua própria instalação.

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
2. Copie somente a chave efêmera **PUBLIC KEY**. No Tatu, vá a **Configuração →
   Meu Qwen no Google Colab**, cole a chave, autorize o contexto na VM Google e
   escolha manual ou ativo. Clique **Conectar meu Colab** e copie o código
   criptografado. Execute `tatu_pair()` e cole no campo oculto em até dois minutos.
   Nunca cole chave de API/senha/segredo em código, chat ou outputs.
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

O operador também pode fornecer uma célula privada de preparação/pareamento/
execução. Esse handoff não pertence ao repositório público e não comprova uma
conexão bem-sucedida; a resposta real ainda precisa aparecer no Tatu.

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
