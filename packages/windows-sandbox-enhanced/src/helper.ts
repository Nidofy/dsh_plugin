import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SafetyError } from './contracts.ts'

export async function bundledHelper() {
  const directory = fileURLToPath(new URL('../native/runtime/', import.meta.url))
  const manifest = JSON.parse(await readFile(join(directory, 'manifest.json'), 'utf8')) as { files: Record<string, string>; architecture: string }
  if (manifest.architecture !== process.arch || !manifest.files ||
      !manifest.files['DshSandboxAudit.exe'] || !manifest.files['DshSandboxAudit.dll']) throw new SafetyError('HELPER_PLATFORM_MISMATCH')
  for (const [name, expected] of Object.entries(manifest.files)) {
    if (!/^[\w.-]+$/.test(name) || !/^[a-f0-9]{64}$/.test(expected)) throw new SafetyError('INVALID_HELPER_MANIFEST')
    if (createHash('sha256').update(await readFile(join(directory, name))).digest('hex') !== expected) throw new SafetyError('HELPER_HASH_MISMATCH')
  }
  return { executable: join(directory, 'DshSandboxAudit.exe'), sha256: manifest.files['DshSandboxAudit.exe'] }
}
