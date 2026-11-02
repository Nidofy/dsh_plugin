import sys, json, contextlib, importlib.util


def training(module, mode, data):
    import torch

    torch.set_num_threads(1)
    model = torch.nn.Sequential(
        torch.nn.Linear(2, 4), torch.nn.Tanh(), torch.nn.Linear(4, 1)
    ).double()
    params = list(model.parameters())
    with torch.no_grad():
        for p, values in zip(params, data["state"]):
            p.copy_(torch.tensor(values, dtype=torch.float64))

    def state():
        return [p.detach().tolist() for p in params]

    def batch(values):
        return tuple(torch.tensor(v, dtype=torch.float64) for v in values)

    if mode == "validate":
        observed = []
        model.register_forward_pre_hook(
            lambda m, args: observed.append(
                not m.training and not torch.is_grad_enabled()
            )
        )
        loss = module.validate(model, batch(data["batch"]))
        return {
            "loss": float(loss),
            "state": state(),
            "eval_only": bool(observed) and all(observed),
        }
    optimizer = torch.optim.SGD(params, lr=data["lr"])
    trace = []
    for values in data["batches"]:
        loss = module.train_step(model, optimizer, batch(values))
        trace.append(
            {
                "loss": float(loss),
                "state": state(),
                "grad": [
                    p.grad.tolist() if p.grad is not None else None for p in params
                ],
            }
        )
    return trace


def character(module, mode, data):
    import torch
    import torch.nn.functional as F

    torch.set_num_threads(1)
    p = torch.nn.ParameterDict(
        {
            k: torch.nn.Parameter(torch.tensor(v, dtype=torch.float64))
            for k, v in data["state"].items()
        }
    )

    def predict(ids):
        return module.logits(module.embed(ids, p), p)

    if mode == "char_probe":
        w = torch.tensor(data["window"])
        x = torch.tensor(data["features"], dtype=torch.float64)
        probes = {
            "shifted": lambda: torch.stack(module.shifted(w)),
            "embed": lambda: module.embed(w[:, :-1], p),
            "attention": lambda: module.attention(F.layer_norm(x, (4,)), p),
            "block": lambda: module.block(x, p),
            "logits": lambda: module.logits(x, p),
        }
        results = {}
        for name, fn in probes.items():
            try:
                results[name] = {"value": fn().detach().tolist()}
            except Exception as e:
                results[name] = {"error": str(e)[:500]}
        return results
    if mode == "char_sample":
        tokens = [0]
        with torch.no_grad():
            for u in data["uniforms"]:
                scores = predict(torch.tensor([tokens[-4:]]))[0, -1]
                tokens.append(min(4, int((scores.softmax(-1).cumsum(0) < u).sum())))
        return tokens
    trace = []
    optimizer = torch.optim.SGD(p.values(), lr=data["lr"])
    for window in data["windows"]:
        optimizer.zero_grad()
        inputs, targets = module.shifted(torch.tensor(window))
        x = module.embed(inputs, p)
        if x.requires_grad:
            x.retain_grad()
        scores = module.logits(x, p)
        loss = F.cross_entropy(scores.flatten(0, 1), targets.reshape(-1))
        loss.backward()
        row = {
            "inputs": inputs.tolist(),
            "targets": targets.tolist(),
            "x": x.detach().tolist(),
            "logits": scores.detach().tolist(),
            "loss": loss.item(),
            "dx": None if x.grad is None else x.grad.tolist(),
            "grad": {
                k: None if v.grad is None else v.grad.tolist() for k, v in p.items()
            },
        }
        if not trace:
            with torch.no_grad():
                changed = inputs.clone()
                changed[:, -1] = (changed[:, -1] + 1) % 5
                row["prefix"] = predict(changed)[:, :-1].tolist()
                changed = inputs.clone()
                changed[1] = (changed[1] + 2) % 5
                row["firstBatch"] = predict(changed)[:1].tolist()
        optimizer.step()
        row["state"] = {k: v.detach().tolist() for k, v in p.items()}
        trace.append(row)
    return trace


args = json.load(sys.stdin)
with contextlib.redirect_stdout(sys.stderr):
    spec = importlib.util.spec_from_file_location("submission", sys.argv[2])
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    if sys.argv[1] in ("char_train", "char_sample", "char_probe"):
        result = character(module, sys.argv[1], args)
    elif sys.argv[1] in ("train", "validate"):
        result = training(module, sys.argv[1], args)
    else:
        result = (
            module.configure() if sys.argv[1] == "configure" else module.solve(*args)
        )


def default(x):
    if hasattr(x, "detach"):
        return x.detach().cpu().tolist()
    if hasattr(x, "tolist"):
        return x.tolist()
    raise TypeError(type(x).__name__)


print(json.dumps(result, default=default, allow_nan=False))
