"""The coordinator and its spawn children all run in the controller's unprivileged process group."""
import contextlib
import datetime
import json
import multiprocessing as mp
import os
from multiprocessing.connection import wait
import socket
import sys
import time

OPS = ("spawn", "init", "compute", "send", "irecv", "reduce_scatter_tensor", "all_gather",
       "all_reduce", "barrier", "complete", "broadcast", "reduce_scatter", "all_gather_into_tensor")
DEADLINE = 25


def _worker(rank, size, port, origin, states, hold, pipe, submission, step, case):
    os.dup2(2, 1)  # Native backend and learner stdout both go through the byte-limited stderr pipe.
    sys.stdout = sys.stderr
    import torch
    import torch.distributed as dist
    from student import _load_submission

    try:
        if (os.getuid(), os.getgid()) != (65534, 65534):
            raise RuntimeError("需要非特权进程 / Unprivileged worker required")
        os.environ.update(MASTER_ADDR="127.0.0.1", MASTER_PORT=str(port), GLOO_SOCKET_IFNAME="lo")
        torch.set_num_threads(1)
        states[rank] = OPS.index("init")
        dist.init_process_group("gloo", rank=rank, world_size=size, timeout=datetime.timedelta(seconds=35))
        baseline = None
        tensor = lambda x: torch.tensor(x, dtype=torch.float32)
        if step.startswith("ring_"):
            local = tensor(case["inputs"][rank])
            baseline = local.clone()
            dist.all_reduce(baseline)
        trace, counts = [], {}

        def monitored(name, original):
            def invoke(*args, **kwargs):
                states[rank] = OPS.index(name)
                start = time.monotonic()
                counts[name] = counts.get(name, 0) + 1
                result = original(*args, **kwargs)
                if len(trace) < 24:
                    trace.append(dict(rank=rank, op=name, startMs=(start-origin)*1000,
                                      endMs=(time.monotonic()-origin)*1000))
                return result
            return invoke

        with contextlib.ExitStack() as scope:
            for name in OPS[3:]:
                if name == "complete" or not hasattr(dist, name):
                    continue
                original = getattr(dist, name)
                setattr(dist, name, monitored(name, original))
                scope.callback(setattr, dist, name, original)
            states[rank] = OPS.index("compute")
            fn = getattr(_load_submission(submission), step)
            if step == "ring_all_gather":
                result = fn(baseline.chunk(size)[rank].clone())
            elif step.startswith("ring_"):
                result = fn(local)
            elif step == "zero_stage1":
                weight = tensor(case["weight"])
                velocity = torch.zeros_like(weight.chunk(size)[rank])
                result = None
                for gradients in case["rounds"]:
                    result = fn(weight, tensor(gradients[rank]), velocity, case["lr"], case["momentum"])
                    if result is None:
                        break
                    weight, velocity = result
                result = None if result is None else [weight.tolist(), velocity.tolist()]
            else:
                w1 = tensor(case["w1"]).chunk(size, dim=1)[rank].contiguous()
                w2 = tensor(case["w2"]).chunk(size, dim=0)[rank].contiguous()
                result = fn(tensor(case["x"]), w1, w2)
            if torch.is_tensor(result):
                result = result.detach().tolist()
            checked = None
            if baseline is not None and result is not None:
                expected = baseline.chunk(size)[rank] if step == "ring_reduce_scatter" else baseline
                checked = torch.equal(tensor(result), expected)
        states[rank] = OPS.index("complete")
        payload = dict(rank=rank, pid=os.getpid(), uid=os.getuid(), value=result, reference=checked,
                       trace=trace, counts=counts)
        pipe.send_bytes(json.dumps(payload, allow_nan=False).encode())
        hold.wait(DEADLINE + 5)
    except Exception as error:
        pipe.send_bytes(json.dumps({"error": str(error)[:350], "rank": rank}).encode())
    finally:
        pipe.close()
        if dist.is_initialized():
            dist.destroy_process_group()


def run(submission, step, case, size=4):
    if size not in (2, 3, 4) or (os.getuid(), os.getgid()) != (65534, 65534):
        raise ValueError("需要 2–4 个降权进程 / Expected 2–4 unprivileged ranks")
    ctx = mp.get_context("spawn")
    states = ctx.Array("i", size, lock=False)
    hold = ctx.Event()
    processes, readers, results = [], [], []
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
    origin = time.monotonic()
    try:
        for rank in range(size):
            reader, writer = ctx.Pipe(duplex=False)
            worker = ctx.Process(target=_worker, args=(rank,size,port,origin,states,hold,writer,submission,step,case))
            worker.start()
            writer.close()
            readers.append(reader)
            processes.append(worker)
        while readers:
            ready = wait(readers, max(0, origin + DEADLINE - time.monotonic()))
            if not ready:
                raise TimeoutError("25 秒通信超时，请核对所有 rank 的调用次序和张量形状 / "
                                   "25 s collective timeout. Check call order and tensor shapes on every rank.")
            for reader in ready:
                packet = json.loads(reader.recv_bytes(32768))
                if "error" in packet:
                    raise RuntimeError(f"rank {packet['rank']}: {packet['error']}")
                results.append(packet)
                readers.remove(reader)
                reader.close()
        return {"ranks": sorted(results,key=lambda r:r["rank"])}
    except Exception as error:
        last = ", ".join(f"rank {r}={OPS[states[r]]}" for r in range(size))
        return {"diagnosis": str(error)[:600] + " · " + last}
    finally:
        hold.set()
        for reader in readers:
            reader.close()
        for worker in processes:
            worker.join(timeout=0.15)
            if worker.is_alive():
                worker.kill()
            worker.join(timeout=1)
