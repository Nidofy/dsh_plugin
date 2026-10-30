import { readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'
import { createHash } from 'node:crypto'

const root = resolve(import.meta.dirname, '../docs/ai-village/v015-v016/baseline')
const runs = []
for (const label of await readdir(root)) {
  const directory = join(root, label)
  const resultFile = join(directory, 'result.json')
  if (!await stat(resultFile).catch(() => null)) continue
  const result = JSON.parse(await readFile(resultFile, 'utf8'))
  const files = []
  async function walk(directoryPart) {
    for (const entry of await readdir(directoryPart, { withFileTypes: true })) {
      const path = join(directoryPart, entry.name)
      if (entry.isDirectory()) await walk(path)
      else if (entry.isFile()) {
        const bytes = await readFile(path)
        files.push({ file: relative(directory, path).replaceAll('\\', '/'), bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') })
      }
    }
  }
  await walk(directory)
  runs.push({ label, status: result.status, version: result.build.version, mode: result.mode, artifact: result.build.artifact, checks: result.checks, failure: result.failure,
    screenshots: files.filter(file => file.file.endsWith('.png')).length, videos: files.filter(file => file.file.endsWith('.webm')).length, files })
}
await writeFile(resolve(root, '../browser-evidence-index.json'), JSON.stringify({ runs }, null, 2) + '\n')
console.log(JSON.stringify({ runs: runs.length, pass: runs.filter(run => run.status === 'PASS').length, fail: runs.filter(run => run.status === 'FAIL').length,
  screenshots: runs.reduce((total, run) => total + run.screenshots, 0), videos: runs.reduce((total, run) => total + run.videos, 0) }, null, 2))
