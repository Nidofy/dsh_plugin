import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { it } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'
import { loadCatalog } from '../src/catalog.ts'

it('renders each lecture and embedded explorer in both locales and escapes supplied text', async () => {
  const hook = registerHooks({ load(url, context, next) {
    if (!url.endsWith('.tsx')) return next(url, context)
    const source = ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ESNext, jsx: ts.JsxEmit.ReactJSX }
    }).outputText
    return { format: 'module', shortCircuit: true, source }
  } })
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
