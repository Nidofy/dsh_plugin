import { afterEach, expect, it, vi } from 'vitest'
import { readFile } from 'node:fs/promises'
import { loadBluewhale } from '../src/client/resources.ts'
afterEach(() => vi.unstubAllGlobals())
it('loads the existing offline model without following model-specified URLs', async () => {
  const paths: string[] = []
  vi.stubGlobal('fetch', async (url: string) => {
    const path = url.split('/live2d/')[1]!; paths.push(path)
    return new Response(await readFile(new URL('../assets/live2d/' + path, import.meta.url)))
  })
  const bytes = await loadBluewhale(new AbortController().signal)
  expect(new TextDecoder().decode(bytes.moc.slice(0, 4))).toBe('MOC3')
  expect(paths).toHaveLength(5)
})
it('rejects a remote model reference before requesting it', async () => {
  const model = JSON.parse(await readFile(new URL('../assets/live2d/bluewhale.model3.json', import.meta.url), 'utf8'))
  model.FileReferences.Textures = ['https://example.com/texture.png']
  const fetch = vi.fn(async () => new Response(JSON.stringify(model))); vi.stubGlobal('fetch', fetch)
  await expect(loadBluewhale(new AbortController().signal)).rejects.toThrow('LIVE2D_REFERENCE_REFUSED')
  expect(fetch).toHaveBeenCalledOnce()
})
