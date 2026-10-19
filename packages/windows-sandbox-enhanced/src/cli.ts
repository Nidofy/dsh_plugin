#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises'
import { parseAudit, recoveryPlan, scanNative } from './audit.ts'
import { bundledHelper } from './helper.ts'
import { protectionStatus, SafetyError } from './contracts.ts'

async function main(args: string[]) {
  const [command, ...rest] = args
  if (command === 'doctor' && rest.length === 0) {
    const nativeHelper = await bundledHelper().then(() => 'verified', () => 'unavailable')
    if (nativeHelper === 'unavailable') process.exitCode = 1
    return { ...protectionStatus(), platform: process.platform, architecture: process.arch, nativeHelper }
  }
  if (command === 'scan' && rest.length === 1) return scanNative(await bundledHelper(), rest[0]!)
  if (command === 'recovery-plan' && rest.length === 2) {
    const before = JSON.parse(await readFile(rest[0]!, 'utf8')), after = JSON.parse(await readFile(rest[1]!, 'utf8'))
    return recoveryPlan(parseAudit(before, before.root), parseAudit(after, before.root))
  }
  throw new SafetyError('Usage: dsh-windows-sandbox doctor | scan <root> | recovery-plan <before.json> <after.json> [--out <new-file>]')
}
const args = process.argv.slice(2), outputIndex = args.indexOf('--out')
let output: string | undefined
try {
if (outputIndex >= 0) {
  if (outputIndex !== args.length - 2 || !args[outputIndex + 1]) throw new SafetyError('INVALID_OUTPUT_ARGUMENT')
  output = args[outputIndex + 1]; args.splice(outputIndex, 2)
}
  const json = JSON.stringify(await main(args), null, 2) + '\n'
  // Never overwrite an earlier baseline; stdout can be redirected explicitly by the operator.
  if (output) await writeFile(output, json, { flag: 'wx' }); else process.stdout.write(json)
} catch (error) {
  process.stderr.write(JSON.stringify({ error: error instanceof Error ? error.message : 'FAILED' }) + '\n')
  process.exitCode = 1
}
