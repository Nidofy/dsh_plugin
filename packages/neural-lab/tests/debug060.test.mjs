// Mock React hook/JSX harness; executes production component handlers, not a browser or Host.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

function harness() {
  const state = [], modules = new Map()
  let cursor = 0
  const jsx = (type, props) => ({ type, props })
  const hooks = { useState(initial) {
    const index = cursor++
    if (!(index in state)) state[index] = initial
    return [state[index], (value) => { state[index] = value }]
  } }
  function load(url) {
    if (modules.has(url.href)) return modules.get(url.href)
    const exports = {}
    modules.set(url.href, exports)
    vm.runInNewContext(ts.transpileModule(readFileSync(url, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    }).outputText, { exports, require(id) {
      if (id === 'react') return hooks
      if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx }
      return load(new URL(id, url))
    } })
    return exports
  }
  const model = load(new URL('../src/debug-model.ts', import.meta.url))
  const { DebugWorkbench } = load(new URL('../src/components/DebugWorkbench.tsx', import.meta.url))
  return { model, render(props) { cursor = 0; return DebugWorkbench(props) } }
}
function nodes(tree) {
  if (!tree || typeof tree !== 'object') return []
  if (Array.isArray(tree)) return tree.flatMap(nodes)
  if (typeof tree.type === 'function') return nodes(tree.type(tree.props))
  return [tree, ...nodes(tree.props?.children)]
}
function text(tree) {
  if (Array.isArray(tree)) return tree.map(text).join('')
  if (tree && typeof tree === 'object') return text(typeof tree.type === 'function' ? tree.type(tree.props) : tree.props?.children)
  return String(tree ?? '')
}
const button = (tree, label) => nodes(tree).find((n) => n.type === 'button' && text(n).includes(label))
const exercise = { id: 'project', components: [
  { name: 'embed', version: '1', dependsOn: [] },
  { name: 'attention', version: '1', dependsOn: ['embed'] },
  { name: 'ffn', version: '1', dependsOn: ['attention'] },
] }
const event = (seq, name, extra = {}) => ({ runId: 'a', seq, name, type: 'check', passed: true, ...extra })
const run = { id: 'a', exerciseId: 'project', code: '# %% embed\nEMBED_A\n# %% attention\nATTENTION_A\n# %% ffn\nFFN_A\n', run_status: 'completed', check_status: 'failed', codeHash: 'hash-a', events: [
  event(4, 'module ffn', { passed: false, component: 'ffn', layer: 1 }),
  event(2, 'module attention', { passed: false, component: 'attention', layer: 0, source: 'program' }),
  event(3, 'attention.layer1.head0', { type: 'tensor', shape: [4, 4], source: 'student', step: 1 }),
  event(1, 'gradient_norm', { type: 'metric', value: 6, source: 'program', step: 1 }),
  event(0, 'module embed', { runId: 'foreign', passed: false }),
] }

test('model isolates run, sorts first failure, retains real dependencies and refuses aggregate attribution', () => {
  const { model } = harness()
  const result = model.debugModel(run, exercise)
  assert.equal(result.observations.length, 4)
  assert.equal(result.foreignEvents, 1)
  assert.equal(result.firstFailure.event.seq, 2)
  assert.equal(result.observations[0].component, undefined)
  assert.equal(result.edges[1].from, 'attention')
  assert.equal(result.edges[1].to, 'ffn')
  assert.equal(result.layers.join(','), '0,1')
  assert.equal(model.componentObservations(result.observations, 'attention', 1)[0].event.seq, 3)
  assert.equal(model.debugModel(run, { ...exercise, id: 'different' }).observations.length, 0)
  assert.equal(model.debugObservation(event(5, 'module ffn', { component: 'unknown' }), new Set(['ffn'])).component, undefined)
})

test('component selection, keyboard navigation, source slices and tutor payload follow selected run', () => {
  const h = harness(), requests = []
  let props = { run, exercise, draft: 'changed', onTutor: (ctx) => requests.push(ctx) }
  let tree = h.render(props)
  assert.match(text(tree), /Draft changed/)
  button(tree, 'Attention 注意力').props.onClick()
  tree = h.render(props)
  assert.match(text(tree), /ATTENTION_A/)
  assert.doesNotMatch(text(tree), /EMBED_A/)
  button(tree, '步骤 / Steps').props.onClick()
  tree = h.render(props)
  button(tree, 'Ask tutor').props.onClick()
  assert.equal(requests[0].runId, 'a')
  assert.equal(requests[0].component, 'attention')
  assert.equal(requests[0].check, 'module attention')
  assert.equal(requests[0].level, 'steps')
  let focused = false, prevented = false
  button(tree, 'Attention 注意力').props.onKeyDown({ key: 'ArrowRight', preventDefault() { prevented = true }, currentTarget: { parentElement: { querySelectorAll: () => [{}, {}, { focus() { focused = true } }] } } })
  tree = h.render(props)
  assert.equal(prevented && focused, true)
  assert.match(text(tree), /FFN_A/)
  props = { ...props, run: { ...run, id: 'b', codeHash: 'hash-b', code: run.code.replaceAll('_A', '_B'), events: [] } }
  tree = h.render(props)
  assert.match(text(tree), /EMBED_B/)
  assert.doesNotMatch(text(tree), /FFN_A|ATTENTION_A|#2 module attention/)
  button(tree, 'Ask tutor').props.onClick()
  assert.equal(requests[1].runId, 'b')
  assert.equal(requests[1].component, 'embed')
  assert.equal(requests[1].level, 'concept')
  assert.equal(requests[1].check, undefined)
})

test('layer filters never promote unknown/global evidence and incomplete/legacy states are explicit', () => {
  const h = harness()
  const props = { run, exercise, draft: run.code }
  let tree = h.render(props)
  button(tree, 'Attention 注意力').props.onClick()
  tree = h.render(props)
  nodes(tree).find((n) => n.type === 'select').props.onChange({ target: { value: '1' } })
  tree = h.render(props)
  assert.equal(nodes(tree).filter((n) => n.type === 'td').some((n) => text(n).includes('#2 module attention')), false)
  assert.match(text(tree), /Not sampled for this component and layer/)
  for (const status of ['queued', 'running', 'cancelled', 'failed', 'timed_out', 'interrupted']) {
    tree = h.render({ ...props, run: { ...run, run_status: status, events: [] } })
    assert.match(text(tree), /Waiting for run samples|Run incomplete/)
    assert.match(text(tree), /Layer information not sampled/)
  }
  tree = h.render({ ...props, run: { ...run, code: 'old source', components: undefined, codeHash: undefined, events: [] } })
  assert.match(text(tree), /Component markers unavailable/)
  assert.match(text(tree), /Not recorded/)
})
