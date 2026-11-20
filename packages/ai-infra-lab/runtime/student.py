import ast
import contextlib
import importlib.util
import json
import os
import socket
import sys
import time
import numpy as np

# Bind trusted references before any learner submission code is imported.
_np = np
_perf_counter = time.perf_counter
_shares_memory = np.shares_memory
_ast = ast


def _load_submission(submission_path: str):
    abs_path = os.path.abspath(submission_path)
    sub_dir = os.path.dirname(abs_path)
    if sub_dir not in sys.path:
        sys.path.insert(0, sub_dir)
    spec = importlib.util.spec_from_file_location("submission", abs_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load submission from {abs_path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules["submission"] = module
    spec.loader.exec_module(module)
    return module


def _function_has_python_loop(source_path: str, fn_name: str) -> tuple[bool, str]:
    with open(source_path, "r", encoding="utf-8") as f:
        tree = _ast.parse(f.read(), filename=source_path)
    loop_nodes = (
        _ast.For,
        _ast.AsyncFor,
        _ast.While,
        _ast.ListComp,
        _ast.SetComp,
        _ast.DictComp,
        _ast.GeneratorExp,
    )
    for node in tree.body:
        if isinstance(node, (_ast.FunctionDef, _ast.AsyncFunctionDef)) and node.name == fn_name:
            for child in _ast.walk(node):
                if isinstance(child, loop_nodes):
                    return True, type(child).__name__
            return False, ""
    return False, "function_not_found"


def _run_call_fn(module, payload: dict):
    fn_name = payload["fn"]
    args = payload.get("args", [])
    kwargs = payload.get("kwargs", {})
    if not hasattr(module, fn_name):
        raise AttributeError(f"Function '{fn_name}' is missing in submission.py")
    fn = getattr(module, fn_name)
    t0 = _perf_counter()
    res = fn(*args, **kwargs)
    elapsed_ms = (_perf_counter() - t0) * 1000.0
    return {"result": res, "elapsed_ms": float(max(elapsed_ms, 1e-6))}


def _run_a02_bench(module, submission_path: str, payload: dict):
    step = payload["step"]
    seed = int(payload["seed"])
    rng = _np.random.default_rng(seed)

    if step == "row_bias_broadcast":
        rows, cols = int(payload["rows"]), int(payload["cols"])
        mat = rng.normal(size=(rows, cols)).astype(_np.float32)
        bias = rng.normal(size=(cols,)).astype(_np.float32)
        out = module.row_bias_broadcast(mat, bias)
        if out is None:
            return {"is_none": True}
        arr = _np.asarray(out)
        return {
            "is_none": False,
            "is_ndarray": bool(isinstance(out, _np.ndarray)),
            "ndim": int(arr.ndim),
            "shape": list(arr.shape),
            "values": arr.astype(_np.float64).tolist(),
        }

    n = int(payload.get("n", 50000))
    a = rng.uniform(-1.0, 1.0, size=(n,)).astype(_np.float32)
    b = rng.uniform(-1.0, 1.0, size=(n,)).astype(_np.float32)

    if step == "py_loop_dot":
        val = module.py_loop_dot(a[:64], b[:64])
        if val is None:
            return {"is_none": True}
        timings = []
        full_val = None
        for _ in range(3):
            t0 = _perf_counter()
            full_val = module.py_loop_dot(a, b)
            t1 = _perf_counter()
            timings.append(max(t1 - t0, 1e-9))
        return {
            "is_none": False,
            "small_val": float(val),
            "full_val": float(full_val),
            "median_ms": float(_np.median(timings) * 1000.0),
        }

    if step == "np_vector_dot":
        has_loop, loop_kind = _function_has_python_loop(submission_path, "np_vector_dot")
        val = module.np_vector_dot(a[:64], b[:64])
        if val is None:
            return {"is_none": True, "has_loop": has_loop, "loop_kind": loop_kind}
        # Warm-up
        _ = module.np_vector_dot(a, b)
        timings = []
        full_val = None
        for _ in range(9):
            t0 = _perf_counter()
            full_val = module.np_vector_dot(a, b)
            t1 = _perf_counter()
            timings.append(max(t1 - t0, 1e-9))
        return {
            "is_none": False,
            "has_loop": has_loop,
            "loop_kind": loop_kind,
            "small_val": float(val),
            "full_val": float(full_val),
            "median_ms": float(_np.median(timings) * 1000.0),
        }

    raise ValueError(f"Unknown a02 step: {step}")


def _run_a04_bench(module, payload: dict):
    seed = int(payload["seed"])
    n = int(payload.get("n", 1000000))
    repeats = int(payload.get("repeats", 7))
    rng = _np.random.default_rng(seed)
    a = rng.uniform(-1.0, 1.0, size=(n,)).astype(_np.float32)
    b = rng.uniform(-1.0, 1.0, size=(n,)).astype(_np.float32)
    out = module.measure_dot_gflops(a, b, repeats=repeats)
    if out is None:
        return {"is_none": True}
    return {"is_none": False, "output": out}


def _run_a05_bench(module, submission_path: str, payload: dict):
    step = payload["step"]
    seed = int(payload["seed"])
    has_loop, loop_kind = _function_has_python_loop(submission_path, step)
    rng = _np.random.default_rng(seed)

    if step == "strided_view_sum":
        small = rng.uniform(-1.0, 1.0, size=(256,)).astype(_np.float32)
        res = module.strided_view_sum(small, 16, 12)
        if res is None:
            return {"is_none": True, "has_loop": has_loop, "loop_kind": loop_kind}
        if not isinstance(res, (tuple, list)) or len(res) != 2:
            raise TypeError("strided_view_sum must return a 2-tuple: (view, float_total)")
        view, total = res
        is_arr = isinstance(view, _np.ndarray)
        shares = bool(_shares_memory(small, view)) if is_arr else False
        shape = list(view.shape) if is_arr else []
        small_sum = float(total)

        # Benchmark stride=1 vs stride=16 on 16M float32 (64 MiB), summing 1,048,576 elements each
        count = 1048576
        big = _np.ones(count * 16, dtype=_np.float32)
        big[::16] = 1.25
        _ = module.strided_view_sum(big, 1, count)
        _ = module.strided_view_sum(big, 16, count)

        t_s1 = []
        t_s16 = []
        for _ in range(7):
            t0 = _perf_counter()
            v1, s1 = module.strided_view_sum(big, 1, count)
            t1 = _perf_counter()
            t_s1.append(max(t1 - t0, 1e-9))

            t2 = _perf_counter()
            v16, s16 = module.strided_view_sum(big, 16, count)
            t3 = _perf_counter()
            t_s16.append(max(t3 - t2, 1e-9))

        shares_big = bool(_shares_memory(big, v1) and _shares_memory(big, v16))
        return {
            "is_none": False,
            "has_loop": has_loop,
            "loop_kind": loop_kind,
            "is_ndarray": is_arr,
            "shares_memory": bool(shares and shares_big),
            "small_shape": shape,
            "small_sum": small_sum,
            "big_s1_shape": list(v1.shape) if isinstance(v1, _np.ndarray) else [],
            "big_s16_shape": list(v16.shape) if isinstance(v16, _np.ndarray) else [],
            "big_s1_sum": float(s1),
            "big_s16_sum": float(s16),
            "median_s1_sec": float(_np.median(t_s1)),
            "median_s16_sec": float(_np.median(t_s16)),
            "count": count,
        }

    if step in ("row_slice_sum", "col_slice_sum"):
        fn = getattr(module, step)
        small_mat = rng.uniform(-1.0, 1.0, size=(12, 16)).astype(_np.float32)
        res = fn(small_mat, 3)
        if res is None:
            return {"is_none": True, "has_loop": has_loop, "loop_kind": loop_kind}
        if not isinstance(res, (tuple, list)) or len(res) != 2:
            raise TypeError(f"{step} must return a 2-tuple: (view, float_total)")
        view, total = res
        is_arr = isinstance(view, _np.ndarray)
        shares = bool(_shares_memory(small_mat, view)) if is_arr else False
        shape = list(view.shape) if is_arr else []

        # Benchmark across 128 spaced slices of a 4096x4096 float32 matrix (64 MiB)
        dim = 4096
        big_mat = _np.ones((dim, dim), dtype=_np.float32)
        indices = list(range(0, dim, 32))  # 128 slices of length 4096
        _ = fn(big_mat, 0)
        timings = []
        shares_big = True
        last_sum = 0.0
        for _ in range(5):
            t0 = _perf_counter()
            for idx in indices:
                v_big, last_sum = fn(big_mat, idx)
            t1 = _perf_counter()
            timings.append(max(t1 - t0, 1e-9))
            if not (isinstance(v_big, _np.ndarray) and _shares_memory(big_mat, v_big)):
                shares_big = False

        return {
            "is_none": False,
            "has_loop": has_loop,
            "loop_kind": loop_kind,
            "is_ndarray": is_arr,
            "shares_memory": bool(shares and shares_big),
            "small_shape": shape,
            "small_sum": float(total),
            "big_slice_sum": float(last_sum),
            "median_batch_ms": float(_np.median(timings) * 1000.0),
        }

    raise ValueError(f"Unknown a05 step: {step}")


def _run_a06_bench(module, submission_path: str, payload: dict):
    seed = int(payload["seed"])
    workers = int(payload["workers"])
    task_count = int(payload.get("task_count", 8))
    dim = int(payload.get("dim", 320))

    with open(submission_path, "r", encoding="utf-8") as f:
        src = f.read()
    uses_mp_keyword = ("Pool" in src) or ("Process" in src)

    rng = _np.random.default_rng(seed)
    tasks = [
        (
            rng.uniform(-0.5, 0.5, size=(dim, dim)).astype(_np.float32),
            rng.uniform(-0.5, 0.5, size=(dim, dim)).astype(_np.float32),
        )
        for _ in range(task_count)
    ]

    t0 = _perf_counter()
    serial_out = module.parallel_matmul_checksums(tasks, 1)
    t1 = _perf_counter()
    if serial_out is None:
        return {"is_none": True, "uses_mp_keyword": uses_mp_keyword}

    t2 = _perf_counter()
    parallel_out = module.parallel_matmul_checksums(tasks, workers)
    t3 = _perf_counter()
    if parallel_out is None:
        return {"is_none": True, "uses_mp_keyword": uses_mp_keyword}

    return {
        "is_none": False,
        "uses_mp_keyword": uses_mp_keyword,
        "serial_out": [float(x) for x in serial_out],
        "parallel_out": [float(x) for x in parallel_out],
        "serial_ms": float(max(t1 - t0, 1e-9) * 1000.0),
        "parallel_ms": float(max(t3 - t2, 1e-9) * 1000.0),
    }


def _gloo_rank_worker(rank: int, world_size: int, seed: int, master_port: int, result_queue):
    import torch
    import torch.distributed as dist

    torch.set_num_threads(1)
    os.environ["MASTER_ADDR"] = "127.0.0.1"
    os.environ["MASTER_PORT"] = str(master_port)
    if sys.platform.startswith("linux"):
        os.environ["GLOO_SOCKET_IFNAME"] = "lo"

    dist.init_process_group(backend="gloo", rank=rank, world_size=world_size)
    try:
        gen = torch.Generator()
        gen.manual_seed(seed + rank * 101)
        vec = torch.ones(4, dtype=torch.float32) * float(rank + 1) + torch.rand(4, generator=gen, dtype=torch.float32) * 0.25
        t0 = _perf_counter()
        dist.all_reduce(vec, op=dist.ReduceOp.SUM)
        elapsed_ms = (_perf_counter() - t0) * 1000.0
        result_queue.put(
            {
                "rank": rank,
                "pid": os.getpid(),
                "values": [float(x) for x in vec.tolist()],
                "elapsed_ms": float(max(elapsed_ms, 1e-6)),
            }
        )
    finally:
        dist.destroy_process_group()


def _run_gloo_selftest(payload: dict):
    import torch.multiprocessing as mp

    seed = int(payload.get("seed", 42))
    world_size = int(payload.get("world_size", 4))
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        port = int(sock.getsockname()[1])

    os.environ["MASTER_ADDR"] = "127.0.0.1"
    os.environ["MASTER_PORT"] = str(port)
    if sys.platform.startswith("linux"):
        os.environ["GLOO_SOCKET_IFNAME"] = "lo"

    ctx = mp.get_context("spawn")
    q = ctx.SimpleQueue()
    t0 = _perf_counter()
    mp.spawn(_gloo_rank_worker, args=(world_size, seed, port, q), nprocs=world_size, join=True)
    wall_ms = (_perf_counter() - t0) * 1000.0
    ranks = [q.get() for _ in range(world_size)]
    ranks.sort(key=lambda item: item["rank"])
    return {
        "world_size": world_size,
        "wall_ms": float(max(wall_ms, 1e-6)),
        "ranks": ranks,
    }


def _json_default(obj):
    if hasattr(obj, "detach"):
        return obj.detach().cpu().tolist()
    if hasattr(obj, "tolist"):
        return obj.tolist()
    if isinstance(obj, (_np.integer,)):
        return int(obj)
    if isinstance(obj, (_np.floating,)):
        return float(obj)
    if isinstance(obj, (_np.bool_,)):
        return bool(obj)
    raise TypeError(f"Unserializable return type: {type(obj).__name__}")


def main():
    mode = sys.argv[1]
    submission_path = sys.argv[2]
    payload = json.load(sys.stdin)

    with contextlib.redirect_stdout(sys.stderr):
        if mode == "gloo_selftest":
            out = _run_gloo_selftest(payload)
        else:
            module = _load_submission(submission_path)
            if mode == "call_fn":
                out = _run_call_fn(module, payload)
            elif mode == "a02_bench":
                out = _run_a02_bench(module, submission_path, payload)
            elif mode == "a04_bench":
                out = _run_a04_bench(module, payload)
            elif mode == "a05_bench":
                out = _run_a05_bench(module, submission_path, payload)
            elif mode == "a06_bench":
                out = _run_a06_bench(module, submission_path, payload)
            else:
                raise ValueError(f"Unknown student mode: {mode}")

    print(json.dumps(out, default=_json_default, allow_nan=False), flush=True)


if __name__ == "__main__":
    main()
