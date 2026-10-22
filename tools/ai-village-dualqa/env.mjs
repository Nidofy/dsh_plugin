import { createRequire } from 'node:module'
import { resolve, join, dirname } from 'node:path'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
export const root = resolve(import.meta.dirname, '../..')
export const donor = resolve(process.env.DUALQA_DEPS || join(root, '../dsh_plugin'))
export const requireTool = createRequire(join(donor, 'package.json'))
export const requireArt = createRequire(join(donor, 'packages/ai-village/package.json'))
export const generated = join(root, 'tools/ai-village-dualqa/.generated')
export const evidence = join(root, 'docs/ai-village/entrance-parallel/qa')
export const git = (...args) => execFileSync('git', ['-c', 'safe.directory=*', ...args], {cwd:root, encoding:'utf8',windowsHide:true}).trim()
export const json = path => JSON.parse(readFileSync(path,'utf8'))
export const baseline = json(join(donor,'.build/sandbox-enhanced/baseline.json'))
export const source = json(join(donor,'.local/environment.json')).source
export const sha256 = async bytes => (await import('node:crypto')).createHash('sha256').update(bytes).digest('hex')
export function resolveDependency(id) {
  for (const req of [requireArt,requireTool,createRequire(join(source,'packages/client/connection/package.json')),createRequire(join(donor,'.build/live2d-official-deps/package.json'))]) {
    try { return req.resolve(id) } catch {}
  }
}
