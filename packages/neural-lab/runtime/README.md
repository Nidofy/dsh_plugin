# Neural Lab CPU protocol

## train-char-v1 (0.2.1)

The learner supplies five single-file PyTorch functions. Progressive probes call each independently on fixed-shape inputs. A separate trusted decoder uses per-head scaled_dot_product_attention and autograd to check a four-step SGD trace against the student's model, including embedding-input and all named parameter gradients. The child receives training windows; the controller recomputes held-out cross entropy from returned numeric weights. Position windows use a chronological 72/28 split of an original 100-character sequence. The snapshot fingerprints the corpus/split, batch schedule, and initialized weights. Post-training sampling runs the student's decoder in a fresh low-privilege process and compares all sixteen draws with independently decoded probabilities and the same uniforms. No additional Docker capabilities or dependencies.


## train-mlp-v1 (0.2.0)

The controller creates a seeded float64 quadratic regression dataset, partitions 32 IDs into disjoint 24/8 splits, samples eight six-example training batches and initializes a 2–4–1 tanh MLP. The run records the generator version and SHA-256 digests of the split, minibatch schedule and initial parameters. Training and validation use separate UID 65534 subprocess invocations. Only training batches enter train_step; the validation invocation receives final numeric parameters and held-out examples. The optimizer is plain SGD with no momentum.

Students return scalar losses. The unprivileged wrapper samples each post-update parameter array and gradient. The trusted NumPy oracle independently computes forward MSE, analytic gradients and SGD updates for each batch, recomputes both population losses from each returned state and checks the validation report, observed eval/no-grad mode and unchanged validation parameters. All IPC uses bounded JSON scalars/arrays. Student output, including stderr and self-reported metrics, cannot emit trusted check events. The trace records observable numerical behavior, not proof of authorship. Existing CPU time, child output, memory and Docker isolation limits apply.


`controller.py` is the versioned trusted checker/experiment harness. It imports the pinned NumPy/PyTorch environment, seeds both libraries, and sets one Torch thread. It emits bounded JSON records on stdout; stderr is a separate execution log. A final controller marker is necessary but not sufficient for a passing check: at least one independently generated check is required and every check must pass.

On Windows Docker Desktop, a long installation path can make read-only bind files unreadable to UID 65534 even though root can read the identical bytes. Before any learner process starts, the trusted controller copies only the fixed `/runtime/student.py` and `/work/submission.py` bytes into one root-owned `mkdtemp` directory under container `/tmp`. It never parses, imports, compiles or executes the submission as root. The directory is mode 0555 and both files are 0444. The controller verifies `/tmp` is root-owned and sticky, preventing a learner from renaming the root-owned staging directory. The directory is removed by the controller's final cleanup and otherwise disappears with the container's bounded tmpfs.

`student.py` loads the explicitly supplied staged submission path in a child process running as UID/GID 65534 with no supplementary groups. The controller remains root only to drop credentials and clean child process groups (SETUID/SETGID/KILL are its only retained capabilities). Students cannot open the controller's `/proc/1/fd/1`, signal it, modify either staged file, replace the submission, or rename the staging directory. All host mounts remain read-only; the only writable filesystem is a bounded `/tmp`. No host environment credentials or network are exposed. Staging preserves one immutable input snapshot across all checks within a run.


The student returns a single JSON value from `solve(*args)` or `configure()`. It does not supply check events or claim a final status. Both child streams have a 64 KiB cap, and the process group is killed on overflow/timeout. The host pins execution to the inspected SHA-256 image ID, creates a labelled container, then starts it by ID. Cancellation waits for creation to settle. Unconfirmed cleanup is retained on the run for a scoped lookup at next startup. The outer Docker manager caps total events/log output at 256 KiB, limits CPU/memory/PIDs, and owns cancellation and final states.

Experiments use `configure()` as their **only** parameter source. Missing keys receive the defaults below; unknown keys, incorrect types (including bool-as-number), NaN/Inf, and out-of-range values fail the run before a trusted config event is emitted. The UI supplies only an independent seed, passed as the controller's CLI seed. Host configuration never overrides the submitted function.

| Experiment | Defaults and supported bounds |
| --- | --- |
| Gradient | `eps=[0.1,0.01,0.001,0.0001,0.00001]`; 1–12 finite values, each 1e-7–0.2 |
| Softmax | `offset=1000` (-10000–10000), `temperature=1` (0.1–10) |
| Attention | `dim=8` (integer 2–64), `scale=True` (boolean) |
| Causal | `perturbation=10` (0–100) |
| MLP / language model | `steps=60` (integer 1–200), `lr=0.03` (0.0001–1) |

The trusted `config` event contains defaults merged with validated submitted values. The Host records this object as `RunRecord.effectiveConfig` alongside the source snapshot and independent seed. Configuration changes affect real finite differences, probability distributions, attention tensors, future perturbations, or optimization trajectories. A coarse finite-difference step is an observation, not a failed lesson: for the cubic example the numerical check verifies the expected eps-squared truncation error. Large learning rates may legitimately cause numerical failures; no success is fabricated.

The data root accepts up to 4096 entries under runs. At capacity the host refuses new snapshots. Stop the plugin and archive older run directories outside runs to free slots; the SQLite run and evidence history is retained.

Training templates are trusted course content, not arbitrary user-provided training loops. Reference results, full raw events and snapshots are stored per run. Students' arbitrary output-file export is not supported in v0.1.1. Real-test scripts use isolated OS temporary directories and guarded `finally` cleanup, retaining only structured synthetic evidence in `tests/results`.

Numerical tasks define finite nonempty inputs; NaN/Inf/empty inputs and all-masked attention rows are outside the declared domain. Causal tasks use square self-attention with the diagonal included. True means allowed in course mask descriptions; the language model explicitly constructs the opposite blocked mask for `nn.MultiheadAttention`. Dropout is zero.

Short problems use independent numerical references at atol=1e-6, rtol=1e-5, plus a hand-calculated attention matrix and future-perturbation property. Training success requires nonzero finite gradients and actual parameter changes, not an arbitrary final loss threshold. Explanation remains separate learner/mentor evidence.
