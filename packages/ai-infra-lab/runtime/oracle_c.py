import numpy as np

STEPS = {
    "c01-mlp-io-v1": ["cached_forward", "cache_bytes"],
    "c02-train-ledger-v1": ["train_ledger"],
    "c03-amp-scaling-v1": ["fp16_underflow_grad", "loss_scaled_step", "dynamic_scaler_update"],
    "c04-online-softmax-v1": ["online_softmax_update", "online_attention_step", "tiled_attention"],
}

GUIDANCE = {
    "cached_forward": ("缓存原始 X 和第一层 ReLU 的输出，保留 B、S 两维。", "Cache the input and first ReLU output while preserving batch and sequence axes."),
    "cache_bytes": ("每个张量使用自己的元素宽度。", "Multiply each tensor's element count by its own element width."),
    "train_ledger": ("完成一次 AdamW 更新才会分配矩和步数标量；两者分别计数。", "After an AdamW step, count moment tensors and per-parameter step scalars separately."),
    "fp16_underflow_grad": ("直接观察梯度转换为 FP16 后的值。", "Inspect the gradient after rounding to FP16."),
    "loss_scaled_step": ("先放大再转 FP16，转回 FP32 后除以 scale；非有限值跳过本次更新。", "Scale before casting to FP16, unscale in FP32 and skip a nonfinite update."),
    "dynamic_scaler_update": ("本练习每次有限更新都翻倍，溢出减半，范围为 1 到 65536。", "Double after a finite step, halve on overflow, and clamp to [1, 65536]."),
    "online_softmax_update": ("最大值改变时要重标定旧分母。", "Rescale the old denominator whenever the running maximum changes."),
    "online_attention_step": ("旧分子和旧分母共用同一个缩放因子。", "Apply the same rescaling factor to the old numerator and denominator."),
    "tiled_attention": ("逐查询流过 K、V 的短块；处理末块并仅在行末除以分母。", "Stream short K/V blocks per query, include the tail, and normalize at the end of each row."),
}


def verify(step, rng, observe, metric):
    if step == "cache_bytes":
        return observe({}) == 2*5*3*8 + 2*5*7*2
    if step == "cached_forward":
        x, w1, w2 = (rng.normal(size=s) for s in [(2,5,3),(3,7),(7,4)])
        hidden = np.maximum(0, x@w1)
        out = observe(dict(x=x.tolist(), w1=w1.tolist(), w2=w2.tolist()))
        return (out is not None and np.allclose(out["x"], x) and np.allclose(out["hidden"], hidden, atol=1e-6)
                and np.allclose(out["y"], hidden@w2, atol=1e-5) and out["bytes"] == (x.size+hidden.size)*4)
    if step == "train_ledger":
        width, out = int(rng.integers(3, 9)), 5
        r = observe({"width": width, "out": out})
        weight_bytes = (width+1)*out*4
        return r["ledger"] == r["state_dict"] == [weight_bytes, weight_bytes, 2*weight_bytes, 8]
    if step == "fp16_underflow_grad":
        args = [[1e-8], [-1e-8], [0.25]]
        return observe({"args": args}) == [0.0, 0.0, 0.25]
    if step == "dynamic_scaler_update":
        args = [[1, True], [512, True], [128, False], [65536, False]]
        return observe({"args": args}) == [1,256,256,65536]
    if step == "loss_scaled_step":
        args = [[1, 1e-8, 1e4, 8192], [-2, -1e-8, 1e4, 16384], [2, 10000, 0.1, 64], [3, "nan", 1, 8]]
        result = observe({"args": args})
        return all(r is not None and abs(r - expected) < 4e-7 for r, expected in zip(result, [1-1e-4, -2+1e-4, 2, 3], strict=True))
    if step in ("online_softmax_update", "online_attention_step"):
        blocks, expected = [], []
        for old_m, old_l, scores in [(None,0,[998.,1000.]), (1000.,1.25,[1002.,999.]), (-995.,2.,[-999.])]:
            m = max(max(scores), old_m if old_m is not None else -np.inf)
            factor = np.exp(old_m-m) if old_m is not None else 0
            weights = np.exp(np.asarray(scores)-m)
            v = rng.normal(size=(len(scores),3)).astype(np.float32)
            o = np.ones(3)*old_l
            parts = [m, old_l*factor+weights.sum()]
            if step == "online_attention_step":
                parts.append(o*factor+weights@v)
            expected.append(parts)
            blocks.append(dict(m=old_m,l=old_l,scores=scores,v=v.tolist(),o=o.tolist()))
        results = observe({"blocks": blocks})
        return all(r is not None and len(r)==len(e) and all(np.allclose(a,b,atol=1e-5) for a,b in zip(r,e)) for r,e in zip(results,expected,strict=True))
    for length, tile in [(31, 7), (37, 1)]:
        q, k, v = (rng.normal(size=(length, 4)) for _ in range(3))
        score = q@k.T / np.sqrt(q.shape[1])
        w = np.exp(score-score.max(axis=1,keepdims=True))
        expected = (w/w.sum(axis=1,keepdims=True))@v
        r = observe(dict(q=q.tolist(), k=k.tolist(), v=v.tolist(), tile=tile))
        if r["output"] is None or np.shape(r["output"]) != expected.shape or r["peak"] >= length**2:
            return False
        if not np.max(np.abs(np.asarray(r["output"])-expected)) < 1e-5:
            return False
    metric("peak_tensor", r["peak"], "elements", step, "最大中间张量元素数", "Largest intermediate tensor (elements)")
    return True
