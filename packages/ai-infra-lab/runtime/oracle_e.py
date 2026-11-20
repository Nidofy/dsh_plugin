from collections import Counter
import math
import numpy as np

STEPS = {"e01-kv-decode-v1":["decode_step"],
         "e02-paged-allocator-v1":["allocate_sequence","append_token","free_sequence","fork_prefix"],
         "e03-group-quant-v1":["quantize_int4_grouped","dequantize_int4_grouped"],
         "x01-capstone-v1":["plan_cluster_budget"]}
GUIDANCE = {
    "decode_step": ("只追加一行 K、V，用当前查询读取有效前缀。", "Append one K/V row and attend to the valid prefix with the current query."),
    "allocate_sequence": ("按 16 个 token 一页分配，先检查空闲页是否足够。", "Allocate pages of 16 tokens and check available pages before changing state."),
    "append_token": ("共享尾页有空位时，先复制再写；满页后另开一页。", "Copy a shared partial tail before writing, or start a new page after a full tail."),
    "free_sequence": ("逐页减引用，降为零的页才能回到空闲表。", "Decrement each reference and return only zero-reference pages to the free list."),
    "fork_prefix": ("按逻辑长度截取共享页，独立保存块表并增加每页引用。", "Slice the shared pages by logical prefix length, copy the table and increment every reference."),
    "quantize_int4_grouped": ("每组取绝对最大值除 7，先写偶数索引的低四位。", "Scale each group by max(abs)/7 and place even-indexed codes in the low nibble."),
    "dequantize_int4_grouped": ("先将四位编码恢复为有符号数，再乘该组比例。", "Sign-extend each nibble before multiplying by its own group scale."),
    "plan_cluster_budget": ("逐类计算每卡分摊，再加入本地工作区，并分别核对容量和时间。", "Shard each state category separately, add local workspace and check both capacity and time."),
}


def paged(step, observe, metric):
    pool = dict(free=list(range(4)), refs=[0]*4, pages=[[0]*16 for _ in range(4)], seq={})
    a = list(range(19))
    operations = [["allocate_sequence",["a",a]]]
    expected = [{"a":a}]
    errors = [None]
    def push(fn, args, want, error=None):
        operations.append([fn,args])
        expected.append(want)
        errors.append(error)
    if step == "allocate_sequence":
        push(step,["b",list(range(65))],expected[-1],"MemoryError")
        push(step,["a",[]],expected[-1],"KeyError")
        push(step,["empty",[]],{"a":a,"empty":[]})
    elif step == "append_token":
        for i in range(19,34):
            push(step,["a",i],{"a":list(range(i+1))})
        push("allocate_sequence",["b",list(range(16))],{"a":list(range(34)),"b":list(range(16))})
        push(step,["b",22],expected[-1],"MemoryError")
    elif step == "free_sequence":
        push(step,["a"],{})
        push(step,["a"],{},"KeyError")
        push("allocate_sequence",["b",list(range(64))],{"b":list(range(64))})
    else:
        push(step,["a","b",17],{"a":a,"b":a[:17]})
        push("append_token",["b",99],{"a":a,"b":a[:17]+[99]})
        push(step,["a","c",16],{**expected[-1],"c":a[:16]})
        # Fill the last free page; a COW append to the shared first page must fail atomically.
        push("allocate_sequence",["spare",[7]],{**expected[-1],"spare":[7]})
        push(step,["a","short",3],{**expected[-1],"short":a[:3]})
        push("append_token",["short",42],expected[-1],"MemoryError")
        push("free_sequence",["short"],{k:v for k,v in expected[-1].items() if k!="short"})
        push("free_sequence",["spare"],{k:v for k,v in expected[-1].items() if k!="spare"})
        push("free_sequence",["a"],{"b":a[:17]+[99],"c":a[:16]})
        push("free_sequence",["c"],{"b":a[:17]+[99]})
        push("free_sequence",["b"],{})
    snapshots = observe({"pool":pool,"operations":operations})
    for i,(s,want,err) in enumerate(zip(snapshots,expected,errors,strict=True)):
        state = s["state"]
        if s["error"] != err or set(state["seq"]) != set(want):
            return False
        if err and state != snapshots[i-1]["state"]:
            return False
        counts = Counter()
        for name, seq in want.items():
            desc = state["seq"][name]
            table = desc["blocks"]
            if (desc["length"] != len(seq) or len(table) != math.ceil(len(seq)/16)
                    or any(type(b) is not int or not 0<=b<4 for b in table) or len(set(table))!=len(table)):
                return False
            if [item for b in table for item in state["pages"][b]][:len(seq)] != seq:
                return False
            counts.update(table)
        free = state["free"]
        if sorted(free) != [b for b in range(4) if not counts[b]] or state["refs"] != [counts[b] for b in range(4)]:
            return False
        if step == "fork_prefix" and i==1:
            if state["seq"]["a"]["blocks"] != state["seq"]["b"]["blocks"]:
                return False
            metric("shared_pages",len(counts),"blocks",step,"共享前缀实际占用的物理页","Physical pages after prefix sharing")
            # Two sequences reserve 64 slots each under contiguous maximum-length allocation.
            metric("paged_slot_fraction",len(counts)*16/128,"ratio",step,"相对连续预留所需槽位比例","Slots relative to contiguous reservation")
    return True


def verify(key, step, rng, observe, metric):
    if key == "e02-paged-allocator-v1":
        return paged(step,observe,metric)
    if step == "decode_step":
        for n in (12,48,96):
            q,k,v = [rng.normal(size=(n,4)) for _ in range(3)]
            result = observe(dict(q=q.tolist(),k=k.tolist(),v=v.tolist()))
            scores = q@k.T/2
            scores[np.triu_indices(n,1)] = -np.inf
            weights = np.exp(scores-np.max(scores,axis=1,keepdims=True))
            expected = weights/weights.sum(axis=1,keepdims=True)@v
            if (result is None or not result["cache_ok"] or result["peak"]>=n*n
                    or np.shape(result["values"]) != expected.shape or not np.allclose(result["values"],expected,atol=1e-5)):
                return False
            for k,zh,en in [("cached_ms","增量","Incremental"),("full_ms","全序列重算","Full recompute")]:
                metric(k+"_"+str(n),result[k],"ms",step,f"{zh} · S={n}",f"{en} · S={n}")
        return True
    if step in ("quantize_int4_grouped","dequantize_int4_grouped"):
        for w, group in [(np.array([0.,0.,0.,0., 0.2,-0.7,0.52,-0.13, 40.,-60.,35.]),4),
                         (np.array([-1.5,-0.8,0.,1.2,3.5]),3)]:
            scales = np.array([max(abs(row))/7 or 1 for row in (w[i:i+group] for i in range(0,len(w),group))])
            expanded = np.repeat(scales,group)[:len(w)]
            codes = np.clip(np.rint(w/expanded),-7,7).astype(int)
            quant = np.pad(codes & 15,(0,len(w)%2))
            packed = (quant[::2] | (quant[1::2]<<4)).tolist()
            if step == "quantize_int4_grouped":
                result = observe(dict(w=w.tolist(),group=group))
                if result is None or not result["uint8"] or result["packed"]!=packed or not np.allclose(result["scales"],scales):
                    return False
            else:
                out = observe(dict(packed=packed,scales=scales.tolist(),length=len(w),group=group))
                if out is None or np.shape(out)!=w.shape or not np.allclose(out,codes*expanded,atol=1e-5):
                    return False
                if len(w)==11:
                    scale = max(abs(w))/7
                    global_mse = np.mean((np.rint(w/scale)*scale-w)**2)
                    grouped_mse = np.mean((np.asarray(out)-w)**2)
                    if not grouped_mse < global_mse:
                        return False
                    metric("mse_grouped",grouped_mse,"MSE",step,"分组量化误差","Grouped quantization error")
                    metric("mse_global",global_mse,"MSE",step,"全局量化误差","Global quantization error")
        return True
    # Independent worked audit cases. The interactive scheduling/plan models stay in TypeScript.
    specs, answers = [], []
    for w,g,o,tp,pp,dp,z,local,expected in [
        (140_000_000_000,0,0,8,1,1,0,3_000_000_000,20_500_000_000),
        (140_000_000_000,0,0,1,1,8,0,3_000_000_000,143_000_000_000),
        (26_000_000_000,26_000_000_000,156_000_000_000,2,1,4,1,2_000_000_000,47_500_000_000),
        (26_000_000_000,26_000_000_000,156_000_000_000,2,1,4,3,2_000_000_000,28_000_000_000),
        (31,19,41,2,2,2,2,7,24)]:
        for transfer,within_time in [(4e9,True),(80e9,False)]:
            specs.append(dict(weights=w, gradients=g, optimizer=o, tp=tp,pp=pp,dp=dp,zero=z,local=local,
                              limit=80*2**30,flops=40e12,flops_s=200e12,transfer=transfer,bandwidth=200e9,deadline_ms=500))
            answers.append([expected,expected<=80*2**30,within_time])
    return observe({"specs":specs}) == answers
