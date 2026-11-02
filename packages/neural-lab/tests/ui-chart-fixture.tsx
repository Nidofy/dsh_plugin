import { useState } from 'react'
import { CodeEditor } from '../src/components/CodeEditor.tsx'
// Deliberate component-only fixture. Never imported by production client entries.
import { RunResults } from '../src/components/RunResults.tsx'
import type { RunRecord } from '../src/types.ts'
import { css } from '../src/client-style.ts'
const run: RunRecord = {
  id: 'component-fixture',
  exerciseId: 'fixture',
  code: '',
  contentVersion: 'fixture',
  testVersion: 'fixture',
  seed: 0,
  config: {},
  environment: 'Component fixture only',
  run_status: 'completed',
  check_status: 'not_applicable',
  createdAt: '2000-01-01',
  help: 'none',
  log: '',
  events: [
    {
      runId: 'component-fixture',
      seq: 1,
      type: 'metric',
      name: 'scalar',
      value: 1.234567890123,
      step: 7,
    },
    ...[0, 1, 2].flatMap((step) => [
      {
        runId: 'component-fixture',
        seq: step * 3 + 2,
        type: 'metric' as const,
        name: 'train_lr=0.03',
        value: 10 - step * 2,
        step,
      },
      {
        runId: 'component-fixture',
        seq: step * 3 + 3,
        type: 'metric' as const,
        name: 'valid_lr=0.003',
        value: 20 - step,
        step,
      },
      {
        runId: 'component-fixture',
        seq: step * 3 + 4,
        type: 'metric' as const,
        name: 'constant',
        value: 3,
        step,
      },
    ]),
  ],
}
export function ChartFixture() {
  return (
    <main className="neural-lab">
      <style>{css}</style>
      <h1>Component fixture — not a learner run</h1>
      <RunResults run={run} />
    </main>
  )
}

export function ReadOnlyEditorFixture() {
  const [value, setValue] = useState('x = 1'),
    [runs, setRuns] = useState(0)
  return (
    <main className="neural-lab">
      <style>{css}</style>
      <h1>Read-only editor fixture</h1>
      <CodeEditor
        value={value}
        readOnly
        language="python"
        label="Readonly editor"
        completionLabel="Completions"
        completionHint="Completion keys"
        onChange={setValue}
        onRun={() => setRuns((v) => v + 1)}
        onSubmit={() => setRuns((v) => v + 1)}
      />
      <output aria-label="Fixture run count">{runs}</output>
    </main>
  )
}
