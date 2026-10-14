"""Stdlib transport/model fakes and optional existing-crypto WebCrypto interop.

Does not install dependencies, import ML, download weights or run Colab cells.
"""
import base64
import contextlib
import importlib.util
import io
import json
from pathlib import Path
import subprocess
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
FIXTURE_ORIGIN = "https://example-assistant.example-workspace.chatgpt.site"
FIXTURE_PROJECT = "appgprj_0123456789abcdef0123456789abcdef"
PREPARE_CALL = '_hosted_loaded()\ntatu_prepare(getpass.getpass("Origem HTTPS da sua instalacao Tatu (entrada oculta): ").strip(), getpass.getpass("ID do projeto da sua instalacao (entrada oculta): ").strip())\n'
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location("connector", ROOT / "scripts/colab_connector.py")
c = importlib.util.module_from_spec(spec)
spec.loader.exec_module(c)


class ConnectorChecks(unittest.TestCase):
    def setUp(self):
        c._tatu_state.clear()

    def test_local_preparation_no_install_or_input(self):
        with patch.object(c.platform, "system", return_value="Windows"), patch.object(c.subprocess, "run") as install, patch.object(c.getpass, "getpass") as secret, contextlib.redirect_stdout(io.StringIO()):
            c.tatu_prepare(FIXTURE_ORIGIN, FIXTURE_PROJECT)
            c.tatu_pair()
        install.assert_not_called()
        secret.assert_not_called()

    def test_fixed_origin_no_redirect(self):
        with self.assertRaises(c.TatuStop):
            c._NoRedirect().redirect_request(None, None, 302, "", {}, "https://evil.example/")
        with self.assertRaises(c.TatuStop):
            c._http("https://evil.example/", {}, "dummy")

    def test_explicit_installation_validation_and_no_unconfigured_transport(self):
        self.assertEqual(c._installation(FIXTURE_ORIGIN,FIXTURE_PROJECT), {"origin":FIXTURE_ORIGIN,"projectId":FIXTURE_PROJECT})
        for origin in (None,"", "http://example.chatgpt.site", "https://chatgpt.site", "https://example.chatgpt.site.attacker.example", "https://user@example.chatgpt.site", "https://example.chatgpt.site:443", "https://example.chatgpt.site/", "https://example.chatgpt.site?x=1", "https://example.chatgpt.site#x", "https://-bad.chatgpt.site", "https://example.other.invalid"):
            with self.subTest(origin=origin), self.assertRaises(c.TatuStop):
                c._installation(origin,FIXTURE_PROJECT)
        for project in (None,"", "other_project", "appgprj_short", "appgprj_"+"x"*101, "appgprj_../../escape", "appgprj_bad value"):
            with self.subTest(project=project), self.assertRaises(c.TatuStop):
                c._installation(FIXTURE_ORIGIN,project)
        with patch.object(c.urllib.request,"build_opener") as transport, self.assertRaises(c.TatuStop):
            c._http("claim",{},"dummy_session")
        transport.assert_not_called()

    def test_invalid_preparation_never_installs_or_prompts_secret(self):
        with patch.object(c,"_hosted_loaded"), patch.object(c.subprocess,"run") as install, patch.object(c.getpass,"getpass") as secret, contextlib.redirect_stdout(io.StringIO()):
            c.tatu_prepare("https://attacker.example",FIXTURE_PROJECT)
        install.assert_not_called()
        secret.assert_not_called()
        self.assertFalse(c._tatu_state)

    def test_transport_body_bound_and_gateway_header(self):
        c._tatu_state["serviceToken"] = "dummy_gateway"
        c._tatu_state.update(c._installation(FIXTURE_ORIGIN, FIXTURE_PROJECT))
        response = SimpleNamespace(read=lambda limit: b'{"job":null}', headers={"Content-Type": "application/json"})
        class Response:
            def __enter__(self):
                return response
            def __exit__(self, *args):
                return False
        opener = SimpleNamespace(open=lambda *args, **kwargs: Response())
        with patch.object(c.urllib.request, "build_opener", return_value=opener), patch.object(c.urllib.request, "Request", wraps=c.urllib.request.Request) as req:
            self.assertEqual(c._http("claim", {}, "dummy_session"), {"job": None})
            self.assertEqual(req.call_args.args[0], FIXTURE_ORIGIN + "/api/colab/runtime/claim")
            self.assertEqual(req.call_args.kwargs["headers"]["Authorization"], "Bearer dummy_session")
            self.assertEqual(req.call_args.kwargs["headers"]["OAI-Sites-Authorization"], "Bearer dummy_gateway")
        with self.assertRaises(c.TatuStop):
            c._http("claim", {"text": "x" * 40000}, "dummy_session")

    def test_session_expiry_before_request(self):
        with patch.object(c, "_hosted_loaded"), patch.object(c, "_http") as http:
            with self.assertRaises(c.TatuStop):
                c._claim_and_generate()
        http.assert_not_called()

    def test_live_tensor_guard_rejects_cpu_and_wrong_revision(self):
        tensor = SimpleNamespace(device=SimpleNamespace(type="cpu", index=None))
        model = SimpleNamespace(config=SimpleNamespace(model_type="qwen3", _commit_hash=c.TATU_REVISION),
                                parameters=lambda: iter([tensor]), buffers=lambda: iter([]))
        settings = {"id": c.TATU_MODEL, "revision": c.TATU_REVISION}
        with patch.object(c.platform, "system", return_value="Linux"), patch.object(c.Path, "is_dir", return_value=True), patch.dict(c.os.environ, COLAB_RELEASE_TAG="dummy"), patch.dict(c.__dict__, model=model, tokenizer=object(), settings=settings):
            with self.assertRaises(c.TatuStop):
                c._hosted_loaded()
            tensor.device.type, tensor.device.index = "cuda", 0
            c._hosted_loaded()
            model.config._commit_hash = "wrong"
            with self.assertRaises(c.TatuStop):
                c._hosted_loaded()

    def test_no_job_no_ml(self):
        c._tatu_state.update(deadline=c.time.monotonic() + 10, sessionToken="dummy")
        with patch.object(c, "_hosted_loaded"), patch.object(c, "_http", return_value={"job": None}):
            self.assertFalse(c._claim_and_generate())

    def test_manual_decline_does_not_generate_or_log_context(self):
        c._tatu_state.update(deadline=c.time.monotonic() + 10, sessionToken="dummy")
        job = {"id": "j", "leaseToken": "l", "maxInputTokens": 1024, "maxOutputTokens": 256,
               "messages": [{"role": "user", "content": "private-test-content"}]}
        output = io.StringIO()
        with patch.object(c, "_hosted_loaded"), patch.object(c, "_http", return_value={"job": job}), patch("builtins.input", return_value="NO"), contextlib.redirect_stdout(output):
            with self.assertRaises(c.TatuStop):
                c._claim_and_generate()
        self.assertNotIn("private-test-content", output.getvalue())

    def test_active_eligibility_failure_clears_secrets(self):
        c._tatu_state.update(mode="manual", serviceToken="dummy")
        with patch.object(c, "_hosted_loaded"), patch("builtins.input") as confirmation, contextlib.redirect_stdout(io.StringIO()):
            c.tatu_active()
        confirmation.assert_not_called()
        self.assertFalse(c._tatu_state)

    def test_actual_job_generation_and_completion_contract(self):
        c._tatu_state.update(deadline=c.time.monotonic() + 30, sessionToken="dummy")
        job = {"id": "j", "leaseToken": "l", "maxInputTokens": 1024, "maxOutputTokens": 256,
               "messages": [{"role": "user", "content": "private-test-content"}]}
        class Tensor:
            shape = (1, 49)
            def to(self, device):
                return self
        class Reply:
            shape = (69,)
            def detach(self):
                return self
            def cpu(self):
                return self
        class Generated:
            def __getitem__(self, key):
                return Reply()
        tokenizer = SimpleNamespace(apply_chat_template=lambda *args, **kwargs: "private", decode=lambda *args, **kwargs: "private-reply")
        class Tokenizer:
            eos_token_id = 0
            apply_chat_template = staticmethod(tokenizer.apply_chat_template)
            decode = staticmethod(tokenizer.decode)
            def __call__(self, *args, **kwargs):
                return {"input_ids": Tensor()}
        fake_model = SimpleNamespace(generate=lambda **kwargs: Generated())
        fake_torch = SimpleNamespace(inference_mode=contextlib.nullcontext)
        output = io.StringIO()
        with patch.object(c, "_hosted_loaded"), patch.object(c, "_http", side_effect=[{"job": job}, {"completed": True}]) as http, patch.dict(c.__dict__, model=fake_model, tokenizer=Tokenizer(), torch=fake_torch), patch("builtins.input", return_value="PROCESSAR"), contextlib.redirect_stdout(output):
            self.assertTrue(c._claim_and_generate())
            payload = http.call_args_list[1].args[1]
        self.assertEqual(payload, {"jobId": "j", "leaseToken": "l", "reply": "private-reply", "inputTokens": 49, "outputTokens": 69})
        self.assertNotIn("private-reply", output.getvalue())
        self.assertNotIn("private-test-content", output.getvalue())

    def test_notebook_embedded_connector_exact_and_outputs_empty(self):
        notebook = json.loads((ROOT / "notebooks/qwen-colab-experiment.ipynb").read_text(encoding="utf-8"))
        source = (ROOT / "scripts/colab_connector.py").read_text(encoding="utf-8")
        cells = [cell for cell in notebook["cells"] if cell["cell_type"] == "code"]
        self.assertTrue(any("".join(cell["source"]) == source + "\n" + PREPARE_CALL for cell in cells))
        for cell in cells:
            self.assertEqual(cell["outputs"], [])
            self.assertIsNone(cell["execution_count"])

    def test_real_webcrypto_python_interop_and_tamper_rejection(self):
        try:
            from cryptography.hazmat.primitives.asymmetric import rsa
            from cryptography.hazmat.primitives import serialization
        except ImportError:
            self.skipTest("Existing local cryptography absent; no dependency installed.")
        with patch.object(c, "_hosted_loaded"), patch.object(c.importlib.metadata, "version", return_value="42.0.2"), patch.object(c.subprocess, "run") as install, contextlib.redirect_stdout(io.StringIO()):
            c.tatu_prepare(FIXTURE_ORIGIN, FIXTURE_PROJECT)
            self.assertIn("private", c._tatu_state)
        install.assert_not_called()
        c._tatu_state.clear()
        private = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        spki = private.public_key().public_bytes(serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo)
        fingerprint = c.hashlib.sha256(spki).hexdigest()
        c._tatu_state.update(private=private, fingerprint=fingerprint, **c._installation(FIXTURE_ORIGIN, FIXTURE_PROJECT))
        javascript = """
const fs = require('fs');
(async () => {
 const p = JSON.parse(fs.readFileSync(0, 'utf8'));
 const pub = await crypto.subtle.importKey('spki', Buffer.from(p.spki,'base64'), {name:'RSA-OAEP',hash:'SHA-256'},false,['encrypt']);
 const raw = crypto.getRandomValues(new Uint8Array(32));
 const nonce = crypto.getRandomValues(new Uint8Array(12));
 const key = await crypto.subtle.importKey('raw',raw,'AES-GCM',false,['encrypt']);
 const aad = new TextEncoder().encode(JSON.stringify(['tatu-colab-bootstrap',1,p.projectId,p.origin,p.fingerprint]));
 const value = {...p.value,origin:p.origin,projectId:p.projectId};
 const ciphertext = await crypto.subtle.encrypt({name:'AES-GCM',iv:nonce,additionalData:aad,tagLength:128},key,new TextEncoder().encode(JSON.stringify(value)));
 const wrappedKey = await crypto.subtle.encrypt({name:'RSA-OAEP'},pub,raw);
 console.log(JSON.stringify({version:1,algorithm:'RSA-OAEP-256+A256GCM',origin:p.origin,projectId:p.projectId,fingerprint:p.fingerprint,nonce:Buffer.from(nonce).toString('base64'),ciphertext:Buffer.from(ciphertext).toString('base64'),wrappedKey:Buffer.from(wrappedKey).toString('base64')}));
})();
"""
        payload = {"spki": base64.b64encode(spki).decode(), "origin": FIXTURE_ORIGIN, "projectId": FIXTURE_PROJECT, "fingerprint": fingerprint,
                   "value": {"model": c.TATU_MODEL, "revision": c.TATU_REVISION, "mode": "manual", "pairToken": "dummy_pair", "serviceToken": "dummy_gateway"}}
        result = subprocess.run(["node", "-e", javascript], input=json.dumps(payload), text=True, capture_output=True, check=True)
        envelope = json.loads(result.stdout)
        self.assertEqual(c._decrypt(envelope)["pairToken"], "dummy_pair")
        for field, replacement in (("origin", "https://other-assistant.other-workspace.chatgpt.site"), ("projectId", "appgprj_fedcba9876543210fedcba9876543210"), ("fingerprint", "0" * 64), ("ciphertext", base64.b64encode(b"x" * 50).decode())):
            with self.subTest(field=field), self.assertRaises(Exception):
                c._decrypt({**envelope, field: replacement})
        c._tatu_state["private"] = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        with self.assertRaises(Exception):
            c._decrypt(envelope)


if __name__ == "__main__":
    unittest.main()
