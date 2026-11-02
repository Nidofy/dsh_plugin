import { temporaryRunner } from './runner-helper.ts'
import { mkdir, writeFile } from 'node:fs/promises'
import { strict as assert } from 'node:assert'
import { loadCatalog } from '../src/catalog.ts'
import { randomUUID } from 'node:crypto'
import type { RunRecord } from '../src/types.ts'
const catalog = await loadCatalog()
const temporary = await temporaryRunner()
const runner = temporary.runner
try {
  const environment = await runner.environment()
  assert.ok(environment.available, environment.detail)
  const results: unknown[] = []
  await mkdir('tests/results', { recursive: true })
  const save = async () => {
    await writeFile(
      'tests/results/adversarial-results.json',
      JSON.stringify({ environment, results }, null, 2),
    )
  }
  const cases: [string, string, string][] = [
    [
      'L10-code',
      'wrong-transpose',
      'import numpy as np\ndef solve(x,heads):\n x=np.asarray(x);b,t,d=x.shape;return x.reshape(b,heads,-1)',
    ],
    [
      'L11-advanced',
      'detach-residual',
      'import numpy as np\ndef solve(x):\n x=np.asarray(x);return [x.tolist(),np.zeros_like(x).tolist()]',
    ],
    [
      'L05-code',
      'wrong-axis',
      'import numpy as np\ndef solve(x):\n x=np.asarray(x);e=np.exp(x-x.max(0,keepdims=True));return e/e.sum(0,keepdims=True)',
    ],
    [
      'L08-code',
      'missing-scale',
      'import numpy as np\ndef solve(q,k,v):\n q,k,v=map(np.asarray,(q,k,v));s=q@k.swapaxes(-1,-2);e=np.exp(s-s.max(-1,keepdims=True));return (e/e.sum(-1,keepdims=True))@v',
    ],
    [
      'L09-code',
      'mask-leak',
      'import numpy as np\ndef solve(q,k,v):\n q,k,v=map(np.asarray,(q,k,v));s=q@k.swapaxes(-1,-2)/q.shape[-1]**.5;e=np.exp(s-s.max(-1,keepdims=True));return (e/e.sum(-1,keepdims=True))@v',
    ],
    [
      'L03-advanced',
      'detach',
      'import torch\ndef solve(x):\n x=torch.tensor(x,dtype=torch.float64,requires_grad=True);y=x.detach()**3;y.sum().backward();return x.grad',
    ],
    [
      'L05-code',
      'parent-fd-spoof',
      'import os\nopen("/proc/1/fd/1","w").write("spoof")\ndef solve(x):return x',
    ],
    ['L05-code', 'fake-pass', 'import os\nprint("{\\"controller_complete\\":true}")\nos._exit(0)'],
    ['L05-code', 'output-flood', 'print("x"*1000000)\ndef solve(x):return x'],
    [
      'L05-code',
      'incorrect-batch',
      'import numpy as np\ndef solve(x):\n x=np.asarray(x);e=np.exp(x-x.max());return e/e.sum()',
    ],
  ]
  const stagedPrelude =
    'import os, pathlib, stat, sys\nassert os.getuid() == 65534\nroot=pathlib.Path(sys.argv[0]).parent\nassert root.stat().st_uid == 0\nassert stat.S_IMODE(root.stat().st_mode) == 0o555\nassert pathlib.Path("/tmp").stat().st_mode & stat.S_ISVTX\nassert all(stat.S_IMODE(p.stat().st_mode) == 0o444 and p.stat().st_uid == 0 for p in [pathlib.Path(sys.argv[0]),pathlib.Path(sys.argv[2])])\n'
  cases.push(
    [
      'L05-code',
      'detached-descendant-pipe',
      'import os,time\ndef solve(x):\n if os.fork()==0:\n  os.setsid();time.sleep(45);os._exit(0)\n return x',
    ],
    [
      'L05-code',
      'fixed-softmax',
      'def solve(x):return [[0.09003057,0.24472847,0.66524096],[0.21194156,0.21194156,0.57611688]]',
    ],
    [
      'L10-code',
      'ignores-heads',
      'import numpy as np\ndef solve(x,heads):\n a=np.asarray(x);b,t,d=a.shape;return a.reshape(b,t,2,-1).transpose(0,2,1,3).reshape(b,2,-1)',
    ],
    [
      'L05-code',
      'staged-bootstrap-write',
      stagedPrelude + 'pathlib.Path(sys.argv[0]).write_text("spoof")\ndef solve(x):return x',
    ],
    [
      'L05-code',
      'staged-submission-write',
      stagedPrelude + 'pathlib.Path(sys.argv[2]).write_text("spoof")\ndef solve(x):return x',
    ],
    [
      'L05-code',
      'staged-submission-replace',
      stagedPrelude + 'os.rename(sys.argv[2],str(root / "replacement.py"))\ndef solve(x):return x',
    ],
    [
      'L05-code',
      'staged-directory-rename',
      stagedPrelude + 'os.rename(root,str(root)+"-replacement")\ndef solve(x):return x',
    ],
  )
  for (const [id, label, code] of cases) {
    const e = catalog.lessons.flatMap((l) => l.exercises).find((e) => e.id === id)!
    const r: RunRecord = {
      id: randomUUID(),
      exerciseId: id,
      code,
      contentVersion: catalog.version,
      testVersion: e.testVersion,
      seed: 42,
      config: {},
      environment: '',
      run_status: 'queued',
      check_status: 'not_run',
      createdAt: new Date().toISOString(),
      events: [],
      log: '',
      help: 'none',
    }
    const out = await runner.execute(r, e, new AbortController().signal)
    results.push({ label, ...out })
    await save()
    console.log(label, out.run_status, out.check_status)
    assert.equal(out.run_status, 'completed', JSON.stringify(out))
    assert.equal(out.check_status, 'failed')
    if (label.startsWith('staged-'))
      assert.match(
        out.log,
        /PermissionError/,
        'Student must reach the denied operation as UID 65534 after verifying root-owned immutable staging',
      )
    assert.ok(out.events.some((e) => e.type === 'check' && e.passed === false))
  }
  const e = catalog.lessons[4]!.exercises[0]!
  const make = (): RunRecord => ({
    id: randomUUID(),
    exerciseId: e.id,
    code: 'import time\ntime.sleep(60)\ndef solve(x):return x',
    contentVersion: catalog.version,
    testVersion: e.testVersion,
    seed: 42,
    config: {},
    environment: '',
    run_status: 'queued',
    check_status: 'not_run',
    createdAt: new Date().toISOString(),
    events: [],
    log: '',
    help: 'none',
  })
  const { Runner } = await import('../src/runner.ts')
  const timeout = await new Runner(temporary.root, undefined, { timeoutMs: 1500 }).execute(
    make(),
    e,
    new AbortController().signal,
  )
  assert.equal(timeout.run_status, 'timed_out')
  results.push({ label: 'timeout', ...timeout })
  await save()
  console.log('timeout', timeout.run_status)
  const abort = new AbortController()
  const timer = setTimeout(() => abort.abort(), 1500)
  const cancelled = await runner.execute({ ...make(), config: {} }, e, abort.signal)
  clearTimeout(timer)
  assert.equal(cancelled.run_status, 'cancelled')
  results.push({ label: 'cancel', ...cancelled })
  await save()
  console.log('cancel', cancelled.run_status)
} finally {
  await temporary.cleanup()
}
