"""Trusted reference for a one-block decoder. Submitted functions only run in student.py."""

import math
import numpy as np
import torch
import torch.nn.functional as F
from training import digest


def attention_weights(n, p, heads_count):
    batch, context, width = n.shape
    q, k = [
        (n @ p[key]).reshape(batch, context, heads_count, -1).transpose(1, 2)
        for key in ("q", "k")
    ]
    scores = (q @ k.transpose(-2, -1)) / math.sqrt(width // heads_count)
    return scores.masked_fill(
        ~torch.ones(context, context, dtype=torch.bool).tril(), -torch.inf
    ).softmax(-1)


def attention(n, p, heads_count=2):
    q, k, v = [(n @ p[name]).chunk(heads_count, dim=-1) for name in ("q", "k", "v")]
    heads = [
        F.scaled_dot_product_attention(q[i], k[i], v[i], is_causal=True)
        for i in range(heads_count)
    ]
    return torch.cat(heads, dim=-1) @ p["out"]


def block(x, p, heads_count=2):
    h = x + attention(F.layer_norm(x, (x.size(-1),)), p, heads_count)
    return h + F.relu(F.layer_norm(h, (h.size(-1),)) @ p["up"]) @ p["down"]


def decoder(ids, p, heads_count=2):
    x = F.embedding(ids, p["token"]) + p["position"][: ids.size(1)]
    return x, block(x, p, heads_count) @ p["lm"]


def matches(actual, expected):
    a = np.asarray(actual)
    b = expected.detach().numpy()
    return (
        a.dtype.kind in "fi"
        and a.shape == b.shape
        and np.isfinite(a).all()
        and np.allclose(a, b, atol=1e-8, rtol=1e-6)
    )


def train_character(seed, lr, call, emit, protocol="train-char-v1"):
    project = protocol.startswith("project-")
    wide = protocol == "project-char-wide-v1"
    width, context, heads_count, batch_size = (6, 3, 3, 3) if wide else (4, 4, 2, 2)

    def invoke(data, mode):
        return call(
            {**data, "heads": heads_count, "project": project, "context": context},
            mode=mode,
        )

    if not math.isfinite(lr) or not 0.001 <= lr <= 0.3:
        raise ValueError("invalid learning rate")
    vocab = "abcde"
    corpus = (
        "abacdedabecabcdeacbd"
        "bcdedcabacdebacbdace"
        "cdeabcbacedabcdbaceb"
        "decabcbdacebcabedcba"
        "ecbdacadbecadbecabda"
    )
    ids = [vocab.index(c) for c in corpus]
    cut = 72
    train_ids = list(range(0, cut - context))
    valid_ids = list(range(cut, len(ids) - context))
    rng = np.random.default_rng(seed)
    batches = [
        rng.choice(train_ids, batch_size, replace=False).tolist()
        for _ in range(2 if wide else 4)
    ]
    windows = [[ids[i : i + context + 1] for i in batch] for batch in batches]
    shapes = {
        "token": (5, width),
        "position": (context, width),
        "q": (width, width),
        "k": (width, width),
        "v": (width, width),
        "out": (width, width),
        "up": (width, 6),
        "down": (6, width),
        "lm": (width, 5),
    }
    initial = {k: rng.normal(0, 0.3, size=s).tolist() for k, s in shapes.items()}
    emit(
        "manifest",
        "training snapshot",
        manifest={
            "protocol": protocol,
            "dataset": "tiny-char-v1",
            "initialHash": digest(initial),
            "splitHash": digest([corpus, train_ids, valid_ids]),
            "batchHash": digest(batches),
        },
    )
    emit(
        "config",
        "effective_config",
        config={
            "learningRate": lr,
            "steps": len(windows),
            "heads": heads_count,
            "width": width,
            "context": context,
            "batchSize": batch_size,
        },
    )
    ok = True

    def check(name, passed, detail):
        nonlocal ok
        ok = ok and bool(passed)
        emit("check", name, passed=bool(passed), detail=detail)

    try:
        train_positions = {i + j for i in train_ids for j in range(context + 1)}
        valid_positions = {i + j for i in valid_ids for j in range(context + 1)}
        check(
            "chronological holdout",
            train_positions.isdisjoint(valid_positions)
            and all(i in train_ids for b in batches for i in b),
            f"train positions 0..{cut-1}, validation {cut}..{len(ids)-1}; windows never cross the split",
        )
        window = torch.tensor(windows[0])
        features = torch.tensor(
            rng.normal(size=(batch_size, context, width)), dtype=torch.float64
        )
        base = {k: torch.tensor(v, dtype=torch.float64) for k, v in initial.items()}
        stages = invoke(
            {"state": initial, "window": windows[0], "features": features.tolist()},
            mode="char_probe",
        )
        expected = {
            "shifted": torch.stack([window[:, :-1], window[:, 1:]]),
            "embed": decoder(window[:, :-1], base, heads_count)[0],
            "attention": attention(F.layer_norm(features, (width,)), base, heads_count),
            "block": block(features, base, heads_count),
            "logits": block(features, base, heads_count) @ base["lm"],
        }
        if project:
            scores = features @ features.transpose(-2, -1)
            expected.update(
                {
                    "update": torch.tensor([0.5], dtype=torch.float64),
                    "loss_fn": F.cross_entropy(
                        (features @ base["lm"]).flatten(0, 1), window[:, 1:].reshape(-1)
                    ),
                    "head_weights": attention_weights(
                        F.layer_norm(features, (width,)), base, heads_count
                    ),
                    "position": base["position"][:context],
                    "causal_mask": scores.masked_fill(
                        ~torch.ones(context, context, dtype=torch.bool).tril(),
                        -torch.inf,
                    ).softmax(-1),
                    "merge_heads": features,
                    "pre_norm": F.layer_norm(features, (width,)),
                    "ffn": F.relu(features @ base["up"]) @ base["down"],
                    "lm_head": features @ base["lm"],
                }
            )
            # A second legal specification is required even for the introductory project.
            alternate_heads = 1 if heads_count != 1 else 2
            short = features[:1, :2]
            alternate = call(
                {
                    "state": initial,
                    "window": window[:1, :3].tolist(),
                    "features": short.tolist(),
                    "heads": alternate_heads,
                    "project": True,
                    "context": 2,
                },
                mode="char_probe",
            )
            stage = alternate["attention"]
            check(
                "attention alternate B/T/heads",
                matches(
                    stage.get("value"),
                    attention(F.layer_norm(short, (width,)), base, alternate_heads),
                ),
                stage.get("error") or "B=1, T=2, H=1",
            )
        for name, value in expected.items():
            stage = stages[name]
            check(
                "module " + name,
                matches(stage.get("value"), value),
                stage.get("error") or f"expected shape {list(value.shape)}, atol=1e-8",
            )
        if any("error" in stage for stage in stages.values()):
            return
        trace = invoke(
            {"state": initial, "windows": windows, "lr": lr}, mode="char_train"
        )
        if not isinstance(trace, list) or len(trace) != len(windows):
            raise ValueError("expected four training checkpoints")
        state = initial
        for step, (batch, row) in enumerate(zip(windows, trace), 1):
            p = {
                k: torch.tensor(v, dtype=torch.float64, requires_grad=True)
                for k, v in state.items()
            }
            w = torch.tensor(batch)
            inputs, targets = w[:, :-1], w[:, 1:]
            x, logits = decoder(inputs, p, heads_count)
            loss = F.cross_entropy(logits.reshape(-1, 5), targets.reshape(-1))
            dx, *grads = torch.autograd.grad(loss, [x, *p.values()])

            def test(name, passed):
                check(
                    name, passed, f"step {step}, B={batch_size}, T={context}, float64"
                )

            test(
                "next-token windows",
                matches(row["inputs"], inputs) and matches(row["targets"], targets),
            )
            test("token and position embedding", matches(row["x"], x))
            test("decoder logits", matches(row["logits"], logits))
            test("embedding input gradient", matches(row["dx"], dx))
            test(
                "all parameter gradients",
                all(matches(row["grad"][k], g) for k, g in zip(p, grads)),
            )
            test(
                "SGD parameter updates",
                all(
                    matches(row["state"][k], v - lr * g)
                    for (k, v), g in zip(p.items(), grads)
                ),
            )
            reported = row["loss"]
            test("cross entropy", matches(reported, loss))
            emit(
                "metric",
                "student_reported_loss",
                value=float(reported),
                step=step,
                source="student",
            )
            if step == 1:
                actual = torch.tensor(row["logits"], dtype=torch.float64)
                test("causal prefix unchanged", matches(row["prefix"], actual[:, :-1]))
                test("batch isolation", matches(row["firstBatch"], actual[:1]))
            if project:
                actual_grad = [
                    np.asarray(row["grad"][key], dtype=float) for key in shapes
                ]
                changes = [
                    np.asarray(row["state"][key], dtype=float) - np.asarray(state[key])
                    for key in shapes
                ]
                for name, tensors in [
                    ("parameter_delta", changes),
                    ("gradient_norm", actual_grad),
                ]:
                    norm = math.sqrt(sum(float(np.square(t).sum()) for t in tensors))
                    if math.isfinite(norm):
                        emit("metric", name, step=step, value=norm, source="program")
                if step == 1:
                    for label, actual_value in [
                        ("tokens", row["inputs"]),
                        ("embedding", row["x"]),
                        ("head weights", row["weights"]),
                        ("logits", row["logits"]),
                        ("targets", row["targets"]),
                    ]:
                        emit(
                            "shape",
                            label,
                            step=step,
                            shape=list(np.shape(actual_value)),
                            source="student",
                            detail=(
                                "int64" if label in ("tokens", "targets") else "float64"
                            ),
                        )
                    n = F.layer_norm(x, (width,))
                    weights = attention_weights(n, p, heads_count)
                    same = matches(row["weights"], weights)
                    test("module head_weights", same)
                    if same:
                        stride = max(1, math.ceil(context / 16))
                        for head in range(heads_count):
                            emit(
                                "tensor",
                                f"attention.layer0.head{head}",
                                step=step,
                                source="student",
                                data=np.asarray(row["weights"][0][head])[
                                    ::stride, ::stride
                                ].tolist(),
                                shape=[context, context],
                                stride=stride,
                                detail=f"float64; original=[{batch_size},{heads_count},{context},{context}]; batch=0; query/key stride={stride}; x=[{batch_size},{context},{width}]",
                            )
            state = row["state"]
            if set(state) != set(shapes) or any(
                np.shape(state[k]) != shape
                or np.asarray(state[k]).dtype.kind not in "fi"
                or not np.isfinite(state[k]).all()
                for k, shape in shapes.items()
            ):
                raise ValueError("invalid returned parameter shape or value")
            after = {k: torch.tensor(state[k], dtype=torch.float64) for k in shapes}
            for name, indices in [
                ("train_loss", train_ids),
                ("validation_loss", valid_ids),
            ]:
                examples = torch.tensor([ids[i : i + context + 1] for i in indices])
                _, scores = decoder(examples[:, :-1], after, heads_count)
                value = F.cross_entropy(
                    scores.flatten(0, 1), examples[:, 1:].reshape(-1)
                )
                emit("metric", name, value=float(value), step=step, source="program")
        if ok:
            uniforms = rng.random(16).tolist()
            sampled = invoke({"state": state, "uniforms": uniforms}, mode="char_sample")
            tokens = [0]
            for u in uniforms:
                _, scores = decoder(
                    torch.tensor([tokens[-context:]]), after, heads_count
                )
                cumulative = scores[0, -1].softmax(-1).cumsum(0)
                tokens.append(min(4, int((cumulative < u).sum())))
            same = sampled == tokens
            check(
                "autoregressive sampling", same, "16 draws, sliding context, fixed seed"
            )
            if same:
                emit(
                    "sample",
                    "字符采样 / Generated text",
                    detail="".join(vocab[i] for i in tokens),
                )
    except Exception as error:
        check("decoder contract", False, str(error)[-1500:])
