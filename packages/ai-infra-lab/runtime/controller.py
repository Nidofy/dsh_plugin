import json
import math
import os
import shutil
import signal
import stat
import subprocess
import sys
import tempfile
import threading
import traceback
import numpy as np

MAX_STUDENT_OUTPUT_BYTES = min(131072, max(4096, int(sys.argv[5]))) if len(sys.argv) > 5 else 131072
STUDENT_TIMEOUT_SEC = 30

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
IS_ROOT = hasattr(os, "getuid") and os.getuid() == 0

if len(sys.argv) < 4:
    print("Usage: controller.py <runtimeKey> <runId> <seed> [configJson]", file=sys.stderr)
    sys.exit(1)

key = sys.argv[1]
run_id = sys.argv[2]
seed = int(sys.argv[3])
raw_config = json.loads(sys.argv[4]) if len(sys.argv) > 4 and sys.argv[4].strip() else {}
if not isinstance(raw_config, dict):
    raise ValueError("configJson must decode to a JSON object")

rng = np.random.default_rng(seed)
seq = 0
staged_dir = None
student_script_path = None
submission_file_path = None


def stage_files():
    global staged_dir, student_script_path, submission_file_path
    src_student = "/runtime/student.py" if os.path.exists("/runtime/student.py") else os.path.join(SCRIPT_DIR, "student.py")
    src_submission = "/work/submission.py"
    if not os.path.exists(src_submission) and not IS_ROOT:
        env_sub = os.environ.get("AI_INFRA_SUBMISSION_PATH", "")
        if env_sub and os.path.exists(env_sub):
            src_submission = env_sub

    if IS_ROOT:
        parent = os.stat("/tmp")
        if parent.st_uid != 0 or not (parent.st_mode & stat.S_ISVTX):
            raise RuntimeError("/tmp must be root-owned (uid=0) with sticky bit (S_ISVTX) set")
        directory = tempfile.mkdtemp(prefix="ai-infra-lab-student-", dir="/tmp")
        try:
            dst_student = os.path.join(directory, "student.py")
            with open(src_student, "rb") as sf, open(dst_student, "xb") as tf:
                shutil.copyfileobj(sf, tf)
            os.chmod(dst_student, 0o444)

            dst_submission = os.path.join(directory, "submission.py")
            if os.path.exists(src_submission):
                with open(src_submission, "rb") as sf, open(dst_submission, "xb") as tf:
                    shutil.copyfileobj(sf, tf)
            elif key == "d00-gloo-selftest-v1":
                with open(dst_submission, "xb") as tf:
                    tf.write(b"# gloo internal selftest\n")
            else:
                raise FileNotFoundError(f"Missing learner submission at {src_submission}")
            os.chmod(dst_submission, 0o444)
            os.chmod(directory, 0o555)

            staged_dir = directory
            student_script_path = dst_student
            submission_file_path = dst_submission
        except BaseException:
            os.chmod(directory, 0o700)
            shutil.rmtree(directory, ignore_errors=True)
            raise
    else:
        student_script_path = src_student
        if os.path.exists(src_submission):
            submission_file_path = src_submission
        elif key == "d00-gloo-selftest-v1":
            submission_file_path = src_student
        else:
            raise FileNotFoundError(f"Missing learner submission at {src_submission}")


def cleanup_staged():
    if staged_dir is not None and os.path.exists(staged_dir):
        os.chmod(staged_dir, 0o700)
        shutil.rmtree(staged_dir, ignore_errors=True)


def _kill_process_group(proc: subprocess.Popen):
    if hasattr(os, "killpg"):
        try:
            os.killpg(proc.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        except PermissionError:
            try:
                proc.kill()
            except OSError:
                pass
    else:
        try:
            proc.kill()
        except OSError:
            pass


class StudentOutputLimit(RuntimeError):
    pass


def call_student(mode: str, payload: dict, timeout: int = STUDENT_TIMEOUT_SEC) -> dict:
    child_env = {
        "PATH": os.environ.get("PATH", "/usr/local/bin:/usr/bin:/bin"),
        "PYTHONDONTWRITEBYTECODE": "1",
        "PYTHONUNBUFFERED": "1",
        "PYTHONPATH": SCRIPT_DIR,
        "OMP_NUM_THREADS": "1",
        "OPENBLAS_NUM_THREADS": "1",
        "MKL_NUM_THREADS": "1",
        "NUMEXPR_NUM_THREADS": "1",
        "VECLIB_MAXIMUM_THREADS": "1",
        "HOME": "/tmp" if os.path.isdir("/tmp") else tempfile.gettempdir(),
        "TMPDIR": "/tmp" if os.path.isdir("/tmp") else tempfile.gettempdir(),
    }
    if os.name == "nt":
        for win_key in ("SYSTEMROOT", "WINDIR", "COMSPEC", "TEMP", "TMP", "PATHEXT"):
            if win_key in os.environ:
                child_env[win_key] = os.environ[win_key]

    popen_kwargs = dict(
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        start_new_session=True,
        env=child_env,
        cwd="/tmp" if os.path.isdir("/tmp") else None,
    )
    if IS_ROOT:
        popen_kwargs["user"] = 65534
        popen_kwargs["group"] = 65534
        popen_kwargs["extra_groups"] = []

    proc = subprocess.Popen(
        [sys.executable, student_script_path, mode, submission_file_path],
        **popen_kwargs,
    )
    out_buf = bytearray()
    err_buf = bytearray()
    overflow = threading.Event()
    timed_out = False
    budget_lock = threading.Lock()

    def drain(stream, target: bytearray):
        while True:
            chunk = stream.read(4096)
            if not chunk:
                break
            with budget_lock:
                if len(out_buf) + len(err_buf) + len(chunk) > MAX_STUDENT_OUTPUT_BYTES:
                    overflow.set()
                    _kill_process_group(proc)
                    break
                target.extend(chunk)

    threads = [
        threading.Thread(daemon=True, target=drain, args=(proc.stdout, out_buf)),
        threading.Thread(daemon=True, target=drain, args=(proc.stderr, err_buf)),
    ]
    for t in threads:
        t.start()

    try:
        proc.stdin.write(json.dumps(payload, allow_nan=False).encode("utf-8"))
        proc.stdin.close()
        proc.wait(timeout=timeout)
    except subprocess.TimeoutExpired:
        timed_out = True
        _kill_process_group(proc)
        proc.wait()
    except BrokenPipeError:
        _kill_process_group(proc)
        proc.wait()
    finally:
        _kill_process_group(proc)
        for t in threads:
            t.join(timeout=2)

    if any(t.is_alive() for t in threads):
        raise RuntimeError("Student child process retained output pipe after group termination")

    err_text = err_buf.decode("utf-8", errors="replace")
    if err_text.strip():
        print("[student stderr]", err_text[-3500:], file=sys.stderr, flush=True)

    if overflow.is_set():
        raise StudentOutputLimit(f"子进程输出已达上限 / Student output exceeded {MAX_STUDENT_OUTPUT_BYTES} bytes limit")
    if timed_out:
        raise TimeoutError(f"Student execution timed out after {timeout}s")
    if proc.returncode != 0:
        tail = err_text.strip()[-1800:] or f"Student exited with code {proc.returncode}"
        raise RuntimeError(tail)

    lines = out_buf.decode("utf-8", errors="replace").splitlines()
    if len(lines) != 1:
        raise RuntimeError(f"Protocol error: expected 1 JSON line from student, got {len(lines)}")
    return json.loads(lines[0])


def emit(kind: str, name: str, **fields):
    global seq
    seq += 1
    clean = {"runId": run_id, "seq": seq, "type": kind, "name": str(name)[:200]}
    for k, v in fields.items():
        if v is not None:
            clean[k] = v
    print(json.dumps(clean, allow_nan=False), flush=True)


def emit_check(name: str, step: str, passed: bool, detail: str):
    emit("check", name, step=step, passed=bool(passed), detail=str(detail)[:3800])


def emit_metric(name: str, value: float, unit: str, step: str | None = None):
    val = float(value)
    if not math.isfinite(val):
        return
    emit("metric", name, step=step, value=round(val, 6), unit=unit)


def emit_roofline(name: str, ai: float, gflops: float, bw_gbps: float, step: str | None = None):
    ai_f, gf_f, bw_f = float(ai), float(gflops), float(bw_gbps)
    if all(math.isfinite(x) and x > 0 for x in (ai_f, gf_f, bw_f)):
        emit(
            "roofline_point",
            name,
            step=step,
            arithmeticIntensity=round(ai_f, 6),
            gflops=round(gf_f, 6),
            bandwidthGBps=round(bw_f, 6),
        )


def detect_effective_cpus() -> float:
    try:
        affinity = float(len(os.sched_getaffinity(0)))
    except AttributeError:
        affinity = float(os.cpu_count() or 1)

    quota_cpus = affinity
    # cgroup v2
    try:
        if os.path.exists("/sys/fs/cgroup/cpu.max"):
            raw = open("/sys/fs/cgroup/cpu.max", "r", encoding="utf-8").read().strip().split()
            if len(raw) == 2 and raw[0] != "max":
                q, p = float(raw[0]), float(raw[1])
                if q > 0 and p > 0:
                    quota_cpus = min(quota_cpus, q / p)
    except OSError:
        pass
    # cgroup v1
    try:
        q_path = "/sys/fs/cgroup/cpu/cpu.cfs_quota_us"
        p_path = "/sys/fs/cgroup/cpu/cpu.cfs_period_us"
        if os.path.exists(q_path) and os.path.exists(p_path):
            q = float(open(q_path, "r", encoding="utf-8").read().strip())
            p = float(open(p_path, "r", encoding="utf-8").read().strip())
            if q > 0 and p > 0:
                quota_cpus = min(quota_cpus, q / p)
    except OSError:
        pass

    return max(0.25, min(affinity, quota_cpus))


def run_a00():
    # Step 1: greet_machine
    try:
        cases = [("CPU-Sandbox", 1), ("Node-A", 4)]
        for dev, cores in cases:
            expected = f"Hello {dev}, ready with {cores} cores!"
            resp = call_student("call_fn", {"fn": "greet_machine", "args": [dev, cores]})
            actual = resp["result"]
            if actual is None:
                emit_check(
                    "greet_machine_format",
                    "greet_machine",
                    False,
                    f"TODO not completed yet: greet_machine('{dev}', {cores}) returned None; expected '{expected}'.",
                )
                break
            if actual != expected:
                emit_check(
                    "greet_machine_format",
                    "greet_machine",
                    False,
                    f"Mismatch for greet_machine('{dev}', {cores}): expected={expected!r}, actual={actual!r}.",
                )
                break
        else:
            emit_check(
                "greet_machine_format",
                "greet_machine",
                True,
                "All greeting strings matched expected format!",
            )
    except Exception as e:
        emit_check("greet_machine_format", "greet_machine", False, f"Error in greet_machine: {e}")

    # Step 2: add_shapes
    try:
        a_rand = int(rng.integers(64, 1024))
        b_rand = int(rng.integers(64, 1024))
        cases = [(100, 250), (1024, 2048), (a_rand, b_rand)]
        latencies = []
        for ca, cb in cases:
            expected = ca + cb
            resp = call_student("call_fn", {"fn": "add_shapes", "args": [ca, cb]})
            actual = resp["result"]
            latencies.append(resp["elapsed_ms"])
            if actual is None:
                emit_check(
                    "add_shapes_sum",
                    "add_shapes",
                    False,
                    f"TODO not completed yet: add_shapes({ca}, {cb}) returned None; expected {expected}.",
                )
                break
            if actual != expected:
                emit_check(
                    "add_shapes_sum",
                    "add_shapes",
                    False,
                    f"Mismatch for add_shapes({ca}, {cb}): expected={expected}, actual={actual!r}.",
                )
                break
        else:
            emit_metric("sandbox_call_latency", float(np.median(latencies)), "ms", step="add_shapes")
            emit_check(
                "add_shapes_sum",
                "add_shapes",
                True,
                f"Verified element count sums across 3 cases (including seeded {a_rand} + {b_rand} = {a_rand + b_rand}).",
            )
    except Exception as e:
        emit_check("add_shapes_sum", "add_shapes", False, f"Error in add_shapes: {e}")


def run_a01():
    # Step 1: scale_list
    try:
        sample = [round(float(x), 2) for x in rng.uniform(-5, 5, size=5)]
        cases = [([1.0, 2.0, 3.0], 2.5), ([], 4.0), (sample, -1.5)]
        for vals, factor in cases:
            expected = [x * factor for x in vals]
            resp = call_student("call_fn", {"fn": "scale_list", "args": [vals, factor]})
            actual = resp["result"]
            if actual is None:
                emit_check("scale_list_check", "scale_list", False, "TODO not completed: scale_list returned None.")
                break
            if not isinstance(actual, list) or len(actual) != len(expected) or not np.allclose(actual, expected, atol=1e-6):
                emit_check(
                    "scale_list_check",
                    "scale_list",
                    False,
                    f"scale_list({vals}, {factor}) -> expected {expected}, got {actual!r}.",
                )
                break
        else:
            emit_check("scale_list_check", "scale_list", True, "Scaled all list test cases accurately.")
    except Exception as e:
        emit_check("scale_list_check", "scale_list", False, f"Error in scale_list: {e}")

    # Step 2: pair_multiply_sum
    try:
        va = [round(float(x), 2) for x in rng.uniform(-4, 4, size=6)]
        vb = [round(float(x), 2) for x in rng.uniform(-4, 4, size=6)]
        cases = [([1.0, 2.0, 3.0], [10.0, 20.0, 30.0]), ([], []), (va, vb)]
        elapsed = 0.0
        for a, b in cases:
            expected = sum(x * y for x, y in zip(a, b))
            resp = call_student("call_fn", {"fn": "pair_multiply_sum", "args": [a, b]})
            actual = resp["result"]
            elapsed = resp["elapsed_ms"]
            if actual is None:
                emit_check(
                    "pair_multiply_sum_check",
                    "pair_multiply_sum",
                    False,
                    "TODO not completed: pair_multiply_sum returned None.",
                )
                break
            if not isinstance(actual, (int, float)) or not math.isclose(float(actual), expected, rel_tol=1e-6, abs_tol=1e-6):
                emit_check(
                    "pair_multiply_sum_check",
                    "pair_multiply_sum",
                    False,
                    f"pair_multiply_sum({a}, {b}) -> expected {expected:.4f}, got {actual!r}.",
                )
                break
        else:
            emit_metric("pair_dot_call_ms", elapsed, "ms", step="pair_multiply_sum")
            emit_check("pair_multiply_sum_check", "pair_multiply_sum", True, "Pairwise product sums matched across all cases.")
    except Exception as e:
        emit_check("pair_multiply_sum_check", "pair_multiply_sum", False, f"Error in pair_multiply_sum: {e}")

    # Step 3: chunk_ranges
    try:
        rand_total = int(rng.integers(13, 29))
        cases = [(10, 4), (8, 4), (7, 3), (0, 4), (rand_total, 5)]
        for total, csize in cases:
            expected = [[s, min(s + csize, total)] for s in range(0, total, csize)]
            resp = call_student("call_fn", {"fn": "chunk_ranges", "args": [total, csize]})
            actual = resp["result"]
            if actual is None:
                emit_check(
                    "chunk_ranges_check",
                    "chunk_ranges",
                    False,
                    "TODO not completed: chunk_ranges returned None.",
                )
                break
            normalized = [list(item) if isinstance(item, (list, tuple)) else item for item in actual] if isinstance(actual, list) else actual
            if normalized != expected:
                emit_check(
                    "chunk_ranges_check",
                    "chunk_ranges",
                    False,
                    f"chunk_ranges({total}, {csize}) -> expected {expected}, got {actual!r}.",
                )
                break
        else:
            emit_check("chunk_ranges_check", "chunk_ranges", True, "Interval chunk splitting handled exact multiples and tail chunks cleanly.")
    except Exception as e:
        emit_check("chunk_ranges_check", "chunk_ranges", False, f"Error in chunk_ranges: {e}")


def run_a02():
    # Step 1: row_bias_broadcast (strictly 2D + 1D)
    try:
        for rows, cols in [(4, 6), (9, 5)]:
            sub_seed = int(rng.integers(1, 1_000_000))
            local_rng = np.random.default_rng(sub_seed)
            mat = local_rng.normal(size=(rows, cols)).astype(np.float32)
            bias = local_rng.normal(size=(cols,)).astype(np.float32)
            expected = mat + bias
            resp = call_student("a02_bench", {"step": "row_bias_broadcast", "seed": sub_seed, "rows": rows, "cols": cols})
            if resp.get("is_none"):
                emit_check(
                    "row_bias_broadcast_2d",
                    "row_bias_broadcast",
                    False,
                    "TODO not completed: row_bias_broadcast returned None.",
                )
                break
            got = np.asarray(resp["values"], dtype=np.float32)
            if resp["ndim"] != 2 or tuple(resp["shape"]) != (rows, cols) or not np.allclose(got, expected, rtol=1e-5, atol=1e-5):
                emit_check(
                    "row_bias_broadcast_2d",
                    "row_bias_broadcast",
                    False,
                    f"Expected 2D shape {(rows, cols)} matching matrix_2d + bias_1d, got shape {tuple(resp['shape'])}.",
                )
                break
        else:
            emit_check(
                "row_bias_broadcast_2d",
                "row_bias_broadcast",
                True,
                "2D row broadcasting produced exact (rows, cols) outputs.",
            )
    except Exception as e:
        emit_check("row_bias_broadcast_2d", "row_bias_broadcast", False, f"Error in row_bias_broadcast: {e}")

    # Shared seed for comparing py_loop_dot vs np_vector_dot on identical 50,000-element 1D vectors
    bench_seed = int(rng.integers(1, 1_000_000))
    bench_n = 50000
    local_rng = np.random.default_rng(bench_seed)
    a_ref = local_rng.uniform(-1.0, 1.0, size=(bench_n,)).astype(np.float32)
    b_ref = local_rng.uniform(-1.0, 1.0, size=(bench_n,)).astype(np.float32)
    expected_small = float(np.dot(a_ref[:64].astype(np.float64), b_ref[:64].astype(np.float64)))
    expected_full = float(np.dot(a_ref.astype(np.float64), b_ref.astype(np.float64)))

    py_ms = None
    # Step 2: py_loop_dot
    try:
        resp_py = call_student("a02_bench", {"step": "py_loop_dot", "seed": bench_seed, "n": bench_n})
        if resp_py.get("is_none"):
            emit_check("py_loop_dot_baseline", "py_loop_dot", False, "TODO not completed: py_loop_dot returned None.")
        elif not (
            math.isclose(resp_py["small_val"], expected_small, rel_tol=1e-4, abs_tol=1e-4)
            and math.isclose(resp_py["full_val"], expected_full, rel_tol=2e-3, abs_tol=2e-2)
        ):
            emit_check(
                "py_loop_dot_baseline",
                "py_loop_dot",
                False,
                f"Numerical mismatch in py_loop_dot: expected ~{expected_full:.4f}, got {resp_py['full_val']:.4f}.",
            )
        else:
            py_ms = float(resp_py["median_ms"])
            emit_metric("py_loop_dot_ms", py_ms, "ms", step="py_loop_dot")
            emit_check(
                "py_loop_dot_baseline",
                "py_loop_dot",
                True,
                f"Pure Python loop dot product (N={bench_n}) median latency: {py_ms:.3f} ms.",
            )
    except Exception as e:
        emit_check("py_loop_dot_baseline", "py_loop_dot", False, f"Error in py_loop_dot: {e}")

    # Step 3: np_vector_dot
    try:
        resp_np = call_student("a02_bench", {"step": "np_vector_dot", "seed": bench_seed, "n": bench_n})
        if resp_np.get("is_none"):
            emit_check("np_vector_dot_speedup", "np_vector_dot", False, "TODO not completed: np_vector_dot returned None.")
        elif resp_np.get("has_loop"):
            emit_check(
                "np_vector_dot_speedup",
                "np_vector_dot",
                False,
                f"Python loop/comprehension ({resp_np.get('loop_kind')}) detected inside np_vector_dot! Use NumPy vectorization (np.dot) directly.",
            )
        elif not (
            math.isclose(resp_np["small_val"], expected_small, rel_tol=1e-4, abs_tol=1e-4)
            and math.isclose(resp_np["full_val"], expected_full, rel_tol=2e-3, abs_tol=2e-2)
        ):
            emit_check(
                "np_vector_dot_speedup",
                "np_vector_dot",
                False,
                f"Numerical mismatch in np_vector_dot: expected ~{expected_full:.4f}, got {resp_np['full_val']:.4f}.",
            )
        else:
            np_ms = float(resp_np["median_ms"])
            emit_metric("np_vector_dot_ms", np_ms, "ms", step="np_vector_dot")
            if py_ms is not None and np_ms > 0:
                speedup = py_ms / np_ms
                emit_metric("vectorization_speedup", speedup, "x", step="np_vector_dot")
                emit_check(
                    "np_vector_dot_speedup",
                    "np_vector_dot",
                    True,
                    f"NumPy vectorized dot median {np_ms:.4f} ms vs Python loop {py_ms:.3f} ms ({speedup:.1f}x faster!).",
                )
            else:
                emit_check(
                    "np_vector_dot_speedup",
                    "np_vector_dot",
                    True,
                    f"NumPy vectorized dot passed ({np_ms:.4f} ms); complete py_loop_dot to compare speedup.",
                )
    except Exception as e:
        emit_check("np_vector_dot_speedup", "np_vector_dot", False, f"Error in np_vector_dot: {e}")


def run_a03():
    # Step 1: detect_fp16_overflow
    try:
        test_vals = [0.0, 3.14, 65504.0, 65520.0, 70000.0, -70000.0, -65000.0]
        with np.errstate(over="ignore"):
            expected = [bool(x) for x in np.isinf(np.asarray(test_vals, dtype=np.float16))]
        resp = call_student("call_fn", {"fn": "detect_fp16_overflow", "args": [test_vals]})
        actual = resp["result"]
        if actual is None:
            emit_check(
                "detect_fp16_overflow_check",
                "detect_fp16_overflow",
                False,
                "TODO not completed: detect_fp16_overflow returned None.",
            )
        elif not isinstance(actual, list) or [bool(x) for x in actual] != expected or any(not isinstance(x, bool) for x in actual):
            emit_check(
                "detect_fp16_overflow_check",
                "detect_fp16_overflow",
                False,
                f"For {test_vals}, expected list[bool] {expected}, got {actual!r}.",
            )
        else:
            emit_check(
                "detect_fp16_overflow_check",
                "detect_fp16_overflow",
                True,
                "Correctly identified FP16 max finite boundary (65504 -> finite, >=65520/70000 -> inf).",
            )
    except Exception as e:
        emit_check("detect_fp16_overflow_check", "detect_fp16_overflow", False, f"Error in detect_fp16_overflow: {e}")

    # Step 2: swallow_small_delta
    try:
        cases = [(1e8, 1.0, 4096), (1e8, 1.0, 2048)]
        for big_base, small_delta, repeat in cases:
            resp = call_student("call_fn", {"fn": "swallow_small_delta", "args": [big_base, small_delta, repeat]})
            actual = resp["result"]
            if actual is None:
                emit_check(
                    "swallow_small_delta_check",
                    "swallow_small_delta",
                    False,
                    "TODO not completed: swallow_small_delta returned None.",
                )
                break
            if not isinstance(actual, dict) or "naive" not in actual or "mitigated" not in actual:
                emit_check(
                    "swallow_small_delta_check",
                    "swallow_small_delta",
                    False,
                    f"Expected dict with keys 'naive' and 'mitigated', got {actual!r}.",
                )
                break
            naive_val = float(actual["naive"])
            mit_val = float(actual["mitigated"])
            exact_target = big_base + small_delta * repeat
            if naive_val != 1e8:
                emit_check(
                    "swallow_small_delta_check",
                    "swallow_small_delta",
                    False,
                    f"Expected naive float32 accumulation from 1e8 + 1.0*{repeat} to be swamped at 100000000.0, got {naive_val} (make sure acc stays np.float32!).",
                )
                break
            if abs(mit_val - exact_target) > 1.0:
                emit_check(
                    "swallow_small_delta_check",
                    "swallow_small_delta",
                    False,
                    f"Expected mitigated sum to recover {exact_target:.1f}, got {mit_val:.1f}.",
                )
                break
        else:
            emit_metric("naive_swamped_error", 4096.0, "scalar", step="swallow_small_delta")
            emit_metric("mitigated_error", 0.0, "scalar", step="swallow_small_delta")
            emit_check(
                "swallow_small_delta_check",
                "swallow_small_delta",
                True,
                "Reproduced float32 swamping (naive lost 4096.0) and recovered exact 100004096.0 via chunked accumulation!",
            )
    except Exception as e:
        emit_check("swallow_small_delta_check", "swallow_small_delta", False, f"Error in swallow_small_delta: {e}")


def run_a04():
    # Step 1: dot_flops_count
    flops_ok = False
    try:
        rand_n = int(rng.integers(1000, 500000))
        for n_val in (128, 1_000_000, rand_n):
            resp = call_student("call_fn", {"fn": "dot_flops_count", "args": [n_val]})
            actual = resp["result"]
            if actual is None:
                emit_check("dot_flops_formula", "dot_flops_count", False, "TODO not completed: dot_flops_count returned None.")
                break
            if int(actual) != 2 * n_val:
                emit_check(
                    "dot_flops_formula",
                    "dot_flops_count",
                    False,
                    f"dot_flops_count({n_val}) -> expected {2 * n_val} (1 mul + 1 add per element), got {actual!r}.",
                )
                break
        else:
            flops_ok = True
            emit_check("dot_flops_formula", "dot_flops_count", True, "Theoretical dot-product FLOPs (2N) verified.")
    except Exception as e:
        emit_check("dot_flops_formula", "dot_flops_count", False, f"Error in dot_flops_count: {e}")

    # Step 2: measure_dot_gflops
    try:
        n_vec = 1_000_000
        bench_seed = int(rng.integers(1, 1_000_000))
        local_rng = np.random.default_rng(bench_seed)
        a = local_rng.uniform(-1.0, 1.0, size=(n_vec,)).astype(np.float32)
        b = local_rng.uniform(-1.0, 1.0, size=(n_vec,)).astype(np.float32)
        expected_dot = float(np.dot(a, b))

        resp = call_student("a04_bench", {"seed": bench_seed, "n": n_vec, "repeats": 7})
        if resp.get("is_none"):
            emit_check("measure_dot_gflops_check", "measure_dot_gflops", False, "TODO not completed: measure_dot_gflops returned None.")
            return
        out = resp["output"]
        if not isinstance(out, dict) or not {"dot_value", "elapsed_sec", "gflops"}.issubset(out.keys()):
            emit_check(
                "measure_dot_gflops_check",
                "measure_dot_gflops",
                False,
                f"Expected dict with keys 'dot_value', 'elapsed_sec', 'gflops'; got {out!r}.",
            )
            return

        dot_val = float(out["dot_value"])
        elapsed_sec = float(out["elapsed_sec"])
        gflops = float(out["gflops"])
        if not (math.isfinite(dot_val) and math.isfinite(elapsed_sec) and math.isfinite(gflops)) or elapsed_sec <= 0 or gflops <= 0:
            emit_check(
                "measure_dot_gflops_check",
                "measure_dot_gflops",
                False,
                f"Timing and GFLOP/s must be positive finite numbers, got elapsed_sec={elapsed_sec}, gflops={gflops}.",
            )
            return

        if not math.isclose(dot_val, expected_dot, rel_tol=1e-3, abs_tol=1e-1):
            emit_check(
                "measure_dot_gflops_check",
                "measure_dot_gflops",
                False,
                f"dot_value mismatch: expected ~{expected_dot:.3f}, got {dot_val:.3f}.",
            )
            return

        expected_gflops = (2.0 * n_vec) / elapsed_sec / 1e9
        if not math.isclose(gflops, expected_gflops, rel_tol=0.02, abs_tol=1e-6):
            emit_check(
                "measure_dot_gflops_check",
                "measure_dot_gflops",
                False,
                f"GFLOP/s formula mismatch: for N={n_vec} and elapsed_sec={elapsed_sec:.6f}s, expected 2*N/elapsed_sec/1e9 = {expected_gflops:.4f}, got {gflops:.4f}.",
            )
            return

        bw_gbps = (8.0 * n_vec) / elapsed_sec / 1e9
        emit_metric("dot_median_ms", elapsed_sec * 1000.0, "ms", step="measure_dot_gflops")
        emit_metric("dot_measured_gflops", gflops, "GFLOP/s", step="measure_dot_gflops")
        emit_metric("dot_effective_bw", bw_gbps, "GB/s", step="measure_dot_gflops")
        emit_roofline("a04_simd_dot_fp32", 0.25, gflops, bw_gbps, step="measure_dot_gflops")
        emit_check(
            "measure_dot_gflops_check",
            "measure_dot_gflops",
            bool(flops_ok or True),
            f"Measured N=1,000,000 SIMD dot: {elapsed_sec * 1000.0:.3f} ms ({gflops:.2f} GFLOP/s, {bw_gbps:.2f} GB/s at AI=0.25 FLOPs/B).",
        )
    except Exception as e:
        emit_check("measure_dot_gflops_check", "measure_dot_gflops", False, f"Error in measure_dot_gflops: {e}")


def run_a05():
    bench_seed = int(rng.integers(1, 1_000_000))
    local_rng = np.random.default_rng(bench_seed)

    # Step 1: strided_view_sum
    try:
        small = local_rng.uniform(-1.0, 1.0, size=(256,)).astype(np.float32)
        expected_small_sum = float(small[: 12 * 16 : 16].sum())
        resp = call_student("a05_bench", {"step": "strided_view_sum", "seed": bench_seed})
        if resp.get("is_none"):
            emit_check("strided_view_sum_check", "strided_view_sum", False, "TODO not completed: strided_view_sum returned None.")
        elif resp.get("has_loop"):
            emit_check(
                "strided_view_sum_check",
                "strided_view_sum",
                False,
                f"Forbidden Python loop/comprehension ({resp.get('loop_kind')}) in strided_view_sum — use NumPy slice view + .sum()!",
            )
        elif not resp.get("is_ndarray") or not resp.get("shares_memory"):
            emit_check(
                "strided_view_sum_check",
                "strided_view_sum",
                False,
                "np.shares_memory(arr_1d, view) was False! Use basic slicing arr_1d[:count*stride:stride] instead of fancy indexing or .copy().",
            )
        elif resp["small_shape"] != [12] or resp["big_s1_shape"] != [resp["count"]] or resp["big_s16_shape"] != [resp["count"]]:
            emit_check(
                "strided_view_sum_check",
                "strided_view_sum",
                False,
                f"View length mismatch: expected shape [12] on small test and [{resp['count']}] on benchmark, got {resp['small_shape']} / {resp['big_s16_shape']}.",
            )
        elif not math.isclose(resp["small_sum"], expected_small_sum, rel_tol=1e-4, abs_tol=1e-4) or not math.isclose(
            resp["big_s16_sum"], resp["count"] * 1.25, rel_tol=1e-3, abs_tol=1.0
        ):
            emit_check(
                "strided_view_sum_check",
                "strided_view_sum",
                False,
                f"Sum mismatch in strided_view_sum: expected {expected_small_sum:.4f}, got {resp['small_sum']:.4f}.",
            )
        else:
            count = int(resp["count"])
            s1_sec = float(resp["median_s1_sec"])
            s16_sec = float(resp["median_s16_sec"])
            ns_s1 = (s1_sec * 1e9) / count
            ns_s16 = (s16_sec * 1e9) / count
            ratio = s16_sec / max(s1_sec, 1e-9)
            emit_metric("stride1_ns_per_elem", ns_s1, "ns", step="strided_view_sum")
            emit_metric("stride16_ns_per_elem", ns_s16, "ns", step="strided_view_sum")
            emit_metric("stride16_vs_stride1_ratio", ratio, "x", step="strided_view_sum")

            gf_s1 = count / s1_sec / 1e9
            bw_s1 = (count * 4.0) / s1_sec / 1e9
            gf_s16 = count / s16_sec / 1e9
            bw_s16_line = (count * 64.0) / s16_sec / 1e9
            emit_roofline("a05_stride1_sum", 0.25, gf_s1, bw_s1, step="strided_view_sum")
            emit_roofline("a05_stride16_sum", 1.0 / 64.0, gf_s16, bw_s16_line, step="strided_view_sum")
            emit_check(
                "strided_view_sum_check",
                "strided_view_sum",
                True,
                f"Zero-copy view verified (np.shares_memory=True). Per-element median: stride=1 is {ns_s1:.2f} ns vs stride=16 is {ns_s16:.2f} ns ({ratio:.2f}x ratio).",
            )
    except Exception as e:
        emit_check("strided_view_sum_check", "strided_view_sum", False, f"Error in strided_view_sum: {e}")

    # Step 2 & Step 3: row_slice_sum vs col_slice_sum
    small_mat = np.random.default_rng(bench_seed).uniform(-1.0, 1.0, size=(12, 16)).astype(np.float32)
    row_ms = None
    try:
        expected_row = float(small_mat[3, :].sum())
        resp_r = call_student("a05_bench", {"step": "row_slice_sum", "seed": bench_seed})
        if resp_r.get("is_none"):
            emit_check("row_slice_sum_check", "row_slice_sum", False, "TODO not completed: row_slice_sum returned None.")
        elif resp_r.get("has_loop"):
            emit_check("row_slice_sum_check", "row_slice_sum", False, "Forbidden Python loop in row_slice_sum.")
        elif not resp_r.get("is_ndarray") or not resp_r.get("shares_memory"):
            emit_check("row_slice_sum_check", "row_slice_sum", False, "np.shares_memory(mat_2d, view) must be True for row_slice_sum.")
        elif resp_r["small_shape"] != [16] or not math.isclose(resp_r["small_sum"], expected_row, rel_tol=1e-4, abs_tol=1e-4):
            emit_check(
                "row_slice_sum_check",
                "row_slice_sum",
                False,
                f"Expected row view shape [16] and sum {expected_row:.4f}, got shape {resp_r['small_shape']} and sum {resp_r['small_sum']:.4f}.",
            )
        else:
            row_ms = float(resp_r["median_batch_ms"])
            emit_metric("row_slice_128_ms", row_ms, "ms", step="row_slice_sum")
            emit_check(
                "row_slice_sum_check",
                "row_slice_sum",
                True,
                f"Contiguous row-slice zero-copy view verified (128 rows median: {row_ms:.3f} ms).",
            )
    except Exception as e:
        emit_check("row_slice_sum_check", "row_slice_sum", False, f"Error in row_slice_sum: {e}")

    try:
        expected_col = float(small_mat[:, 3].sum())
        resp_c = call_student("a05_bench", {"step": "col_slice_sum", "seed": bench_seed})
        if resp_c.get("is_none"):
            emit_check("col_slice_sum_check", "col_slice_sum", False, "TODO not completed: col_slice_sum returned None.")
        elif resp_c.get("has_loop"):
            emit_check("col_slice_sum_check", "col_slice_sum", False, "Forbidden Python loop in col_slice_sum.")
        elif not resp_c.get("is_ndarray") or not resp_c.get("shares_memory"):
            emit_check("col_slice_sum_check", "col_slice_sum", False, "np.shares_memory(mat_2d, view) must be True for col_slice_sum.")
        elif resp_c["small_shape"] != [12] or not math.isclose(resp_c["small_sum"], expected_col, rel_tol=1e-4, abs_tol=1e-4):
            emit_check(
                "col_slice_sum_check",
                "col_slice_sum",
                False,
                f"Expected column view shape [12] and sum {expected_col:.4f}, got shape {resp_c['small_shape']} and sum {resp_c['small_sum']:.4f}.",
            )
        else:
            col_ms = float(resp_c["median_batch_ms"])
            emit_metric("col_slice_128_ms", col_ms, "ms", step="col_slice_sum")
            if row_ms is not None and row_ms > 0:
                col_ratio = col_ms / row_ms
                emit_metric("col_vs_row_ratio", col_ratio, "x", step="col_slice_sum")
                emit_check(
                    "col_slice_sum_check",
                    "col_slice_sum",
                    True,
                    f"Strided column-slice zero-copy view verified: 128 cols {col_ms:.3f} ms vs 128 rows {row_ms:.3f} ms ({col_ratio:.2f}x ratio).",
                )
            else:
                emit_check("col_slice_sum_check", "col_slice_sum", True, f"Column-slice view verified ({col_ms:.3f} ms).")
    except Exception as e:
        emit_check("col_slice_sum_check", "col_slice_sum", False, f"Error in col_slice_sum: {e}")


def run_a06():
    # Step 1: amdahl_speedup
    try:
        cases = [(0.2, 4, 2.5), (0.0, 8, 8.0), (1.0, 16, 1.0), (0.1, 9, 5.0)]
        for s_frac, p_workers, expected in cases:
            resp = call_student("call_fn", {"fn": "amdahl_speedup", "args": [s_frac, p_workers]})
            actual = resp["result"]
            if actual is None:
                emit_check("amdahl_speedup_formula", "amdahl_speedup", False, "TODO not completed: amdahl_speedup returned None.")
                break
            if not isinstance(actual, (int, float)) or not math.isclose(float(actual), expected, rel_tol=1e-5, abs_tol=1e-5):
                emit_check(
                    "amdahl_speedup_formula",
                    "amdahl_speedup",
                    False,
                    f"amdahl_speedup({s_frac}, {p_workers}) -> expected {expected:.4f}, got {actual!r}.",
                )
                break
        else:
            emit_check("amdahl_speedup_formula", "amdahl_speedup", True, "Amdahl's Law formula verified across boundary and multi-core cases.")
    except Exception as e:
        emit_check("amdahl_speedup_formula", "amdahl_speedup", False, f"Error in amdahl_speedup: {e}")

    # Step 2: parallel_matmul_checksums
    try:
        eff_cpus = detect_effective_cpus()
        emit_metric("effective_container_cpus", eff_cpus, "scalar", step="parallel_matmul_checksums")
        workers = min(4, max(2, int(math.floor(eff_cpus)))) if eff_cpus >= 2.0 else 2
        task_count = 8
        dim = 320 if eff_cpus >= 2.0 else 160
        bench_seed = int(rng.integers(1, 1_000_000))

        local_rng = np.random.default_rng(bench_seed)
        expected = []
        for _ in range(task_count):
            a = local_rng.uniform(-0.5, 0.5, size=(dim, dim)).astype(np.float32)
            b = local_rng.uniform(-0.5, 0.5, size=(dim, dim)).astype(np.float32)
            expected.append(float(np.sum(a @ b, dtype=np.float64)))

        resp = call_student(
            "a06_bench",
            {"seed": bench_seed, "workers": workers, "task_count": task_count, "dim": dim},
        )
        if resp.get("is_none"):
            emit_check(
                "parallel_matmul_check",
                "parallel_matmul_checksums",
                False,
                "TODO not completed: parallel_matmul_checksums returned None.",
            )
            return
        if not resp.get("uses_mp_keyword"):
            emit_check(
                "parallel_matmul_check",
                "parallel_matmul_checksums",
                False,
                "Expected multiprocessing.Pool (or Process) in parallel_matmul_checksums for num_workers > 1.",
            )
            return

        s_out = resp["serial_out"]
        p_out = resp["parallel_out"]
        if len(s_out) != task_count or len(p_out) != task_count:
            emit_check(
                "parallel_matmul_check",
                "parallel_matmul_checksums",
                False,
                f"Expected {task_count} checksums, got len(serial)={len(s_out)}, len(parallel)={len(p_out)}.",
            )
            return
        if not (np.allclose(s_out, expected, rtol=1e-3, atol=1e-2) and np.allclose(p_out, expected, rtol=1e-3, atol=1e-2)):
            emit_check(
                "parallel_matmul_check",
                "parallel_matmul_checksums",
                False,
                f"Checksum mismatch between student output and reference: expected[0]={expected[0]:.4f}, got serial[0]={s_out[0]:.4f}, parallel[0]={p_out[0]:.4f}.",
            )
            return

        serial_ms = float(resp["serial_ms"])
        parallel_ms = float(resp["parallel_ms"])
        emit_metric("serial_1worker_ms", serial_ms, "ms", step="parallel_matmul_checksums")
        emit_metric("parallel_workers_ms", parallel_ms, "ms", step="parallel_matmul_checksums")

        if eff_cpus >= 2.0:
            speedup = serial_ms / max(parallel_ms, 1e-6)
            emit_metric("measured_multicore_speedup", speedup, "x", step="parallel_matmul_checksums")
            emit_check(
                "parallel_matmul_check",
                "parallel_matmul_checksums",
                True,
                f"Multi-process consistency & timing verified on {eff_cpus:.1f} effective CPUs ({workers} workers): 1-worker={serial_ms:.1f} ms, {workers}-workers={parallel_ms:.1f} ms ({speedup:.2f}x including pool startup/IPC overhead).",
            )
        else:
            emit_check(
                "parallel_matmul_check",
                "parallel_matmul_checksums",
                True,
                f"Environment constrained to {eff_cpus:.2f} CPU (< 2 cores): verified multi-process ({workers} workers) result consistency against single-process baseline without penalizing speedup.",
            )
    except Exception as e:
        emit_check("parallel_matmul_check", "parallel_matmul_checksums", False, f"Error in parallel_matmul_checksums: {e}")


def run_a07():
    # Step 1: vector_add_ai
    try:
        for n_val, bpe in [(1024, 4), (1_000_000, 4), (4096, 2)]:
            expected = 1.0 / (3.0 * bpe)
            resp = call_student("call_fn", {"fn": "vector_add_ai", "args": [n_val, bpe]})
            actual = resp["result"]
            if actual is None:
                emit_check("vector_add_ai_check", "vector_add_ai", False, "TODO not completed: vector_add_ai returned None.")
                break
            if not isinstance(actual, (int, float)) or not math.isclose(float(actual), expected, rel_tol=1e-5, abs_tol=1e-6):
                emit_check(
                    "vector_add_ai_check",
                    "vector_add_ai",
                    False,
                    f"vector_add_ai({n_val}, {bpe}) -> expected {expected:.6f} FLOPs/Byte, got {actual!r}.",
                )
                break
        else:
            emit_metric("fp32_vector_add_ai", 1.0 / 12.0, "scalar", step="vector_add_ai")
            emit_check("vector_add_ai_check", "vector_add_ai", True, "Vector addition AI verified (1/12 ~= 0.0833 FLOPs/B for float32, independent of N).")
    except Exception as e:
        emit_check("vector_add_ai_check", "vector_add_ai", False, f"Error in vector_add_ai: {e}")

    # Step 2: square_matmul_ai
    try:
        for n_val, bpe in [(6, 4), (24, 4), (1024, 4), (512, 2)]:
            expected = (2.0 * n_val) / (3.0 * bpe)
            resp = call_student("call_fn", {"fn": "square_matmul_ai", "args": [n_val, bpe]})
            actual = resp["result"]
            if actual is None:
                emit_check("square_matmul_ai_check", "square_matmul_ai", False, "TODO not completed: square_matmul_ai returned None.")
                break
            if not isinstance(actual, (int, float)) or not math.isclose(float(actual), expected, rel_tol=1e-5, abs_tol=1e-5):
                emit_check(
                    "square_matmul_ai_check",
                    "square_matmul_ai",
                    False,
                    f"square_matmul_ai({n_val}, {bpe}) -> expected {expected:.4f} FLOPs/Byte, got {actual!r}.",
                )
                break
        else:
            emit_metric("fp32_matmul_1024_ai", 1024.0 / 6.0, "scalar", step="square_matmul_ai")
            emit_check("square_matmul_ai_check", "square_matmul_ai", True, "Square N*N matmul AI verified (scales linearly as N/6 for float32!).")
    except Exception as e:
        emit_check("square_matmul_ai_check", "square_matmul_ai", False, f"Error in square_matmul_ai: {e}")

    # Step 3: classify_bottleneck
    try:
        cases = [
            (1.0 / 12.0, 200.0, 50.0, "memory-bound"),
            (3.9, 200.0, 50.0, "memory-bound"),
            (4.0, 200.0, 50.0, "compute-bound"),
            (1024.0 / 6.0, 200.0, 50.0, "compute-bound"),
        ]
        for ai_val, peak_gf, peak_bw, expected in cases:
            resp = call_student("call_fn", {"fn": "classify_bottleneck", "args": [ai_val, peak_gf, peak_bw]})
            actual = resp["result"]
            if actual is None:
                emit_check("classify_bottleneck_check", "classify_bottleneck", False, "TODO not completed: classify_bottleneck returned None.")
                break
            if actual != expected:
                emit_check(
                    "classify_bottleneck_check",
                    "classify_bottleneck",
                    False,
                    f"classify_bottleneck(ai={ai_val:.3f}, peak_gflops={peak_gf}, peak_bw={peak_bw}) -> expected {expected!r}, got {actual!r}.",
                )
                break
        else:
            emit_roofline("a07_vec_add_ideal", 1.0 / 12.0, (1.0 / 12.0) * 50.0, 50.0, step="classify_bottleneck")
            emit_roofline("a07_matmul_512_ideal", 512.0 / 6.0, 200.0, 50.0, step="classify_bottleneck")
            emit_check(
                "classify_bottleneck_check",
                "classify_bottleneck",
                True,
                "Correctly classified memory-bound vs compute-bound operators against Ridge Point!",
            )
    except Exception as e:
        emit_check("classify_bottleneck_check", "classify_bottleneck", False, f"Error in classify_bottleneck: {e}")


def run_gloo_selftest():
    import torch

    torch.set_num_threads(1)
    world_size = 4
    expected = torch.zeros(4, dtype=torch.float32)
    for rank in range(world_size):
        gen = torch.Generator()
        gen.manual_seed(seed + rank * 101)
        expected += torch.ones(4, dtype=torch.float32) * float(rank + 1) + torch.rand(4, generator=gen, dtype=torch.float32) * 0.25
    expected_list = [float(x) for x in expected.tolist()]

    resp = call_student("gloo_selftest", {"seed": seed, "world_size": world_size}, timeout=30)
    ranks = resp.get("ranks", [])
    pids = {int(r["pid"]) for r in ranks}
    all_match = (
        len(ranks) == world_size
        and len(pids) == world_size
        and all(np.allclose(r["values"], expected_list, rtol=1e-5, atol=1e-5) for r in ranks)
    )
    emit_metric("gloo_spawn_wall_ms", float(resp["wall_ms"]), "ms", step="all_reduce")
    emit_check(
        "gloo_4proc_all_reduce",
        "all_reduce",
        bool(all_match),
        f"Spawned {len(pids)} distinct unprivileged worker processes over 127.0.0.1/lo Gloo; all_reduce matched={all_match}.",
    )


import lab_checks


def run_lab_steps():
    def metric(name, value, unit, step, zh, en):
        emit("metric", name, step=step, value=float(value), unit=unit, message={"zh": zh, "en": en})

    for step in lab_checks.STEPS[key]:
        zh, en = lab_checks.GUIDANCE[step]
        extra = ""
        try:
            passed = bool(lab_checks.verify(key, step, rng, call_student, metric, emit, raw_config))
        except StudentOutputLimit:
            raise
        except Exception as error:
            passed = False
            extra = " (" + str(error)[-500:] + ")"
        msg = {"zh": ("已核对。 " if passed else "请复查。 ") + zh + extra,
               "en": ("Verified. " if passed else "Check your implementation. ") + en + extra}
        emit("check", step, step=step, passed=passed, detail=msg["en"], message=msg)


DISPATCH = {
    "a00-hello-v1": run_a00,
    "a01-py-basics-v1": run_a01,
    "a02-numpy-2d-v1": run_a02,
    "a03-float-limits-v1": run_a03,
    "a04-dot-flops-v1": run_a04,
    "a05-cache-stride-v1": run_a05,
    "a06-multicore-v1": run_a06,
    "a07-roofline-calc-v1": run_a07,
    "d00-gloo-selftest-v1": run_gloo_selftest,
}


try:
    if key not in DISPATCH and key not in lab_checks.STEPS:
        raise ValueError(f"Unsupported runtimeKey: {key}")
    stage_files()
    if raw_config:
        numeric_cfg = {
            str(k): float(v)
            for k, v in raw_config.items()
            if isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v)
        }
        if numeric_cfg:
            emit("config", "effective_config", **{"value": float(len(numeric_cfg))})
    if key in lab_checks.STEPS:
        run_lab_steps()
    else:
        DISPATCH[key]()
    print(json.dumps({"controller_complete": True}, allow_nan=False), flush=True)
except Exception:
    traceback.print_exc()
    sys.exit(1)
finally:
    cleanup_staged()
