// Component logic regression with a small hook harness; no browser/Host claims.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

function harness(name) {
  const state = [], effects = [], refs = []
  let cursor = 0, pending = [], downloads = 0
  const jsx = (type, props) => ({ type, props })
  const hooks = {
    useState(initial) {
      const i = cursor++
      if (!(i in state)) state[i] = initial
      return [state[i], (value) => { state[i] = value }]
    },
    useRef(initial) {
      const i = cursor++
      return refs[i] ??= { current: initial }
    },
    useLayoutEffect(fn, deps) {
      const i = cursor++, old = effects[i]
      if (!old || deps.some((v, j) => v !== old.deps[j])) {
        pending.push(() => { old?.cleanup?.(); effects[i] = { deps, cleanup: fn() } })
      }
    },
  }
  const exports = {}
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/components/' + name + '.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, {
    exports, require: (id) => id === 'react' ? hooks : id === 'react/jsx-runtime' ? { jsx, jsxs: jsx } : {},
    URL: { createObjectURL: () => 'blob:test', revokeObjectURL() {} }, Blob,
    document: { createElement: () => ({ click() { downloads++ } }) }, setTimeout: (fn) => fn(),
  })
  return {
    exports,
    render(props) { cursor = 0; const tree = exports[name](props); const queue = pending; pending = []; queue.forEach((fn) => fn()); return tree },
    get downloads() { return downloads },
  }
}
function nodes(tree) {
  if (!tree || typeof tree !== 'object') return []
  if (Array.isArray(tree)) return tree.flatMap(nodes)
  return [tree, ...nodes(tree.props?.children)]
}
function text(tree) {
  if (Array.isArray(tree)) return tree.map(text).join('')
  if (tree && typeof tree === 'object') return text(tree.props?.children)
  return tree ?? ''
}
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b }); return { promise, resolve, reject } }
const run = { id: 'a', run_status: 'completed' }
const file = { runId: 'import-a', manifest: {}, explanations: [], code: 'source' }
const button = (tree, label) => nodes(tree).find((n) => n.type === 'button' && text(n).includes(label))
const input = (tree) => nodes(tree).find((n) => n.type === 'input')
const upload = (tree, value) => input(tree).props.onChange({ target: { files: [{ size: 1, text: async () => value }] } })

test('comparison includes changed seed/version/data and missing environment; key order is not a config change', () => {
  const { comparisonFactors } = harness('TrainingComparison').exports
  const a = { code: 'a', seed: 1, contentVersion: '1', effectiveConfig: { lr: 1, steps: 2 }, trainingManifest: { dataset: 'a' } }
  const b = { ...a, seed: 2, contentVersion: '2', effectiveConfig: { steps: 2, lr: 1 }, trainingManifest: { dataset: 'b' } }
  const factors = comparisonFactors(a, b)
  assert.match(factors.find((f) => f.name.includes('Seed')).status, /Changed/)
  assert.match(factors.find((f) => f.name.includes('Content version')).status, /Changed/)
  assert.match(factors.find((f) => f.name === 'dataset').status, /Changed/)
  assert.match(factors.find((f) => f.name.includes('Environment')).status, /Unknown/)
  assert.match(factors.find((f) => f.name.includes('Effective config')).status, /Same/)
})

test('late inspection, verification and download cannot cross file/run generations', async () => {
  const h = harness('ProjectExchange'), old = deferred(), verification = deferred(), download = deferred()
  const api = { inspectProject: async (_, value) => value === 'old' ? old.promise : { ...file, runId: value }, projectFile: () => verification.promise }
  let props = { api, exercise: { id: 'x' }, run, busy: false, onApply() {} }
  let tree = h.render(props)
  const first = upload(tree, 'old')
  await Promise.resolve()
  await upload(h.render(props), 'new')
  old.resolve(file); await first
  tree = h.render(props)
  assert.match(text(tree), /Original run new/)
  assert.match(text(tree), /unverified/)
  button(tree, 'Verify replay').props.onClick()
  await upload(h.render(props), 'third')
  verification.resolve(file); await Promise.resolve(); await Promise.resolve()
  assert.ok(!nodes(h.render(props)).some((n) => n.props?.role === 'status'))
  api.projectFile = () => download.promise
  button(h.render(props), 'Export selected run').props.onClick()
  props = { ...props, run: { ...run, id: 'b' } }; h.render(props)
  download.resolve(file); await Promise.resolve(); await Promise.resolve()
  assert.equal(h.downloads, 0)
  for (const status of ['cancelled', 'running', 'failed', 'interrupted', 'timed_out', 'queued']) {
    tree = h.render({ ...props, run: { ...run, run_status: status } })
    assert.equal(button(tree, 'Export selected run').props.disabled, true)
    assert.equal(button(tree, 'Verify replay').props.disabled, true)
  }
})

test('stale request failure does not display an error after run switch', async () => {
  const h = harness('ProjectExchange'), request = deferred()
  const props = { api: { projectFile: () => request.promise }, exercise: { id: 'x' }, run, busy: false }
  button(h.render(props), 'Export selected run').props.onClick()
  const next = { ...props, run: { ...run, id: 'b' } }
  h.render(next)
  request.reject(Error('old error')); await Promise.resolve(); await Promise.resolve()
  assert.ok(!nodes(h.render(next)).some((n) => n.props?.role === 'alert'))
})
