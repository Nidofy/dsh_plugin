import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { it } from 'node:test'
import { act,createElement } from 'react'
import { mkdtemp,rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Engine } from '../src/engine.ts'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'
import { loadCatalog } from '../src/catalog.ts'

function enableJsx() {
  return registerHooks({ load(url, context, next) {
    if (!url.endsWith('.tsx')) return next(url, context)
    const source = ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ESNext, jsx: ts.JsxEmit.ReactJSX }
    }).outputText
    return { format: 'module', shortCircuit: true, source }
  } })
}

it('renders each lecture and embedded explorer in both locales and escapes supplied text', async () => {
  const hook = enableJsx()
  try {
    const { MarkdownView } = await import('../src/components/MarkdownView.tsx')
    const { LessonExplorer } = await import('../src/components/LessonExplorer.tsx')
    const c = await loadCatalog()
    const text = '<img src="example"> & <script>fixture</script>'
    for (const locale of ['zh', 'en'] as const) {
      for (const lesson of c.lessons) {
        const html = renderToStaticMarkup(createElement(MarkdownView, { locale, markdown: lesson.body[locale]+'\n\n'+text, glossary: c.glossary }))
        assert.match(html, /&lt;img/)
        assert.doesNotMatch(html, /<(script|img)\b/i)
        if (lesson.simulatorWidget) {
          const widget = renderToStaticMarkup(createElement(LessonExplorer, { widget: lesson.simulatorWidget, locale,
            measuredPoints: [], simulatorExercise: { goalDescription: { zh: text, en: text }, onComplete() {} } }))
          assert.match(widget, /&lt;img/)
          assert.doesNotMatch(widget, /<(script|img)\b/i)
        }
      }
    }
  } finally { hook.deregister() }
})

it('submits all five interactive explorers through their controls and the Host grading path',async()=>{
  const {JSDOM}=await import('jsdom')
  const dom=new JSDOM('<main></main>')
  Object.assign(globalThis,{window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true})
  const {createRoot}=await import('react-dom/client')
  const root=createRoot(dom.window.document.querySelector('main')!)
  const hook=enableJsx()
  const dir=await mkdtemp(join(tmpdir(),'infra-explorers-'))
  const engine=await Engine.open(dir)
  try {
    const {LessonExplorer}=await import('../src/components/LessonExplorer.tsx')
    const change=async(label:string,value:string)=>{
      const group=[...document.querySelectorAll('label')].find(l=>l.textContent?.trim().startsWith(label))
      assert.ok(group,label)
      await act(async()=>{
        const select=group.querySelector('select')
        if (select) { select.value=value; select.dispatchEvent(new dom.window.Event('change',{bubbles:true})) }
        else group.querySelector('input')!.click()
      })
    }
    const paths: Record<string,[string,string][]> = {
      'B04-sim':[['Stride','4']],
      'C02-sim':[['Recompute activations',''],['Optimizer','SGD']],
      'D05-sim':[['Schedule','1F1B']],
      'E02-sim':[['Batching','continuous']],
      'X01-sim':[['TP','8'],['Workload','train13b'],['TP','2'],['Total batch','8'],['ZeRO','1']],
    }
    for (const [id,path] of Object.entries(paths)) {
      const ex=engine.exercise(id)
      await act(async()=>root.render(createElement(LessonExplorer,{key:id,locale:'en',widget:ex.simulator!.widget,
        measuredPoints:[],simulatorExercise:{goalDescription:ex.simulator!.goalDescription,
          onComplete:summary=>assert.equal(engine.completeSimulator(id,summary).status,'passed')}})))
      const button=document.querySelector('footer button') as HTMLButtonElement
      assert.ok(button.disabled,id)
      for (const [label,value] of path) await change(label,value)
      assert.equal(button.disabled,false,id)
      await act(async()=>button.click())
      assert.ok(engine.overview().evidence.some(e=>e.exerciseId===id && e.result==='passed'))
    }
  } finally {
    await act(async()=>root.unmount())
    hook.deregister()
    await engine.close()
    await rm(dir,{recursive:true,force:true})
    dom.window.close()
    for (const name of ['window','document','IS_REACT_ACT_ENVIRONMENT']) Reflect.deleteProperty(globalThis,name)
  }
})
