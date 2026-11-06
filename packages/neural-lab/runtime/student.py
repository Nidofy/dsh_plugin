import sys, json, contextlib, importlib.util


def training(module, mode, data):
    import torch

    torch.set_num_threads(1)
    model = torch.nn.Sequential(
        torch.nn.Linear(2, 4), torch.nn.Tanh(), torch.nn.Linear(4, len(data["state"][3]))
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

    p.heads = data.get("heads", 2)
    p.layers = data.get("layers", 1)

    # Observe the submitted component calls; no trusted model runs in this process.
    observed = {}
    current_layer = [0]
    if data.get("diagnostics060"):
        import functools
        def instrument(name, original):
            @functools.wraps(original)
            def wrapped(*args, **kwargs):
                previous = current_layer[0]
                if name == "block":
                    current_layer[0] = getattr(args[1], "layer", 0)
                layer = current_layer[0]
                try:
                    value = original(*args, **kwargs)
                    key = name + ":" + str(layer)
                    entry = observed.setdefault(key, {"component": name, "layer": layer, "calls": 0})
                    entry["calls"] += 1
                    tensor = value[0] if isinstance(value, tuple) else value
                    if isinstance(tensor, torch.Tensor):
                        entry["shape"] = list(tensor.shape)
                        if name == "head_weights":
                            entry["weights"] = tensor.detach().tolist()
                        if tensor.requires_grad:
                            def gradient_hook(grad, entry=entry):
                                entry["gradient_norm"] = float(grad.norm())
                            tensor.register_hook(gradient_hook)
                    return value
                finally:
                    current_layer[0] = previous
            return wrapped
        for name in ("shifted", "position", "embed", "causal_mask", "head_weights", "merge_heads", "attention", "pre_norm", "ffn", "block", "lm_head", "logits", "loss_fn", "update"):
            setattr(module, name, instrument(name, getattr(module, name)))

    def predict(ids):
        return module.logits(module.embed(ids, p), p)

    if mode == "char_probe":
        w = torch.tensor(data["window"])
        x = torch.tensor(data["features"], dtype=torch.float64)
        probes = {
            "shifted": lambda: torch.stack(module.shifted(w)),
            "embed": lambda: module.embed(w[:, :-1], p),
            "attention": lambda: module.attention(F.layer_norm(x, (x.size(-1),)), p),
            "block": lambda: module.block(x, p),
            "logits": lambda: module.logits(x, p),
        }
        if data.get("project"):

            def update_probe():
                weight = torch.nn.Parameter(torch.tensor([1.0], dtype=torch.float64))
                weight.grad = torch.tensor([2.0], dtype=torch.float64)
                module.update(torch.optim.SGD([weight], lr=0.25))
                return weight

            probes.update(
                {
                    "update": update_probe,
                    "loss_fn": lambda: module.loss_fn(x @ p["lm"], w[:, 1:]),
                    "head_weights": lambda: module.head_weights(
                        F.layer_norm(x, (x.size(-1),)), p
                    ),
                    "position": lambda: module.position(w[:, :-1], p),
                    "causal_mask": lambda: module.causal_mask(
                        x @ x.transpose(-2, -1)
                    ).softmax(-1),
                    "merge_heads": lambda: module.merge_heads(
                        x.reshape(x.size(0), x.size(1), p.heads, -1).transpose(1, 2)
                    ),
                    "pre_norm": lambda: module.pre_norm(x),
                    "ffn": lambda: module.ffn(x, p),
                    "lm_head": lambda: module.lm_head(x, p),
                }
            )
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
                scores = predict(torch.tensor([tokens[-data.get("context", 4) :]]))[
                    0, -1
                ]
                tokens.append(min(4, int((scores.softmax(-1).cumsum(0) < u).sum())))
        return tokens
    trace = []
    optimizer = torch.optim.SGD(p.values(), lr=data["lr"])
    for window in data["windows"]:
        observed.clear()
        optimizer.zero_grad()
        inputs, targets = module.shifted(torch.tensor(window))
        x = module.embed(inputs, p)
        if x.requires_grad:
            x.retain_grad()
        scores = module.logits(x, p)
        loss = (
            module.loss_fn(scores, targets)
            if data.get("project")
            else F.cross_entropy(scores.flatten(0, 1), targets.reshape(-1))
        )
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
        if data.get("diagnostics060"):
            row["components"] = [dict(v) for v in observed.values()]
            if p.layers == 2:
                row["weights2"] = observed.get("head_weights:1", {}).get("weights")
        if not trace:
            with torch.no_grad():
                changed = inputs.clone()
                changed[:, -1] = (changed[:, -1] + 1) % 5
                row["prefix"] = predict(changed)[:, :-1].tolist()
                changed = inputs.clone()
                if changed.size(0) > 1:
                    changed[1:] = (changed[1:] + 2) % 5
                row["firstBatch"] = predict(changed)[:1].tolist()
        if data.get("project"):
            if not trace:
                row["weights"] = (
                    module.head_weights(F.layer_norm(x, (x.size(-1),)), p)
                    .detach()
                    .tolist()
                )
            module.update(optimizer)
            if data.get("diagnostics060"):
                row["components"].append(dict(observed.get("update:0", {"component": "update", "layer": 0, "calls": 0})))
        else:
            optimizer.step()
        row["state"] = {k: v.detach().tolist() for k, v in p.items()}
        if data.get("diagnostics060"):
            for component in row["components"]:
                component.pop("weights", None)
            if trace:
                row.pop("weights2", None)
        trace.append(row)
    return trace


def signal_model(module, data):
    import torch

    torch.set_num_threads(1)
    tensor = lambda values: torch.tensor(values, dtype=torch.float64)
    fn = getattr(module, data["name"])
    w = torch.nn.Parameter(tensor(data["initial"]))
    if "valid" in data:
        with torch.no_grad():
            x = tensor(data["valid"])
            result = fn(x, w)
            changed = x.clone()
            changed[:, -1] += 7
            return {
                "predictions": result.tolist(),
                "prefix": fn(changed, w)[:, :-1].tolist(),
                "state": w.tolist(),
            }
    trace = []
    for x, target in data["batches"]:
        x = tensor(x)
        scores = fn(x, w)
        loss = (scores - tensor(target)).square().mean()
        (grad,) = torch.autograd.grad(loss, w)
        with torch.no_grad():
            perturbed = x.clone()
            perturbed[:, -1] += 7
            prefix = fn(perturbed, w)[:, :-1]
            w.sub_(data["lr"] * grad)
        trace.append(
            {
                "output": scores.detach().tolist(),
                "prefix": prefix.tolist(),
                "grad": grad.tolist(),
                "state": w.tolist(),
            }
        )
    return trace


args = json.load(sys.stdin)
with contextlib.redirect_stdout(sys.stderr):
    spec = importlib.util.spec_from_file_location("submission", sys.argv[2])
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    if sys.argv[1] == "signal_setup":
        import torch

        result = {
            "windows": module.split_windows(args["total"], args["cut"], args["length"]),
            "normalization": module.normalization(
                torch.tensor(args["train"], dtype=torch.float64)
            ),
        }
    elif sys.argv[1] == "signal_model":
        result = signal_model(module, args)
    elif sys.argv[1] in ("char_train", "char_sample", "char_probe"):
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
