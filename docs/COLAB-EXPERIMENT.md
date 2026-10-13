# Experimento manual de Qwen no Colab

O [notebook](../notebooks/qwen-colab-experiment.ipynb) permite experimentar uma
resposta curta em português usando uma GPU do **Colab hospedado**. O padrão é
`Qwen/Qwen3-8B` em NF4, com pensamento desativado, até 256 tokens de entrada e
128 de saída. O ramo `Qwen/Qwen3.8-27B` é opcional e fica desativado até o usuário
confirmá-lo explicitamente.

**Estado: o usuário relatou instalação concluída e carregamento 399/399 em uma
T4, com Python 3.13.15 e PyTorch 2.11+cu130.** A célula antiga falhou ao imprimir
`hf_device_map`; a colocação real dos tensores e a inferência ainda não foram
verificadas. O artefato corrigido foi verificado estaticamente, sem execução de
GPU pelo agente. Isto não ativa um provedor nem altera a implantação do Tatu.

## Recuperar o modelo já carregado

Na cópia antiga ainda aberta, adicione uma célula com **+ Código** e cole o
bloco abaixo. Ele usa os objetos existentes; não reinstala nem recarrega pesos.
Não execute novamente a célula de carregamento. Se o runtime foi desconectado
ou os objetos foram liberados, esta recuperação não pode restaurá-los.

```python
def require_model_cuda0(model):
    parameters = 0
    tensors = 0
    for kind, values in (("parameter", model.parameters()), ("buffer", model.buffers())):
        for tensor in values:
            device = tensor.device
            if device.type != "cuda" or device.index != 0:
                raise RuntimeError("Offload recusado: todos os tensores devem estar em cuda:0.")
            if kind == "parameter":
                parameters += 1
            tensors += 1
    if parameters == 0:
        raise RuntimeError("Modelo vazio: nenhum parametro encontrado.")
    return tensors

require_hosted_colab()
if globals().get("model") is None or globals().get("tokenizer") is None:
    raise RuntimeError("Modelo/tokenizer ausentes; esta recuperacao exige o runtime original.")
tensor_count = require_model_cuda0(model)
model.eval()
print({
    "tensors_cuda0": tensor_count,
    "model_footprint_gib": round(model.get_memory_footprint() / (1024 ** 3), 2),
    "free_vram_gib": round(torch.cuda.mem_get_info(0)[0] / (1024 ** 3), 2),
})
print("Validacao aprovada. Execute apenas a celula da pergunta publica.")
```

Somente se a célula terminar sem erro, execute a célula existente sob
**“Uma pergunta pública, curta e sem ferramentas”**. Não libere os recursos
antes dessa pergunta. Se a validação recusar CPU, `meta`, outra GPU ou modelo
vazio, interrompa e use a célula final de liberação; não force offload.

O atributo `hf_device_map` é opcional em carregamentos com uma única GPU.
A versão corrigida verifica todos os parâmetros e buffers reais antes de
`eval()` e novamente antes da inferência, exigindo ao menos um parâmetro.
O mapa, quando presente, serve apenas para exibição e não autoriza execução.

## Como usar

1. Abra [Google Colab](https://colab.research.google.com/) e use **Arquivo →
   Fazer upload de notebook** para abrir `qwen-colab-experiment.ipynb` em uma
   cópia privada. Não conecte um runtime local.
2. Em **Ambiente de execução → Alterar tipo de ambiente de execução**, selecione
   uma GPU disponibilizada pela sua conta. Mantenha a opção `8B` inicialmente.
3. Execute as células em ordem. A primeira verificação informa GPU, VRAM livre,
   RAM disponível e disco. Se ela recusar o ambiente, interrompa; nenhum peso
   foi baixado por essa etapa.
4. Instale os pacotes somente pela célula do notebook. Ela preserva o PyTorch
   fornecido pelo Colab e usa versões diretas fixadas do PyPI oficial.
5. Carregue o modelo, execute o prompt público e observe a resposta, duração,
   tokens e memória efetivamente medidos. Nenhum resultado de exemplo é
   apresentado como uma execução real.
6. Execute a célula final de liberação. Depois use **Ambiente de execução →
   Desconectar e excluir ambiente de execução**. Limpe as saídas antes de
   compartilhar o notebook.

Os pesos e pacotes ficam na VM do Colab após essas ações do usuário. Não execute
instalações ou downloads de modelos no terminal do repositório.

## Limites do experimento

| Opção                              | VRAM **livre na GPU 0** | RAM livre | Disco livre |
| ---------------------------------- | ----------------------- | --------- | ----------- |
| Qwen3-8B                           | 10 GiB                  | 8 GiB     | 24 GiB      |
| Qwen3.8-27B, autorização explícita | 24 GiB                  | 20 GiB    | 80 GiB      |

São limites conservadores escolhidos para este notebook, **não mínimos oficiais
nem garantia de funcionamento**. “24 GB” anunciados por uma placa não equivalem
a 24 GiB livres. Uma T4 comum não passa o ramo 27B. Uma GPU maior também pode
falhar por kernels, embeddings, estados, cache ou fragmentação.

O tamanho ideal de 27 bilhões de parâmetros a quatro bits é aproximadamente
13,5 GB decimais; isso não inclui metadados, tensores mantidos em outra precisão,
visão, cache ou execução. O carregamento quantiza os arquivos originais: os
repositórios consultados contêm aproximadamente 16,4 GB para 8B e 55,6 GB para
27B. Os limiares de disco consideram esse download, não apenas o modelo carregado.
[Arquivos 8B](https://huggingface.co/Qwen/Qwen3-8B/tree/b968826d9c46dd6066d109eabc6255188de91218),
[arquivos 27B](https://huggingface.co/Qwen/Qwen3.8-27B/tree/1d4bf0f2ff6012fd82039f2fa52739d0dd7c60c0).

O mapa de dispositivos é explícito para a GPU 0. Não há offload para CPU/disco,
fallback automático, treinamento, imagens, áudio, histórico privado ou
ferramentas externas. No 27B, os kernels opcionais não são instalados; a
implementação PyTorch pode ser mais lenta e usar mais memória. O limite de
geração de 60 segundos é suave: uma operação em andamento pode ultrapassá-lo.

## Fontes e versões fixadas

Fontes primárias consultadas em **13 de outubro de 2026**:

| Componente                                                                                             | Versão/revisão                             |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------ |
| [Qwen3-8B](https://huggingface.co/Qwen/Qwen3-8B/commit/b968826d9c46dd6066d109eabc6255188de91218)       | `b968826d9c46dd6066d109eabc6255188de91218` |
| [Qwen3.8-27B](https://huggingface.co/Qwen/Qwen3.8-27B/commit/1d4bf0f2ff6012fd82039f2fa52739d0dd7c60c0) | `1d4bf0f2ff6012fd82039f2fa52739d0dd7c60c0` |
| [Transformers](https://pypi.org/project/transformers/5.19.0/)                                          | `5.19.0`                                   |
| [Accelerate](https://pypi.org/project/accelerate/1.15.0/)                                              | `1.15.0`                                   |
| [bitsandbytes](https://pypi.org/project/bitsandbytes/0.50.0/)                                          | `0.50.0`                                   |

O PyTorch do runtime precisa ser pelo menos 2.5; sua versão exata é registrada e
mantida por constraints durante a instalação. CUDA, imagem do Colab e
dependências transitivas podem variar. Não há garantia de ambiente idêntico ou
de compatibilidade sem uma execução real.

O 8B usa `AutoModelForCausalLM`. O
[config oficial do 27B](https://huggingface.co/Qwen/Qwen3.8-27B/blob/1d4bf0f2ff6012fd82039f2fa52739d0dd7c60c0/config.json)
declara `Qwen3_5ForConditionalGeneration`; a classe nativa é documentada em
[Transformers 5.19.0](https://huggingface.co/docs/transformers/v5.19.0/model_doc/qwen3_5).
Os dois carregamentos usam `trust_remote_code=False`, Safetensors e `token=False`.
As opções NF4 e os requisitos CUDA vêm da
[documentação de quantização](https://huggingface.co/docs/transformers/v5.19.0/quantization/bitsandbytes).
Os pesos têm licença Apache-2.0, independentemente da licença MIT do Tatu.

## Colab e privacidade

O Colab prioriza uso interativo; GPU, cota e duração variam. No gratuito, a
sessão pode durar até 12 horas conforme disponibilidade e uso. A
[FAQ oficial](https://research.google.com/colaboratory/faq.html) restringe usos
como serviços externos não relacionados à computação interativa e, no gratuito,
controle remoto ou interação principalmente por outra interface web. Este
notebook não abre servidor, túnel, API, acesso de terceiros ou keepalive.
Ele não é um backend gratuito permanente para o Tatu.

O prompt é processado na infraestrutura do Colab/Google. As saídas podem ser
salvas na cópia do notebook; isto não é E2EE. Use somente o exemplo público e
não adicione senhas, tokens, notas, memórias ou conversas privadas. Não há
montagem do Drive nem pedido de credenciais. A célula de liberação limpa
referências/cache CUDA; excluir a VM pelo menu encerra o ambiente e seu disco
efêmero.

## Verificação deste artefato

A validação local lê apenas o JSON do notebook e analisa a sintaxe Python das
células; não executa imports, instalação, download ou inferência. As células
estão sem saídas e com `execution_count: null` para não inventar evidência.
O próximo resultado verificável é uma execução manual no Colab com hardware,
versões, saída e memória registrados pelo próprio notebook.

Para repetir as verificações estáticas e regressões com objetos simulados,
execute opcionalmente `python scripts/check_colab_notebook.py`. O script usa
somente a biblioteca padrão, extrai apenas os dois helpers puros via AST e
não executa as células, imports de ML, downloads ou inferência. Python não é
um requisito da instalação do produto Tatu.
