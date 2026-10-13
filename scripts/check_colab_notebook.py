"""Opt-in static/mocked notebook checks; no ML imports or cell execution."""
import ast
import json
from pathlib import Path
from types import SimpleNamespace
import unittest

ROOT = Path(__file__).resolve().parents[1]
NOTEBOOK = json.loads((ROOT / "notebooks/qwen-colab-experiment.ipynb").read_text(encoding="utf-8"))
CODE = [ast.parse("".join(cell["source"])) for cell in NOTEBOOK["cells"] if cell["cell_type"] == "code"]
HELPERS = {
    node.name: node for tree in CODE for node in tree.body
    if isinstance(node, ast.FunctionDef) and node.name in {"require_model_cuda0", "optional_device_map"}
}
NAMESPACE = {}
exec(compile(ast.Module(body=list(HELPERS.values()), type_ignores=[]), "notebook-pure-helpers", "exec"), NAMESPACE)


def tensor(kind="cuda", index=0):
    return SimpleNamespace(device=SimpleNamespace(type=kind, index=index))


def model(parameters, buffers=(), device_map=None):
    result = SimpleNamespace(parameters=lambda: iter(parameters), buffers=lambda: iter(buffers))
    if device_map is not None:
        result.hf_device_map = device_map
    return result


class NotebookChecks(unittest.TestCase):
    def test_absent_map_cuda0_passes_and_report_is_safe(self):
        value = model([tensor()], [tensor()])
        self.assertEqual(NAMESPACE["require_model_cuda0"](value), 2)
        self.assertIsNone(NAMESPACE["optional_device_map"](value))

    def test_absent_map_cpu_rejected(self):
        with self.assertRaises(RuntimeError):
            NAMESPACE["require_model_cuda0"](model([tensor("cpu", None)]))

    def test_misleading_map_cannot_hide_parameter_or_buffer(self):
        for parameters, buffers in (([tensor("cpu", None)], []), ([tensor()], [tensor("cpu", None)])):
            with self.subTest(parameters=parameters, buffers=buffers), self.assertRaises(RuntimeError):
                NAMESPACE["require_model_cuda0"](model(parameters, buffers, {"": 0}))

    def test_meta_other_gpu_unspecified_gpu_empty_and_mixed_rejected(self):
        cases = [model([tensor("meta", None)]), model([tensor(index=1)]), model([tensor(index=None)]),
                 model([]), model([], [tensor()]), model([tensor(), tensor(index=1)])]
        for value in cases:
            with self.subTest(value=value), self.assertRaises(RuntimeError):
                NAMESPACE["require_model_cuda0"](value)

    def test_optional_map_only_reports(self):
        self.assertEqual(NAMESPACE["optional_device_map"](model([tensor()], device_map={"": 0})), {"": "0"})
        self.assertIsNone(NAMESPACE["optional_device_map"](model([tensor()], device_map="invalid")))

    def test_validation_inside_load_cleanup_and_before_inference(self):
        load = next(tree for tree in CODE if any(isinstance(n, ast.FunctionDef) and n.name == "optional_device_map" for n in tree.body))
        guarded = next(node for node in load.body if isinstance(node, ast.Try))
        checks = [i for i, node in enumerate(guarded.body) if "require_model_cuda0(model)" in ast.unparse(node)]
        evaluation = next(i for i, node in enumerate(guarded.body) if ast.unparse(node) == "model.eval()")
        self.assertEqual(len(checks), 1)
        self.assertLess(checks[0], evaluation)
        inference = next(tree for tree in CODE if "model.generate(" in ast.unparse(tree))
        self.assertLess(ast.unparse(inference).index("require_model_cuda0(model)"), ast.unparse(inference).index("model.generate("))
        self.assertFalse(any(isinstance(n, ast.Attribute) and n.attr == "hf_device_map" for tree in CODE for n in ast.walk(tree)))

    def test_structure_and_no_saved_execution(self):
        self.assertEqual((NOTEBOOK["nbformat"], NOTEBOOK["nbformat_minor"]), (4, 5))
        ids = [cell["id"] for cell in NOTEBOOK["cells"]]
        self.assertEqual(len(ids), len(set(ids)))
        for cell in NOTEBOOK["cells"]:
            if cell["cell_type"] == "code":
                self.assertIsNone(cell["execution_count"])
                self.assertEqual(cell["outputs"], [])

    def test_document_recovery_uses_identical_validation_without_reload(self):
        doc = (ROOT / "docs/COLAB-EXPERIMENT.md").read_text(encoding="utf-8")
        block = doc.split("```python\n", 1)[1].split("```", 1)[0]
        recovery = ast.parse(block)
        helper = next(node for node in recovery.body if isinstance(node, ast.FunctionDef))
        self.assertEqual(ast.dump(helper), ast.dump(HELPERS["require_model_cuda0"]))
        self.assertNotIn("from_pretrained", block)
        self.assertNotIn("pip", block)
        self.assertNotIn("generate", block)


if __name__ == "__main__":
    unittest.main()
