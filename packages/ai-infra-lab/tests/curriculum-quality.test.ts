import assert from 'node:assert/strict'
import { it } from 'node:test'
import { loadCatalog } from '../src/catalog.ts'

const catalog = await loadCatalog()
const locales = ['zh', 'en'] as const
const headings = {
  zh: ['为什么学这一节', '直觉类比与图解', '一步步算一个例子', '动手前先预测', '本节小结'],
  en: ['Why Learn This', 'Intuition & Diagram', 'Step-by-Step Worked Example', 'Predict Before You Run', 'Key Takeaways'],
}

it('checks five ordered sections, a real diagram or table, prediction, takeaways and substantive prose in both languages', () => {
  assert.equal(catalog.lessons.length, 26)
  for (const lesson of catalog.lessons) for (const locale of locales) {
    const body = lesson.body[locale]
    const label = lesson.id + '/' + locale
    const titles = [...body.matchAll(/^### (.+)$/gm)].map(match => match[1]!)
    assert.equal(titles.length, 5, label)
    headings[locale].forEach((title, index) => assert.ok(titles[index]!.startsWith(title), label + ' ' + title))
    const diagrams = [...body.matchAll(/^\x60{3}[^\n]*\n([\s\S]*?)^\x60{3}/gm)]
    const visual = diagrams.some(match => match[1]!.split('\n').filter(line => line.trim()).length >= 2) ||
      /^\|.+\|\s*\n\|[\s:|\-]+\|\s*\n\|.+\|/m.test(body)
    assert.ok(visual, label + ' missing visual')
    const prose = body.replace(/^###.*$/gm, '').replace(/\x60{3}[\s\S]*?\x60{3}/g, '')
    assert.ok(prose.trim().length >= (locale === 'zh' ? 550 : 1200), label + ' insufficient prose')
    const takeaways = body.slice(body.lastIndexOf('### '))
    assert.ok((takeaways.match(/^[-*] /gm) ?? []).length >= 2, label + ' missing takeaways')
  }
})

// Coverage of the shorter text catches a copied prompt embedded inside a longer hint too.
function overlap(a: string, b: string): number {
  const grams = (s: string) => {
    const normalized = s.toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu, '')
    return new Set(Array.from({length: Math.max(1, normalized.length - 3)}, (_, i) => normalized.slice(i, i+4)))
  }
  const first = grams(a), second = grams(b)
  return [...first].filter(part => second.has(part)).length / Math.min(first.size, second.size)
}

it('rejects repeated levels and more than 70 percent overlap with the question for every exercise', () => {
  const all = catalog.lessons.flatMap(lesson => lesson.exercises)
  assert.equal(all.length, 57)
  for (const ex of all) for (const locale of locales) {
    assert.equal(ex.hints.length, 4, ex.id)
    const previous = [ex.prompt[locale]]
    for (const hint of ex.hints) {
      const value = hint[locale].trim()
      assert.ok(value.length >= (locale === 'zh' ? 12 : 30), ex.id)
      assert.ok(previous.every(text => overlap(text, value) <= 0.70), ex.id + '/' + locale)
      previous.push(value)
    }
  }
})

it('checks each of the 28 B–X microsteps for an unchanged signature and bilingual input, boundary and recurrence scaffolding', () => {
  const labs = catalog.lessons.filter(l => l.stage !== 'A').flatMap(l => l.exercises.filter(e => e.kind === 'code'))
  assert.equal(labs.length, 14)
  let total = 0
  for (const ex of labs) {
    const signatures = (code: string) => [...code.matchAll(/^def (\w+\([^\n]*\)):/gm)].map(m => m[1])
    assert.deepEqual(signatures(ex.starter), signatures(ex.reference), ex.id)
    for (const section of ex.starter.split(/^def /m).slice(1)) {
      total++
      for (const label of ['输入','边界','思路','Input','Edge','Guide']) {
        assert.ok(section.includes('# '+label+' · '), ex.id+' '+label)
      }
    }
  }
  assert.equal(total, 28)
})
