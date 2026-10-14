"""Personal notebook companion. Run only in the already-loaded hosted Colab VM.

No listener, model download, local installation or background thread is created.
Definitions are import-safe for stdlib tests; call tatu_prepare(origin, project_id) explicitly.
"""
import base64
import datetime
import getpass
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import platform
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request

TATU_MODEL = "Qwen/Qwen3-8B"
TATU_REVISION = "b968826d9c46dd6066d109eabc6255188de91218"
_tatu_state = {}


class TatuStop(Exception):
    """Only fixed messages are displayed; external exceptions are never echoed."""


def _installation(origin, project_id):
    """Validate explicit owner configuration, never an envelope-selected destination."""
    label = r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?"
    if (not isinstance(origin, str) or len(origin) > 253
            or not re.fullmatch(r"https://" + label + r"(?:\." + label + r")?\.chatgpt\.site", origin)
            or not isinstance(project_id, str)
            or not re.fullmatch(r"appgprj_[a-zA-Z0-9_]{8,100}", project_id)):
        raise TatuStop("Origem HTTPS ou projeto da instalacao invalidos.")
    return {"origin": origin, "projectId": project_id}


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise TatuStop("Redirecionamento recusado; conexao interrompida.")


def _hosted_loaded():
    if platform.system() != "Linux" or not Path("/content").is_dir() or not os.environ.get("COLAB_RELEASE_TAG"):
        raise TatuStop("Execute apenas na VM hospedada do Colab.")
    if globals().get("model") is None or globals().get("tokenizer") is None:
        raise TatuStop("Use o runtime com Qwen8B ja carregado; nenhum modelo sera baixado.")
    if globals().get("settings", {}).get("id") != TATU_MODEL or globals().get("settings", {}).get("revision") != TATU_REVISION:
        raise TatuStop("Modelo/revisao diferentes do Qwen8B autorizado.")
    configuration = getattr(model, "config", None)
    if getattr(configuration, "model_type", None) != "qwen3":
        raise TatuStop("Configuracao diferente do Qwen3 autorizado.")
    if getattr(configuration, "_commit_hash", None) not in (None, TATU_REVISION):
        raise TatuStop("Revisao da configuracao diferente da autorizada.")
    parameters = 0
    for kind, values in (("parameter", model.parameters()), ("buffer", model.buffers())):
        for tensor in values:
            if tensor.device.type != "cuda" or tensor.device.index != 0:
                raise TatuStop("Todos os tensores devem estar na GPU cuda:0.")
            parameters += kind == "parameter"
    if not parameters:
        raise TatuStop("Modelo vazio.")


def _http(action, payload, credential):
    if action not in {"pair", "claim", "complete"}:
        raise TatuStop("Operacao recusada.")
    installation = _installation(_tatu_state.get("origin"), _tatu_state.get("projectId"))
    body = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    if len(body) > 32768:
        raise TatuStop("Requisicao grande demais.")
    service = _tatu_state.get("serviceToken", "")
    if not service or not credential or any(c.isspace() for c in service + credential):
        raise TatuStop("Credencial invalida.")
    request = urllib.request.Request(
        installation["origin"] + "/api/colab/runtime/" + action, data=body, method="POST",
        headers={"Content-Type": "application/json", "OAI-Sites-Authorization": "Bearer " + service,
                 **({"Authorization": "Bearer " + credential} if action != "pair" else {})},
    )
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), _NoRedirect())
    try:
        with opener.open(request, timeout=15) as response:
            raw = response.read(65537)
            if len(raw) > 65536 or "application/json" not in response.headers.get("Content-Type", ""):
                raise TatuStop("Resposta invalida.")
            value = json.loads(raw.decode("utf-8"))
            if not isinstance(value, dict):
                raise TatuStop("Resposta invalida.")
            return value
    except urllib.error.HTTPError as error:
        if error.code in (401, 403):
            raise TatuStop("Conexao expirada ou revogada; pare e conecte novamente.") from None
        raise TatuStop("Tatu recusou a operacao; nenhum resultado foi confirmado.") from None
    except (urllib.error.URLError, UnicodeError, ValueError, TimeoutError, OSError):
        raise TatuStop("Falha de conexao; nenhum resultado foi confirmado.") from None


def tatu_prepare(origin, project_id):
    """Print public key only. No secret prompt or installation before VM guard."""
    try:
        _hosted_loaded()
        installation = _installation(origin, project_id)
        if _tatu_state:
            raise TatuStop("Desconecte antes de criar outra chave.")
        try:
            installed = importlib.metadata.version("cryptography")
        except importlib.metadata.PackageNotFoundError:
            installed = None
        if installed is None:
            subprocess.run([sys.executable, "-m", "pip", "install", "--quiet", "--only-binary=:all:",
                            "--index-url", "https://pypi.org/simple", "cryptography==50.0.2"],
                           check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        elif tuple(int(part) for part in installed.split(".")[:3]) < (42, 0, 2):
            raise TatuStop("Cryptography instalado incompativel; nenhuma atualizacao automatica.")
        from cryptography.hazmat.primitives.asymmetric import rsa
        from cryptography.hazmat.primitives import serialization
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM
        from cryptography.hazmat.primitives.asymmetric import padding
        from cryptography.hazmat.primitives import hashes
        if not all((AESGCM, padding.OAEP, hashes.SHA256)):
            raise TatuStop("Primitivas criptograficas indisponiveis.")
        private = rsa.generate_private_key(public_exponent=65537, key_size=3072)
        public = private.public_key().public_bytes(serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo)
        spki = private.public_key().public_bytes(serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo)
        _tatu_state.update(private=private, fingerprint=hashlib.sha256(spki).hexdigest(), **installation)
        print(public.decode("ascii"))
        print("Cole SOMENTE esta chave publica em Configuracao > Meu Qwen no Google Colab no Tatu.")
    except (Exception, KeyboardInterrupt):
        _tatu_state.clear()
        print("Preparacao interrompida. Confira VM hospedada, Qwen8B carregado, GPU e configuracao da instalacao.")


def _decrypt(envelope):
    installation = _installation(_tatu_state.get("origin"), _tatu_state.get("projectId"))
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.primitives.asymmetric import padding
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    if not isinstance(envelope, dict) or envelope.get("version") != 1 or envelope.get("algorithm") != "RSA-OAEP-256+A256GCM":
        raise TatuStop("Envelope invalido.")
    if envelope.get("origin") != installation["origin"] or envelope.get("projectId") != installation["projectId"] or envelope.get("fingerprint") != _tatu_state.get("fingerprint"):
        raise TatuStop("Envelope nao pertence a esta chave/instalacao.")
    aad = json.dumps(["tatu-colab-bootstrap", 1, installation["projectId"], installation["origin"], _tatu_state["fingerprint"]], separators=(",", ":")).encode()
    wrapped = base64.b64decode(envelope["wrappedKey"], validate=True)
    nonce = base64.b64decode(envelope["nonce"], validate=True)
    ciphertext = base64.b64decode(envelope["ciphertext"], validate=True)
    if len(nonce) != 12 or len(ciphertext) > 16384:
        raise TatuStop("Envelope invalido.")
    key = _tatu_state["private"].decrypt(wrapped, padding.OAEP(mgf=padding.MGF1(hashes.SHA256()), algorithm=hashes.SHA256(), label=None))
    value = json.loads(AESGCM(key).decrypt(nonce, ciphertext, aad))
    if not isinstance(value, dict) or value.get("origin") != installation["origin"] or value.get("projectId") != installation["projectId"] or value.get("model") != TATU_MODEL or value.get("revision") != TATU_REVISION or value.get("mode") not in ("manual", "active"):
        raise TatuStop("Bootstrap invalido.")
    return value


def tatu_pair():
    try:
        _hosted_loaded()
        if "private" not in _tatu_state or "sessionToken" in _tatu_state:
            raise TatuStop("Prepare uma chave publica primeiro.")
        raw = getpass.getpass("Cole o envelope CRIPTOGRAFADO do Tatu (entrada oculta): ")
        if len(raw.encode("utf-8")) > 24576:
            raise TatuStop("Envelope grande demais.")
        value = _decrypt(json.loads(raw))
        _tatu_state["serviceToken"] = value["serviceToken"]
        response = _http("pair", {"pairToken": value["pairToken"]}, value["pairToken"])
        token = response.get("sessionToken")
        if not isinstance(token, str) or not token.startswith("colab_") or len(token) > 256:
            raise TatuStop("Sessao invalida.")
        expiration = datetime.datetime.fromisoformat(response["expiresAt"].replace("Z", "+00:00"))
        remaining = (expiration - datetime.datetime.now(datetime.timezone.utc)).total_seconds()
        if not 0 < remaining <= 1200 or response.get("model") != TATU_MODEL or response.get("revision") != TATU_REVISION or response.get("mode") != value["mode"]:
            raise TatuStop("Sessao invalida.")
        _tatu_state.update(sessionToken=token, deadline=time.monotonic() + remaining, mode=value["mode"])
        _tatu_state.pop("private", None)
        print("Conectado por ate 20 minutos. Envie uma mensagem com Colab no Tatu e execute tatu_once().")
    except (Exception, KeyboardInterrupt):
        _tatu_state.clear()
        print("Pareamento interrompido. Crie nova chave e envelope; nao cole segredos em codigo ou chat.")


def _claim_and_generate(review=True):
    _hosted_loaded()
    if time.monotonic() >= _tatu_state.get("deadline", 0):
        raise TatuStop("Sessao encerrada.")
    response = _http("claim", {}, _tatu_state.get("sessionToken", ""))
    job = response.get("job")
    if job is None:
        return False
    if not isinstance(job, dict):
        raise TatuStop("Trabalho invalido.")
    messages = job.get("messages")
    if not isinstance(messages, list) or not 1 <= len(messages) <= 12:
        raise TatuStop("Contexto invalido.")
    for message in messages:
        if not isinstance(message, dict) or set(message) != {"role", "content"} or message["role"] not in ("system", "user", "assistant") or not isinstance(message["content"], str) or len(message["content"].encode()) > 8192:
            raise TatuStop("Contexto invalido.")
    if job.get("maxInputTokens") != 1024 or job.get("maxOutputTokens") != 256:
        raise TatuStop("Limites do trabalho invalidos.")
    for field in ("id", "leaseToken"):
        if not isinstance(job.get(field), str) or not 1 <= len(job[field]) <= 256:
            raise TatuStop("Identificador invalido.")
    if review:
        print("Uma mensagem pendente. Revise o texto e contexto selecionado no chat Tatu.")
        if input("Digite PROCESSAR para autorizar esta unica resposta na VM Google: ").strip() != "PROCESSAR":
            raise TatuStop("Processamento cancelado; cancele a mensagem no Tatu.")
    text = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True, enable_thinking=False)
    inputs = tokenizer(text, return_tensors="pt", add_special_tokens=False)
    input_tokens = int(inputs["input_ids"].shape[-1])
    if input_tokens > 1024:
        _http("complete", {"jobId": job["id"], "leaseToken": job["leaseToken"], "error": "input_too_large"}, _tatu_state["sessionToken"])
        raise TatuStop("Contexto excede 1024 tokens; reduza no Tatu.")
    inputs = {key: value.to("cuda:0") for key, value in inputs.items()}
    _hosted_loaded()
    if time.monotonic() >= _tatu_state["deadline"]:
        raise TatuStop("Sessao encerrada antes de gerar.")
    try:
        with torch.inference_mode():
            generated = model.generate(**inputs, max_new_tokens=256, max_time=60, do_sample=False, pad_token_id=tokenizer.eos_token_id)
    except Exception:
        _http("complete", {"jobId": job["id"], "leaseToken": job["leaseToken"], "error": "generation_failed"}, _tatu_state["sessionToken"])
        raise TatuStop("Geracao falhou.") from None
    reply_ids = generated[0, input_tokens:].detach().cpu()
    reply = tokenizer.decode(reply_ids, skip_special_tokens=True)
    if not reply.strip() or len(reply.encode("utf-8")) > 4096:
        raise TatuStop("Resposta invalida.")
    if time.monotonic() >= _tatu_state["deadline"]:
        raise TatuStop("Sessao encerrada antes de enviar; resultado descartado.")
    result = _http("complete", {"jobId": job["id"], "leaseToken": job["leaseToken"], "reply": reply,
                               "inputTokens": input_tokens, "outputTokens": int(reply_ids.shape[-1])}, _tatu_state["sessionToken"])
    if result.get("completed") is not True:
        raise TatuStop("Resultado nao confirmado.")
    print("Resposta entregue ao seu chat Tatu.")
    return True


def tatu_once():
    try:
        if not _claim_and_generate():
            print("Nenhuma mensagem pendente. Envie pelo chat Tatu e execute esta celula novamente.")
    except (Exception, KeyboardInterrupt):
        tatu_disconnect()
        print("Processamento interrompido. Confira o estado no Tatu; nenhum sucesso e presumido.")


def tatu_active():
    """Explicit foreground cell only: no notebook keepalive or background thread."""
    try:
        _hosted_loaded()
        if _tatu_state.get("mode") != "active":
            raise TatuStop("Pareamento manual: modo ativo indisponivel.")
        if input("Confirme plano Colab pago E saldo POSITIVO de unidades: digite COLAB PAGO COM SALDO: ") != "COLAB PAGO COM SALDO":
            raise TatuStop("Elegibilidade nao confirmada.")
        if input("Autoriza processar nesta VM Google SOMENTE mensagens enviadas explicitamente ao Colab no Tatu pelos proximos 20 minutos? Digite AUTORIZO: ") != "AUTORIZO":
            raise TatuStop("Consentimento nao confirmado.")
        count = 0
        while count < 20 and time.monotonic() < _tatu_state.get("deadline", 0):
            count += bool(_claim_and_generate(review=False))
            time.sleep(3)
    except KeyboardInterrupt:
        print("Modo ativo interrompido pelo usuario.")
    except Exception:
        print("Modo ativo interrompido; confira a conexao no Tatu.")
    finally:
        tatu_disconnect()


def tatu_disconnect():
    _tatu_state.clear()
    print("Segredos da conexao removidos das referencias locais; Qwen permanece carregado. Revogue tambem no Tatu.")
