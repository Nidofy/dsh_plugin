# Neural Lab CPU protocol

`controller.py` is the versioned trusted checker/experiment harness. It imports the pinned NumPy/PyTorch environment, seeds both libraries, and sets one Torch thread. It emits bounded JSON records on stdout; stderr is a separate execution log. A final controller marker is necessary but not sufficient for a passing check: at least one independently generated check is required and every check must pass.

On Windows Docker Desktop, a long installation path can make read-only bind files unreadable to UID 65534 even though root can read the identical bytes. Before any learner process starts, the trusted controller copies only the fixed `/runtime/student.py` and `/work/submission.py` bytes into one root-owned `mkdtemp` directory under container `/tmp`. It never parses, imports, compiles or executes the submission as root. The directory is mode 0555 and both files are 0444. The controller verifies `/tmp` is root-owned and sticky, preventing a learner from renaming the root-owned staging directory. The directory is removed by the controller's final cleanup and otherwise disappears with the container's bounded tmpfs.

`student.py` loads the explicitly supplied staged submission path in a child process running as UID/GID 65534 with no supplementary groups. The controller remains root only to drop credentials and clean child process groups (SETUID/SETGID/KILL are its only retained capabilities). Students cannot open the controller's `/proc/1/fd/1`, signal it, modify either staged file, replace the submission, or rename the staging directory. All host mounts remain read-only; the only writable filesystem is a bounded `/tmp`. No host environment credentials or network are exposed. Staging preserves one immutable input snapshot across all checks within a run.


The student returns a single JSON value from `solve(*args)` or `configure()`. It does not supply check events or claim a final status. Both child streams have a 64 KiB cap, and the process group is killed on overflow/timeout. The outer Docker manager caps total events/log output at 256 KiB, limits CPU/memory/PIDs, and owns cancellation and final states.

Experiments use `configure()` as their **only** parameter source. Missing keys receive the defaults below; unknown keys, incorrect types (including bool-as-number), NaN/Inf, and out-of-range values fail the run before a trusted config event is emitted. The UI supplies only an independent seed, passed as the controller's CLI seed. Host configuration never overrides the submitted function.

| Experiment | Defaults and supported bounds |
| --- | --- |
| Gradient | `eps=[0.1,0.01,0.001,0.0001,0.00001]`; 1–12 finite values, each 1e-7–0.2 |
| Softmax | `offset=1000` (-10000–10000), `temperature=1` (0.1–10) |
| Attention | `dim=8` (integer 2–64), `scale=True` (boolean) |
| Causal | `perturbation=10` (0–100) |
| MLP / language model | `steps=60` (integer 1–200), `lr=0.03` (0.0001–1) |

The trusted `config` event contains defaults merged with validated submitted values. The Host records this object as `RunRecord.effectiveConfig` alongside the source snapshot and independent seed. Configuration changes affect real finite differences, probability distributions, attention tensors, future perturbations, or optimization trajectories. A coarse finite-difference step is an observation, not a failed lesson: for the cubic example the numerical check verifies the expected eps-squared truncation error. Large learning rates may legitimately cause numerical failures; no success is fabricated.

Training templates are trusted course content, not arbitrary user-provided training loops. Reference results, full raw events and snapshots are stored per run. Students' arbitrary output-file export is not supported in v0.1.1. Real-test scripts use isolated OS temporary directories and guarded `finally` cleanup, retaining only structured synthetic evidence in `tests/results`.

Numerical tasks define finite nonempty inputs; NaN/Inf/empty inputs and all-masked attention rows are outside the declared domain. Causal tasks use square self-attention with the diagonal included. True means allowed in course mask descriptions; the language model explicitly constructs the opposite blocked mask for `nn.MultiheadAttention`. Dropout is zero.

Short problems use independent numerical references at atol=1e-6, rtol=1e-5, plus a hand-calculated attention matrix and future-perturbation property. Training success requires nonzero finite gradients and actual parameter changes, not an arbitrary final loss threshold. Explanation remains separate learner/mentor evidence.
