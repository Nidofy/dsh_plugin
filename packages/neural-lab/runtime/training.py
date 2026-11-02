"""Trusted NumPy oracle. Never load submitted modules or deserialize Python objects."""

import hashlib
import json
import math

import numpy as np


def digest(data):
    return hashlib.sha256(json.dumps(data, separators=(",", ":")).encode()).hexdigest()


def forward(state, x):
    w, b, v, c = state
    hidden = np.tanh(x @ w.T + b)
    return hidden, hidden @ v.T + c


def mse(y, target):
    return float(np.mean((y - target) ** 2))


def unpack(rows, shapes):
    if not isinstance(rows, list) or len(rows) != len(shapes):
        raise ValueError("expected four parameter tensors")
    result = []
    for row, shape in zip(rows, shapes):
        a = np.asarray(row)
        if a.dtype.kind not in "fi" or a.shape != shape or not np.isfinite(a).all():
            raise ValueError(f"invalid tensor, expected finite shape {shape}")
        result.append(a)
    return result


def scalar(value):
    if type(value) not in (int, float) or not math.isfinite(value):
        raise ValueError("expected a finite scalar loss")
    return float(value)


def editable_mlp(seed, lr, call, emit):
    if not math.isfinite(lr) or not 0.001 <= lr <= 0.3:
        raise ValueError("learning rate outside [0.001, 0.3]")
    rng = np.random.default_rng(seed)
    x = rng.uniform(-1, 1, size=(32, 2))
    y = x[:, :1] ** 2 + 0.6 * x[:, 1:] - 0.15
    ids = rng.permutation(len(x))
    train, valid = ids[:24], ids[24:]
    shapes = [(4, 2), (4,), (1, 4), (1,)]
    initial = [rng.normal(0, 0.25, size=s) for s in shapes]
    initial_json = [a.tolist() for a in initial]
    batches = [rng.choice(train, size=6, replace=False) for _ in range(8)]
    emit(
        "manifest",
        "training snapshot",
        manifest={
            "protocol": "train-mlp-v1",
            "dataset": "quadratic-2d-v1",
            "splitHash": digest(ids.tolist()),
            "initialHash": digest(initial_json),
            "batchHash": digest([b.tolist() for b in batches]),
        },
    )
    emit(
        "config",
        "effective_config",
        config={"learningRate": lr, "steps": len(batches), "batchSize": 6},
    )
    try:
        trace = call(
            {
                "state": initial_json,
                "lr": lr,
                "batches": [[x[b].tolist(), y[b].tolist()] for b in batches],
            },
            mode="train",
        )
        if not isinstance(trace, list) or len(trace) != len(batches):
            raise ValueError("expected one checkpoint per training step")
        state = initial
        for step, (row, batch) in enumerate(zip(trace, batches), 1):
            h, pred = forward(state, x[batch])
            loss = mse(pred, y[batch])
            dy = 2 * (pred - y[batch]) / len(batch)
            dh = (dy @ state[2]) * (1 - h * h)
            grad = [dh.T @ x[batch], dh.sum(0), dy.T @ h, dy.sum(0)]
            actual_grad = unpack(row["grad"], shapes)
            after = unpack(row["state"], shapes)
            report = scalar(row["loss"])

            def check(name, ok):
                emit(
                    "check",
                    name,
                    passed=bool(ok),
                    detail=f"step {step}, atol=1e-8, rtol=1e-6",
                )

            check("forward + MSE", np.isclose(report, loss, rtol=1e-6, atol=1e-8))
            check(
                "fresh minibatch gradients",
                all(
                    np.allclose(a, b, rtol=1e-6, atol=1e-8)
                    for a, b in zip(actual_grad, grad)
                ),
            )
            check(
                "SGD parameter update",
                all(
                    np.allclose(a, b - lr * g, rtol=1e-6, atol=1e-8)
                    for a, b, g in zip(after, state, grad)
                ),
            )
            emit(
                "metric",
                "student_reported_loss",
                step=step,
                value=report,
                source="student",
            )
            state = after
            for name, subset in [("train_loss", train), ("validation_loss", valid)]:
                emit(
                    "metric",
                    name,
                    step=step,
                    value=mse(forward(state, x[subset])[1], y[subset]),
                    source="program",
                )
        final = [p.tolist() for p in state]
        validation = call(
            {"state": final, "batch": [x[valid].tolist(), y[valid].tolist()]},
            mode="validate",
        )
        reported = scalar(validation["loss"])
        emit(
            "metric",
            "student_validation_loss",
            step=step,
            value=reported,
            source="student",
        )
        check(
            "held-out validation MSE",
            np.isclose(
                reported,
                mse(forward(state, x[valid])[1], y[valid]),
                rtol=1e-6,
                atol=1e-8,
            ),
        )
        check("validation uses eval and no_grad", validation["eval_only"] is True)
        check(
            "validation preserves parameters",
            all(
                np.array_equal(a, b)
                for a, b in zip(unpack(validation["state"], shapes), state)
            ),
        )
    except Exception as error:
        emit("check", "training contract", passed=False, detail=str(error)[-1500:])
