"""Independent causal window oracle for the shared vibration forecasting benchmark."""

import numpy as np
import torch
from training import digest
from char_transformer import matches


def reference(name, x, w):
    # Explicit lags serve as an independent oracle for Conv1d and unfold submissions.
    padded = torch.cat([x.new_zeros(x.size(0), 3), x], dim=1)
    windows = torch.stack([padded[:, i : i + x.size(1)] for i in range(4)], -1)
    if name == "local_attention":
        a = (windows * w[0] + w[1:5]).softmax(-1)
        return (a * windows).sum(-1) + w[5]
    y = (windows * w[:4]).sum(-1)
    return (y.tanh() if name == "linear_mlp" else y.relu()) * w[4] + w[5]


def train_signal(seed, lr, call, emit):
    if not 0.001 <= lr <= 0.3:
        raise ValueError("invalid learning rate")
    rng = np.random.default_rng(seed)
    t = np.arange(128)
    raw = (
        np.sin(t * 0.24) * np.exp(-t / 220)
        + 0.3 * np.sin(t * 0.63)
        + rng.normal(0, 0.025, len(t))
    )
    cut, length = 88, 8
    # Only the training segment and split lengths enter the submitted preprocessing functions.
    try:
        setup = call(
            {
                "total": len(raw),
                "cut": cut,
                "length": length,
                "train": raw[:cut].tolist(),
            },
            mode="signal_setup",
        )
        train, valid = [np.asarray(indices) for indices in setup["windows"]]
        if (
            train.dtype.kind not in "iu"
            or valid.dtype.kind not in "iu"
            or not np.array_equal(train, np.arange(cut - length))
            or not np.array_equal(valid, np.arange(cut, len(raw) - length))
        ):
            raise ValueError("windows cross split or omit eligible positions")
        mean, std = setup["normalization"]
        if (
            not np.allclose(
                [mean, std], [raw[:cut].mean(), raw[:cut].std()], atol=1e-10, rtol=1e-9
            )
            or std <= 0
        ):
            raise ValueError("train-only normalization")
        data = (raw - mean) / std
    except Exception as error:
        emit(
            "check", "split and normalization", passed=False, detail=str(error)[-1200:]
        )
        return
    starts = [rng.choice(train, 3, replace=False) for _ in range(4)]

    def windows(ids):
        return np.stack([data[i : i + length] for i in ids]), np.stack(
            [data[i + 1 : i + length + 1] for i in ids]
        )

    batches = [windows(ids) for ids in starts]
    vx, vy = windows(valid)
    initial = rng.normal(0.1, 0.18, 6).tolist()
    emit(
        "manifest",
        "vibration benchmark",
        manifest={
            "protocol": "project-signal-v1",
            "dataset": "damped-signal-v1",
            "initialHash": digest(initial),
            "splitHash": digest([raw.tolist(), cut, length, float(mean), float(std)]),
            "batchHash": digest([ids.tolist() for ids in starts]),
        },
    )
    emit(
        "config",
        "effective_config",
        config={"learningRate": lr, "steps": 4, "batchSize": 3, "window": length},
    )
    emit(
        "check",
        "chronological holdout",
        passed=bool(max(train) + length < min(valid)),
        detail=f"train positions 0..87, holdout 88..127; train-only mean={mean:.8f} std={std:.8f}",
    )
    curves = []
    for name in ("linear_mlp", "causal_cnn", "local_attention"):
        try:
            trace = call(
                {
                    "name": name,
                    "lr": lr,
                    "initial": initial,
                    "batches": [[x.tolist(), y.tolist()] for x, y in batches],
                },
                mode="signal_model",
            )
            if len(trace) != len(batches):
                raise ValueError("wrong number of updates")
            state = torch.tensor(initial, dtype=torch.float64)
            losses = []
            for step, ((x, y), actual) in enumerate(zip(batches, trace), 1):
                state = state.detach().requires_grad_()
                pred = reference(name, torch.from_numpy(x), state)
                loss = (pred - torch.from_numpy(y)).square().mean()
                (grad,) = torch.autograd.grad(loss, state)
                state = state - lr * grad
                for label, value, expected in [
                    ("forward", actual["output"], pred),
                    ("future invariance", actual["prefix"], pred[:, :-1]),
                    ("gradient", actual["grad"], grad),
                    ("update", actual["state"], state),
                ]:
                    if not matches(value, expected):
                        raise ValueError(f"step {step}: {label}")
                val = (
                    (
                        reference(name, torch.from_numpy(vx), state)
                        - torch.from_numpy(vy)
                    )
                    .square()
                    .mean()
                )
                losses.append((loss.item(), val.item()))
                for metric, value in [
                    ("train_loss", loss.item()),
                    ("validation_loss", val.item()),
                    ("gradient_norm", grad.norm().item()),
                    ("parameter_delta", lr * grad.norm().item()),
                ]:
                    emit(
                        "metric",
                        name + "." + metric,
                        source="program",
                        step=step,
                        value=value,
                    )
            holdout = call(
                {"name": name, "initial": trace[-1]["state"], "valid": vx.tolist()},
                mode="signal_model",
            )
            expected = reference(name, torch.from_numpy(vx), state)
            if (
                not matches(holdout["predictions"], expected)
                or not matches(holdout["prefix"], expected[:, :-1])
                or not matches(holdout["state"], state)
            ):
                raise ValueError(
                    "holdout predictions, causal prefix or frozen parameters"
                )
            emit(
                "shape",
                name + ".holdout",
                step=4,
                shape=list(np.shape(holdout["predictions"])),
                source="student",
                detail="float64",
            )
            curves.append(losses)
            emit(
                "check",
                name,
                passed=True,
                detail="4 updates, held-out predictions and causal perturbation checked",
            )
        except Exception as error:
            emit("check", name, passed=False, detail=str(error)[-1200:])
    if len(curves) == 3:
        for step, pair in enumerate(np.mean(curves, axis=0), 1):
            for metric, value in zip(("train_loss", "validation_loss"), pair):
                emit("metric", metric, step=step, source="program", value=float(value))
