"""Root-side oracles. Only JSON crosses the learner process boundary."""
import numpy as np
import oracle_c
import oracle_d
import oracle_e

STEPS = {
    **oracle_c.STEPS,
    **oracle_d.STEPS,
    **oracle_e.STEPS,
    "b03-grid-map-v1": ["global_index_1d", "ceil_grid_2d", "matrix_add_kernel"],
    "b05-tiled-matmul-v1": ["naive_matmul_step", "tiled_matmul_step"],
}


def verify(stage_key, step, rng, call, metric, emit, config):
    if stage_key in oracle_d.STEPS:
        return oracle_d.verify(stage_key, step, rng, call, metric, emit, config.get("world_size", 4))

    def observe(case):
        return call("lab_step", {"key": stage_key, "step": step, "case": case})

    if stage_key in oracle_c.STEPS:
        return oracle_c.verify(step, rng, observe, metric)
    if stage_key in oracle_e.STEPS:
        return oracle_e.verify(stage_key, step, rng, observe, metric)
    if step == "global_index_1d":
        args = [[0, 0, 8], [2, 3, 8], [9, 15, 16]]
        return observe({"args": args}) == [x*d+t for x, t, d in args]
    if step == "ceil_grid_2d":
        args = [[35, 50, 4, 8], [8, 8, 4, 8], [1, 2, 4, 8]]
        return observe({"args": args}) == [[(w+tw-1)//tw, (h+th-1)//th] for h, w, th, tw in args]
    if step == "matrix_add_kernel":
        for shape in [(35, 50), (1, 3)]:
            a, b = rng.integers(-8, 9, (2, *shape))
            actual = observe({"a": a.tolist(), "b": b.tolist()})
            if not np.array_equal(actual, a+b):
                return False
        return True

    tile = 16
    for h, k, w in [(16, 16, 16), (32, 48, 16)]:
        a = rng.integers(-4, 5, (h, k))
        b = rng.integers(-4, 5, (k, w))
        actual = observe({"a": a.tolist(), "b": b.tolist(), "tile": tile})
        counts = actual["traffic"]
        naive_reads = 2*h*k*w
        tiled = step == "tiled_matmul_step"
        expected = {"hbm_reads": naive_reads//tile if tiled else naive_reads, "hbm_writes": h*w,
                    "sram_reads": naive_reads if tiled else 0, "sram_writes": naive_reads//tile if tiled else 0}
        if not np.array_equal(actual["values"], a@b):
            return False
        for field, n in expected.items():
            if counts.get(field, 0) != n or counts.get(field+"_bytes", 0) != n*4:
                return False
    for field in expected:
        space, op = field.split("_")
        zh = ("显存" if space == "hbm" else "片上存储") + ("读取" if op == "reads" else "写入")
        metric(field, counts.get(field, 0), "elements", step, zh+"元素数", space.upper()+" "+op+" (elements)")
        metric(field+"_bytes", counts.get(field+"_bytes", 0), "B", step, zh+"字节数", space.upper()+" "+op+" (bytes)")
    return True


GUIDANCE = {
    **oracle_c.GUIDANCE,
    **oracle_d.GUIDANCE,
    **oracle_e.GUIDANCE,
    "global_index_1d": ("从块的首元素向右数线程偏移。", "Count the thread offset from the first element of its block."),
    "ceil_grid_2d": ("分别向上取整宽和高，按 x、y 顺序返回。", "Round width and height up separately and return x before y."),
    "matrix_add_kernel": ("检查最后一个块中行、列两个边界和输出写入。", "Check both edges of the last block and write each valid output once."),
    "naive_matmul_step": ("每次乘加读取两个显存元素，每个输出只写回一次。", "Read two HBM elements per multiply-add and store each output once."),
    "tiled_matmul_step": ("先完整装入两块片上缓冲，再复用每个值 16 次，最后写回。", "Fill both scratch tiles, reuse each value 16 times, then write the final output."),
}
