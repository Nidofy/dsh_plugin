import copy
import math
import statistics
import time


def observe(module, step, c):
    if step == "plan_cluster_budget":
        return [module.plan_cluster_budget(spec) for spec in c["specs"]]
    if "pool" in c:
        state, snapshots = c["pool"], []
        for name, args in c["operations"]:
            error = None
            try:
                getattr(module, name)(state, *args)
            except (KeyError, MemoryError) as exc:
                error = type(exc).__name__
            snapshots.append({"error":error,"state":copy.deepcopy(state)})
        return snapshots

    import torch
    torch.set_num_threads(1)
    if step == "quantize_int4_grouped":
        w = torch.tensor(c["w"])
        result = module.quantize_int4_grouped(w, c["group"])
        if result is None:
            return None
        packed, scales = result
        return {"packed":packed.tolist(), "scales":scales.tolist(), "uint8":packed.dtype == torch.uint8}
    if step == "dequantize_int4_grouped":
        return module.dequantize_int4_grouped(torch.tensor(c["packed"],dtype=torch.uint8),
                                              torch.tensor(c["scales"]), c["group"], c["length"])

    from .stage_c import TensorPeak
    q, k, v = (torch.tensor(c[key],dtype=torch.float32) for key in ("q","k","v"))
    n, d = q.shape
    def cached():
        keys, values = torch.full_like(k,-1234), torch.full_like(v,-1234)
        outputs = []
        for i in range(n):
            value = module.decode_step(q[i],k[i],v[i],keys,values,i)
            if value is None:
                return None, False
            outputs.append(value)
        return torch.stack(outputs), torch.equal(k,keys) and torch.equal(v,values)
    def full():
        rows = []
        for i in range(1,n+1):
            scores = q[:i]@k[:i].T / math.sqrt(d)
            scores.masked_fill_(torch.ones_like(scores,dtype=torch.bool).triu(1),-math.inf)
            rows.append((torch.softmax(scores,-1)@v[:i])[-1])
        return torch.stack(rows)
    peak = TensorPeak()
    with peak:
        result, cache_ok = cached()
    if result is None:
        return None
    cache_ok = cache_ok and torch.allclose(result, full(), atol=1e-5)
    def median_ms(fn):
        samples = []
        for _ in range(3):
            start = time.perf_counter()
            fn()
            samples.append(1000*(time.perf_counter()-start))
        return statistics.median(samples)
    return dict(values=result.tolist(),cache_ok=cache_ok,peak=peak.elements,
                cached_ms=median_ms(cached),full_ms=median_ms(full))
