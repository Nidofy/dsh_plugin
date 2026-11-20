import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'
import { describe, it } from 'node:test'
import { Script } from 'node:vm'

const pkgDir = resolve(import.meta.dirname, '..')
const require = createRequire(import.meta.url)

describe('UI bundle safety, i18n registration, and slot lifecycle', () => {
  it('forbids dangerouslySetInnerHTML, innerHTML assignment, and eval across all UI sources', async () => {
    const files = (await readdir(join(pkgDir, 'src'), { recursive: true }))
      .filter((f) => /\.tsx?$/.test(String(f)))
      .map((f) => join(pkgDir, 'src', String(f)))
    assert.ok(files.length >= 10)
    for (const f of files) {
      const src = await readFile(f, 'utf8')
      assert.doesNotMatch(src, /dangerouslySetInnerHTML/, `Forbidden dangerouslySetInnerHTML in ${f}`)
      assert.doesNotMatch(src, /\.innerHTML\s*=/, `Forbidden innerHTML mutation in ${f}`)
      assert.doesNotMatch(src, /\beval\s*\(/, `Forbidden eval() in ${f}`)
    }
  })

  it('loads production lib/client.js factory, mounts/disposes slots cleanly, and renders Workbench SSR without error', async () => {
    const code = await readFile(join(pkgDir, 'lib/client.js'), 'utf8')
    let loaded: { id: string; factory: (req: (id: string) => unknown) => any } | undefined
    new Script(code).runInNewContext({
      window: {
        __ModuleLoader__: {
          load(entry: any) {
            loaded = entry
          },
        },
      },
    })
    assert.ok(loaded)
    assert.equal(loaded.id, 'dsh-plugin-ai-infra-lab')

    const clientMod = loaded.factory((id: string) => {
      if (id === 'react' || id === 'react/jsx-runtime' || id === 'react-dom') {
        return require(id)
      }
      throw Error(`Unexpected runtime require: ${id}`)
    })
    assert.deepEqual([...clientMod.inject], ['slots', 'locale', 'layout'])
    assert.equal(typeof clientMod.apply, 'function')

    const activeRegs = new Set<string>()
    const disposers: Array<() => void> = []
    let mainComponent: any

    const fakeCtx = {
      effect(fn: () => () => void) {
        disposers.push(fn())
      },
      locale: {
        register(ns: string, dict: Record<string, { title: string }>) {
          assert.equal(ns, 'ai-infra-lab')
          assert.ok(dict.zh?.title.includes('AI Infra Lab'))
          assert.ok(dict.en?.title.includes('AI Infra Lab'))
          activeRegs.add('locale:' + ns)
          return () => activeRegs.delete('locale:' + ns)
        },
        bind() {
          return () => 'AI Infra Lab'
        },
      },
      slots: {
        inject(slotName: string, cb: () => () => void) {
          disposers.push(cb())
        },
        register(meta: { name: string; key?: string; id?: string }, comp: any) {
          const tag = `${meta.name}:${meta.key ?? meta.id}`
          activeRegs.add(tag)
          if (meta.name === 'main') mainComponent = comp
          return () => activeRegs.delete(tag)
        },
      },
    }

    // Cycle twice to verify zero leaked registrations
    for (let i = 0; i < 2; i++) {
      clientMod.apply(fakeCtx)
      assert.equal(activeRegs.size, 3)
      assert.ok(mainComponent)
      while (disposers.length) disposers.pop()!()
      assert.equal(activeRegs.size, 0)
    }

    // SSR render Workbench shell with a stub API
    const React = require('react')
    const { renderToStaticMarkup } = require('react-dom/server')
    const stubApi = new Proxy(
      {},
      {
        get: () => () => new Promise(() => {}),
      },
    )
    const html = renderToStaticMarkup(React.createElement(mainComponent, { api: stubApi }))
    assert.ok(html.length > 50)
    assert.ok(!html.includes('<script'), 'Rendered markup must never contain raw <script>')
  })
})
