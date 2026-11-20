from collections import Counter
import numpy as np
from .gpu_sim import TrackedBuffer, launch_2d_grid


def observe(module, step, case):
    fn = getattr(module, step)
    if step in ("global_index_1d", "ceil_grid_2d"):
        return [fn(*args) for args in case["args"]]
    a, b = (np.asarray(case[k], dtype=np.float32) for k in ("a", "b"))
    h, k = a.shape
    if step == "matrix_add_kernel":
        out = np.full_like(a, -999)
        bx, by = 8, 4
        launch_2d_grid(((k+bx-1)//bx, (h+by-1)//by), (bx, by), fn,
                       bx, by, a, b, out, h, k)
        return out.tolist()
    out = np.full((h, b.shape[1]), -999, dtype=np.float32)
    counts = Counter()
    inputs = [TrackedBuffer(x, counts=counts) for x in (a, b, out)]
    fn(*inputs, case["tile"])
    return {"values": out.tolist(), "traffic": dict(counts)}
