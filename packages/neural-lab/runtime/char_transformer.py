"""Trusted reference for a one-block decoder. Submitted functions only run in student.py."""

import math
import numpy as np
import torch
import torch.nn.functional as F
from training import digest


def attention(n, p):
    q, k, v = [(n @ p[name]).chunk(2, dim=-1) for name in ("q", "k", "v")]
    heads = [
        F.scaled_dot_product_attention(q[i], k[i], v[i], is_causal=True)
        for i in range(2)
    ]
    return torch.cat(heads, dim=-1) @ p["out"]


def block(x, p):
    h = x + attention(F.layer_norm(x, (4,)), p)
    return h + F.relu(F.layer_norm(h, (4,)) @ p["up"]) @ p["down"]


def decoder(ids, p):
    x = F.embedding(ids, p["token"]) + p["position"][: ids.size(1)]
    return x, block(x, p) @ p["lm"]


def matches(actual, expected):
    a = np.asarray(actual)
    b = expected.detach().numpy()
    return (
        a.dtype.kind in "fi"
        and a.shape == b.shape
        and np.isfinite(a).all()
        and np.allclose(a, b, atol=1e-8, rtol=1e-6)
    )


def train_character(seed, lr, call, emit):
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
    train_ids = list(range(0, cut - 4))
    valid_ids = list(range(cut, len(ids) - 4))
    rng = np.random.default_rng(seed)
    batches = [rng.choice(train_ids, 2, replace=False).tolist() for _ in range(4)]
    windows = [[ids[i : i + 5] for i in batch] for batch in batches]
    shapes = {
        "token": (5, 4),
        "position": (4, 4),
        "q": (4, 4),
        "k": (4, 4),
        "v": (4, 4),
        "out": (4, 4),
        "up": (4, 6),
        "down": (6, 4),
        "lm": (4, 5),
    }
    initial = {k: rng.normal(0, 0.3, size=s).tolist() for k, s in shapes.items()}
    emit(
        "manifest",
        "training snapshot",
        manifest={
            "protocol": "train-char-v1",
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
            "steps": 4,
            "heads": 2,
            "width": 4,
            "context": 4,
            "batchSize": 2,
        },
    )
    ok = True

    def check(name, passed, detail):
        nonlocal ok
        ok = ok and bool(passed)
        emit("check", name, passed=bool(passed), detail=detail)

    try:
        train_positions = {i + j for i in train_ids for j in range(5)}
        valid_positions = {i + j for i in valid_ids for j in range(5)}
        check(
            "chronological holdout",
            train_positions.isdisjoint(valid_positions)
            and all(i in train_ids for b in batches for i in b),
            f"train positions 0..{cut-1}, validation {cut}..{len(ids)-1}; windows never cross the split",
        )
        window = torch.tensor(windows[0])
        features = torch.tensor(rng.normal(size=(2, 4, 4)), dtype=torch.float64)
        base = {k: torch.tensor(v, dtype=torch.float64) for k, v in initial.items()}
        stages = call(
            {"state": initial, "window": windows[0], "features": features.tolist()},
            mode="char_probe",
        )
        expected = {
            "shifted": torch.stack([window[:, :-1], window[:, 1:]]),
            "embed": decoder(window[:, :-1], base)[0],
            "attention": attention(F.layer_norm(features, (4,)), base),
            "block": block(features, base),
            "logits": block(features, base) @ base["lm"],
        }
        for name, value in expected.items():
            stage = stages[name]
            check(
                "module " + name,
                matches(stage.get("value"), value),
                stage.get("error") or f"expected shape {list(value.shape)}, atol=1e-8",
            )
        if any("error" in stage for stage in stages.values()):
            return
        trace = call(
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
            x, logits = decoder(inputs, p)
            loss = F.cross_entropy(logits.reshape(-1, 5), targets.reshape(-1))
            dx, *grads = torch.autograd.grad(loss, [x, *p.values()])

            def test(name, passed):
                check(name, passed, f"step {step}, B=2, T=4, float64")

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
                examples = torch.tensor([ids[i : i + 5] for i in indices])
                _, scores = decoder(examples[:, :-1], after)
                value = F.cross_entropy(
                    scores.flatten(0, 1), examples[:, 1:].reshape(-1)
                )
                emit("metric", name, value=float(value), step=step, source="program")
        if ok:
            uniforms = rng.random(16).tolist()
            sampled = call({"state": state, "uniforms": uniforms}, mode="char_sample")
            tokens = [0]
            for u in uniforms:
                _, scores = decoder(torch.tensor([tokens[-4:]]), after)
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
