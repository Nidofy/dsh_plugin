# Neural Lab CPU protocol

`controller.py` is the versioned trusted checker/experiment harness. It imports the pinned NumPy/PyTorch environment, seeds both libraries, and sets one Torch thread. It emits bounded JSON records on stdout; stderr is a separate execution log. A final controller marker is necessary but not sufficient for a passing check: at least one independently generated check is required and every check must pass.

`student.py` loads the submitted module in a child process running as UID/GID 65534 with no supplementary groups. The controller remains root only to drop credentials for each child (SETUID/SETGID/KILL are its only retained capabilities; KILL permits bounded cleanup of the differently owned child process group). Students cannot open the controller's `/proc/1/fd/1` or signal it. All mounts are read-only; the only writable filesystem is a bounded `/tmp`. No host environment credentials or network are exposed.

The student returns a single JSON value from `solve(*args)` or `configure()`. It does not supply check events or claim a final status. Both child streams have a 64 KiB cap, and the process group is killed on overflow/timeout. The outer Docker manager caps total events/log output at 256 KiB, limits CPU/memory/PIDs, and owns cancellation and final states.

Experiments accept editable `configure()` settings. `steps` is 1..200; `lr`/`learningRate` is 0.0001..1. Host run configuration overrides the code configuration and is recorded with the code snapshot. Other optional configuration fields do not alter the fixed teaching model; only `steps`, `learningRate` and the run's explicit seed are supported. Training templates are trusted course content, not arbitrary user-provided training loops. Reference results, full raw events and snapshots are stored per run. Students' arbitrary output-file export is not supported in v0.1.

Numerical tasks define finite nonempty inputs; NaN/Inf/empty inputs and all-masked attention rows are outside the declared domain. Causal tasks use square self-attention with the diagonal included. True means allowed in course mask descriptions; the language model explicitly constructs the opposite blocked mask for `nn.MultiheadAttention`. Dropout is zero.

Short problems use independent numerical references at atol=1e-6, rtol=1e-5, plus a hand-calculated attention matrix and future-perturbation property. Training success requires nonzero finite gradients and actual parameter changes, not an arbitrary final loss threshold. Explanation remains separate learner/mentor evidence.
