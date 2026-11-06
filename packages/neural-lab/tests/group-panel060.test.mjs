// Mock React hooks/JSX and summary dependency. Tests real panel handlers/lifecycle; no browser claims.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

function harness() {
  const states = [], refs = [], effects = [], timers = new Map(), summaryInputs = []
  let cursor = 0, pending = [], timerId = 0
  const jsx = (type, props) => ({ type, props })
  const hooks = {
    useState(initial) { const i = cursor++; if (!(i in states)) states[i] = initial; return [states[i], (value) => { states[i] = typeof value === 'function' ? value(states[i]) : value }] },
    useRef(initial) { const i = cursor++; return refs[i] ??= { current: initial } },
    useLayoutEffect(fn, deps) { const i = cursor++, old = effects[i]; if (!old || deps.some((v, j) => v !== old.deps[j])) pending.push(() => { old?.cleanup?.(); effects[i] = { deps, cleanup: fn() } }) },
  }
  const exports = {}
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/components/ExperimentGroupPanel.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, require: (id) => id === 'react' ? hooks : id === 'react/jsx-runtime' ? { jsx, jsxs: jsx } : { groupSummary(g, runs) { summaryInputs.push({ g, runs }); return [{ learningRate: 0.1, n: 0, total: 1, failed: 0, cancelled: 0, missing: 1 }] } },
    setTimeout(fn, delay) { assert.equal(delay, 1000); timers.set(++timerId, fn); return timerId }, clearTimeout(id) { timers.delete(id) },
  })
  return { exports, summaryInputs, timers,
    render(props) { cursor = 0; const tree = exports.ExperimentGroupPanel(props); const queue = pending; pending = []; queue.forEach((fn) => fn()); return tree },
    unmount() { effects.forEach((e) => e?.cleanup?.()) },
  }
}
const flush = async () => { for (let i = 0; i < 15; i++) await Promise.resolve() }
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b }); return { promise, resolve, reject } }
function nodes(tree) { if (!tree || typeof tree !== 'object') return []; if (Array.isArray(tree)) return tree.flatMap(nodes); return [tree, ...nodes(tree.props?.children)] }
function text(tree) { if (Array.isArray(tree)) return tree.map(text).join(''); return tree && typeof tree === 'object' ? text(tree.props?.children) : String(tree ?? '') }
const button = (tree, label) => nodes(tree).find((n) => n.type === 'button' && text(n).includes(label))
const field = (tree, label) => nodes(nodes(tree).find((n) => n.type === 'label' && text(n).includes(label))).find((n) => n.type === 'input' || n.type === 'textarea')
const group = { id: 'g', revision: 2, exerciseId: 'x', code: 'frozen', codeHash: 'hash', imageId: 'image', status: 'completed', items: [{ runId: 'r', seed: 42, learningRate: 0.1, status: 'completed' }], hypothesis: 'test', conclusion: '', limitations: '', budgetMs: 300000, createdAt: 'today', attemptId: 'attempt', help: 'none' }
const run = { id: 'r', exerciseId: 'x', groupId: 'g', codeHash: 'hash', resolvedImageId: 'image', run_status: 'completed', check_status: 'passed', events: [{ runId: 'r', name: 'validation_loss' }, { runId: 'foreign', name: 'validation_loss' }] }
const props = (api) => ({ api, exercise: { id: 'x' }, code: 'source', config: { seed: 9, learningRate: 0.5, layers: 2 }, busy: false, runs: [] })

test('request validates unique bounded grid and strips seed/rate overrides', () => {
  const { parseGroupRequest } = harness().exports
  assert.doesNotThrow(()=>parseGroupRequest('0,10000', '.001,.3', '300', 'h', {}))
  const request = parseGroupRequest('42,43', '0.05,0.1', '300', ' hypothesize ', { seed: 99, learningRate: 0.3, lr: 0.3, rate: 1, layers: 2 })
  assert.equal(JSON.stringify(request), JSON.stringify({ seeds: [42, 43], learningRates: [0.05, 0.1], hypothesis: 'hypothesize', budgetMs: 300000, config: { layers: 2 } }))
  for (const args of [['1,2,3,4', '.1,.2', '300', 'h'], ['1,1', '.1', '300', 'h'], ['1', '.1', '601', 'h'], ['1', '.1', '300', ''], ['-1', '.1', '300', 'h'], ['1', 'NaN', '300', 'h'], ['10001', '.1', '300', 'h'], ['1', '.0009', '300', 'h'], ['1', '.301', '300', 'h']]) assert.throws(() => parseGroupRequest(...args, {}))
})

test('explicit start freezes current code/config and duplicate clicks do not enqueue twice', async () => {
  const h = harness(), pending = deferred(), calls = []
  const api = { groups: async () => [], run: async () => run, startGroup: (...args) => { calls.push(args); return pending.promise } }
  let p = props(api), tree = h.render(p); await flush(); tree = h.render(p)
  assert.equal(calls.length, 0)
  field(tree, 'Hypothesis').props.onChange({ target: { value: 'predict' } }); tree = h.render(p)
  button(tree, 'Start group').props.onClick(); button(tree, 'Start group').props.onClick()
  p = { ...p, code: 'changed', config: { layers: 1 } }; h.render(p)
  assert.equal(calls.length, 1); assert.equal(calls[0][1], 'source'); assert.equal(calls[0][2].config.layers, 2)
  pending.resolve(group); await flush(); h.unmount()
})

test('polling isolates exercise/API and unmount, preserves only matching group measurements', async () => {
  const h = harness(), old = deferred()
  let api = { groups: () => old.promise, run: async () => run }, p = props(api)
  h.render(p)
  api = { groups: async () => [group, { ...group, id: 'foreign', exerciseId: 'other' }], run: async () => run }
  p = { ...p, api, runs: [{ ...run, id: 'wrong', groupId: 'other' }] }; h.render(p); await flush()
  let tree = h.render(p); assert.ok(button(tree, 'today'))
  button(tree, 'today').props.onClick(); tree = h.render(p)
  const supplied = h.summaryInputs.at(-1).runs
  assert.equal(supplied.length, 1); assert.equal(supplied[0].events.length, 1)
  assert.match(text(tree), /Undefined \(n < 2\)/)
  old.resolve([{ ...group, id: 'obsolete' }]); await flush(); tree = h.render(p)
  assert.doesNotMatch(text(tree), /obsolete/)
  const delayed = deferred(); p = { ...p, exercise: { id: 'y' }, api: { ...api, groups: () => delayed.promise } }
  tree = h.render(p); assert.doesNotMatch(text(tree), /Frozen source/)
  h.unmount(); delayed.resolve([group]); await flush(); assert.equal(h.timers.size, 0)
})

test('cancel waits before refreshing; terminal conclusion uses editing revision and retains conflict text', async () => {
  const h = harness(), cancellation = deferred(), calls = []
  let listed = { ...group, status: 'running' }, reads = 0
  const api = { groups: async () => { reads++; return [listed] }, run: async () => run, cancelGroup: () => cancellation.promise,
    concludeGroup: async (...args) => { calls.push(args); throw Error('revision changed') } }
  const p = props(api); h.render(p); await flush(); let tree = h.render(p)
  button(tree, 'today').props.onClick(); tree = h.render(p)
  const before = reads; button(tree, 'Cancel this group').props.onClick(); await flush(); assert.equal(reads, before)
  listed = group; cancellation.resolve(); await flush(); tree = h.render(p)
  field(tree, 'Conclusion').props.onChange({ target: { value: 'lower loss' } }); tree = h.render(p)
  field(tree, 'Limitations').props.onChange({ target: { value: 'two seeds only' } }); tree = h.render(p)
  listed = { ...group, revision: 3 }; const poll = [...h.timers.values()].at(-1); await poll(); await flush(); tree = h.render(p)
  button(tree, 'Save conclusion').props.onClick(); await flush(); tree = h.render(p)
  assert.equal(calls[0][1], 2); assert.equal(calls[0][2], 'lower loss'); assert.match(text(tree), /revision changed/)
  assert.equal(field(tree, 'Conclusion').props.value, 'lower loss')
  h.unmount()
})
