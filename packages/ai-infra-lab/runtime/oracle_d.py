import numpy as np

STEPS = {"d02-ring-collectives-v1": ["ring_reduce_scatter","ring_all_gather","ring_all_reduce"],
         "d03-ddp-bucketing-v1": ["bucket_timeline"], "d04-zero-shard-v1": ["zero_stage1"],
         "d05-tp-mlp-v1": ["tp_mlp_forward"]}
GUIDANCE = {
    "ring_reduce_scatter": ("逐轮从左邻居收一片并累加，最终持有 rank 号分片。", "Receive and accumulate from the left each round, ending with the shard indexed by rank."),
    "ring_all_gather": ("把刚收到的片继续发往右邻居，并按原编号拼接。", "Forward the newly received shard to the right and concatenate in original index order."),
    "ring_all_reduce": ("先分片归约，再收集所有分片。", "Reduce the shards, then gather the full reduced vector."),
    "bucket_timeline": ("桶内最后的梯度就绪且链路空闲后才能发送。", "A bucket can start once its last gradient is ready and the link is idle."),
    "zero_stage1": ("本地只保存一个速度分片，使用平均梯度更新后同步权重。", "Keep one local velocity shard, update with the averaged gradient and synchronize weights."),
    "tp_mlp_forward": ("在本地中间分片上做 ReLU，第二层的部分和只需归约一次。", "Apply ReLU to the local hidden shard and reduce the second-layer partial sums once."),
}


def verify(key, step, rng, call, metric, emit, n):
    if step == "bucket_timeline":
        for ready, sizes, cap, expected in [
            ([2,4,9,12],[2,2,4,1],4,[[4,7,4],[9,12,4],[12,13.5,1]]),
            ([1,2,3],[1,7,1],4,[[1,2.5,1],[2.5,7,7],[7,8.5,1]])]:
            result = call("call_fn", {"fn":step,"args":[ready,sizes,cap,1,2]})["result"]
            if result != expected:
                return False
            serial = ready[-1] + sum(1+b/2 for b in [r[2] for r in expected])
            metric("serial_ms", serial, "ms", step, "全部就绪后串行发送", "Send after all gradients are ready")
            metric("overlapped_ms", result[-1][1], "ms", step, "分桶重叠后的总时长", "Step time with bucket overlap")
        return True
    if type(n) is not int or n not in (2, 3, 4):
        raise ValueError("进程数须为 2–4 / Expected 2–4 ranks")
    if step.startswith("ring_"):
        inputs = rng.integers(-12, 13, (n, n*3))
        case = {"inputs": inputs.tolist()}
        full = inputs.sum(axis=0)
    elif step == "zero_stage1":
        weight = rng.normal(size=n*3)
        velocity = np.zeros_like(weight)
        rounds = rng.normal(size=(2,n,n*3))
        case = dict(weight=weight.tolist(), rounds=rounds.tolist(), lr=0.08, momentum=0.7)
        for gradients in rounds:
            velocity = 0.7*velocity + gradients.mean(axis=0)
            weight = weight - 0.08*velocity
    else:
        x,w1,w2 = [rng.normal(size=s) for s in [(5,3),(3,12),(12,7)]]
        case = dict(x=x.tolist(), w1=w1.tolist(), w2=w2.tolist())
        full = np.maximum(0,x@w1)@w2
    reply = call("distributed", {"step":step,"case":case,"size":n}, timeout=32)
    if "diagnosis" in reply:
        raise ValueError(reply["diagnosis"])
    ranks = reply["ranks"]
    if [r["rank"] for r in ranks] != list(range(n)) or len({r["pid"] for r in ranks}) != n:
        return False
    timeline = [op for r in ranks for op in r["trace"]]
    emit("config", "rank_timeline", step=step, timeline=timeline,
         message={"zh":"各进程的通信调用时间", "en":"Communication call times by rank"})
    for r in ranks:
        result, i, counts = r["value"], r["rank"], r["counts"]
        if result is None or r["uid"] != 65534:
            return False
        if step.startswith("ring_"):
            rounds = (n-1)*(2 if step == "ring_all_reduce" else 1)
            expected = np.split(full,n)[i] if step == "ring_reduce_scatter" else full
            if counts != {"send": rounds, "irecv": rounds} or not r["reference"] or not np.array_equal(result,expected):
                return False
        elif step == "zero_stage1":
            if counts != {"reduce_scatter_tensor": 2, "all_gather": 2}:
                return False
            if not np.allclose(result[0], weight, atol=1e-6) or not np.allclose(result[1], np.split(velocity,n)[i], atol=1e-6):
                return False
        elif counts != {"all_reduce":1} or not np.allclose(result,full,atol=1e-5):
            return False
    metric("workers", n, "ranks", step, "独立降权进程", "Distinct unprivileged workers")
    return True
