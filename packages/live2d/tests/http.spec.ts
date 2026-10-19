import { afterAll, beforeAll, expect, it } from 'vitest'
import { createServer, request } from 'node:http'
import { readFile, mkdtemp, writeFile, mkdir, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { handleRequest, framePolicy } from '../src/index.ts'
import { assets } from '../src/assets.ts'

let assetRoot = fileURLToPath(new URL('../assets', import.meta.url))
let frameRoot: string
const server = createServer((req, res) => void handleRequest(req, res, new AbortController().signal, assetRoot, frameRoot))
let port: number
beforeAll(async () => {
  frameRoot = await mkdtemp(join(tmpdir(), 'live2d-http-'))
  await writeFile(join(frameRoot, 'frame.js'), '/* isolated frame bootstrap */')
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve)); port = (server.address() as { port: number }).port
})
afterAll(() => new Promise<void>(resolve => server.close(() => resolve())))
function get(path: string, method = 'GET') {
  return new Promise<{ status: number; headers: Record<string, unknown>; body: Buffer }>((resolve, reject) => {
    const req = request({ hostname: '127.0.0.1', port, path: '/api/nidofy-live2d/' + path, method }, res => {
      const chunks: Buffer[] = []; res.on('data', chunk => chunks.push(chunk))
      res.on('end', () => resolve({ status: res.statusCode!, headers: res.headers, body: Buffer.concat(chunks) }))
    }); req.on('error', reject); req.end()
  })
}
it('serves the entire fixed model closure and matches the recorded offline bytes', async () => {
  const manifest = JSON.parse(await readFile(new URL('../assets/manifest.json', import.meta.url), 'utf8')) as Record<string, string>
  for (const file of Object.keys(assets)) {
    const result = await get('assets/' + file)
    expect(result.status, file).toBe(200)
    expect(createHash('sha256').update(result.body).digest('hex')).toBe(manifest[file])
    expect(result.headers['x-content-type-options']).toBe('nosniff')
  }
})
it('rejects traversal, encoded paths, unknown files and methods', async () => {
  for (const path of ['assets/../package.json', 'assets/%2e%2e/package.json', 'assets/..\\package.json', 'assets/live2d/SOURCE.txt', 'assets/toString', 'assets/upperbody.png/extra', 'assets/https://example.com/model'])
    expect((await get(path)).status, path).toBe(404)
  expect((await get('assets/upperbody.png', 'POST')).status).toBe(405)
  const head = await get('assets/upperbody.png', 'HEAD')
  expect(head.status).toBe(200); expect(head.body.length).toBe(0)
})
it('isolates the frame document with CSP and no same-origin privilege', async () => {
  const result = await get('frame')
  expect(result.status).toBe(200)
  expect(result.headers['content-security-policy']).toBe(framePolicy)
  expect(framePolicy).toContain("connect-src 'none'")
  expect(framePolicy).toContain('sandbox allow-scripts')
  expect(framePolicy).not.toContain('allow-same-origin')
  expect(result.body.toString()).toContain('<canvas>')
})
it('refuses a whitelisted filename reached through a package-escaping directory junction', async () => {
  const root = await mkdtemp(join(tmpdir(), 'live2d-links-')), previous = assetRoot
  await mkdir(join(root, 'assets')); await mkdir(join(root, 'outside'))
  await writeFile(join(root, 'outside/bluewhale.moc3'), 'MOC3 external')
  await symlink(join(root, 'outside'), join(root, 'assets/live2d'), process.platform === 'win32' ? 'junction' : 'dir')
  assetRoot = join(root, 'assets')
  try { expect((await get('assets/live2d/bluewhale.moc3')).status).toBe(404) }
  finally { assetRoot = previous }
})
