import torch
from torch.utils._python_dispatch import TorchDispatchMode
from torch.utils._pytree import tree_leaves


class TensorPeak(TorchDispatchMode):
    """Count the largest eager ATen result, including views and hidden matmul temporaries."""
    def __init__(self):
        self.elements = 0

    def __torch_dispatch__(self, func, types, args=(), kwargs=None):
        result = func(*args, **(kwargs or {}))
        for item in tree_leaves(result):
            if isinstance(item, torch.Tensor):
                self.elements = max(self.elements, item.numel())
        return result


def observe(module, step, c):
    torch.set_num_threads(1)
    fn = getattr(module, step)
    t = lambda name: torch.tensor(c[name], dtype=torch.float32)
    if step == "cached_forward":
        result = fn(t("x"), t("w1"), t("w2"))
        if result is None:
            return None
        y, cache = result
        return {"y": y, "x": cache["x"], "hidden": cache["hidden"], "bytes": module.cache_bytes(cache)}
    if step == "cache_bytes":
        cache = {"x": torch.zeros(2, 5, 3, dtype=torch.float64), "hidden": torch.ones(2, 5, 7, dtype=torch.bfloat16)}
        return fn(cache)
    if step == "train_ledger":
        layer = torch.nn.Linear(c["width"], c["out"], bias=True)
        opt = torch.optim.AdamW(layer.parameters())
        layer(torch.ones(2, c["width"])).sum().backward()
        opt.step()
        state = opt.state_dict()["state"]
        size = lambda v: v.numel() * v.element_size()
        actual = [sum(size(v) for v in layer.state_dict().values()), sum(size(p.grad) for p in layer.parameters()),
                  sum(size(s[k]) for s in state.values() for k in ("exp_avg","exp_avg_sq")),
                  sum(size(s["step"]) for s in state.values())]
        return {"ledger": fn(layer, opt), "state_dict": actual}
    if step in ("fp16_underflow_grad", "loss_scaled_step", "dynamic_scaler_update"):
        return [fn(*(float("nan") if item == "nan" else item for item in args)) for args in c["args"]]
    if step in ("online_softmax_update", "online_attention_step"):
        results = []
        for case in c["blocks"]:
            m = float("-inf") if case["m"] is None else case["m"]
            args = [m, case["l"]]
            scores = torch.tensor(case["scores"])
            if step == "online_attention_step":
                args.extend((torch.tensor(case["o"]), scores, torch.tensor(case["v"])))
            else:
                args.append(scores)
            results.append(fn(*args))
        return results
    peak = TensorPeak()
    q, k, v = t("q"), t("k"), t("v")
    with peak:
        out = fn(q, k, v, c["tile"])
    return {"output": out, "peak": peak.elements}
