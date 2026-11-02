/** Owns one isolated official Web profile; always stops its server and removes only its own session. */
import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, readFile, writeFile, copyFile, realpath, rm } from 'node:fs/promises'
import { resolve, join, relative, isAbsolute, basename, dirname } from 'node:path'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'
const base = resolve(import.meta.dirname, '..')
const repo = resolve(base, '../../../..')
const output = join(base, '.build/ui')
await mkdir(output, { recursive: true })
const deep = process.env.NEURAL_UI_DEEP === '1'
const prefix = deep ? 'deep-' : ''
const evidencePath = join(output, `${prefix}official-validation.json`)
const diagnostic = { deep, probes: [], cleanupCompleted: false }
const scratch = deep ? output : resolve(base, '../../.build/u')
await mkdir(scratch, { recursive: true })
const session = await mkdtemp(join(scratch, 'session-official-'))
const home = join(session, 'home')
const cli = join(repo, '.build/official-runtime-rc5/node_modules/@deepseek-ai/dsh/lib/bin.js')
const environment = { ...process.env, DSH_HOME: home, DEEPSEEK_API_KEY: '' }
const profile = deep ? 'neural-qualification' : 'q'
let server
let evidenceWritten = false
function command(args, env = environment, timeout = 120000) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd: base, env, windowsHide: true })
    let output = ''
    const timer = setTimeout(() => {
      child.kill()
      reject(Error('Command timed out'))
    }, timeout)
    child.stdout.on('data', (data) => {
      output += data.toString()
    })
    child.stderr.on('data', (data) => {
      output += data.toString()
    })
    child.once('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.once('close', (code) => {
      clearTimeout(timer)
      code === 0 ? resolve(output) : reject(Error(`Command exit ${code}: ${output}`))
    })
  })
}
async function probe(runtime, uid) {
  return await new Promise((resolve) => {
    const child = spawn(
      'C:/Program Files/Docker/Docker/resources/bin/docker.exe',
      [
        'run',
        '--rm',
        '--pull=never',
        '--network=none',
        '--read-only',
        '--cap-drop=ALL',
        '--user',
        `${uid}:${uid}`,
        '--mount',
        `type=bind,source=${runtime},target=/runtime,readonly`,
        '--entrypoint',
        'python',
        'dsh-neural-lab-cpu:0.1',
        '-c',
        "from pathlib import Path; p=Path('/runtime/student.py'); print('student.py bytes:',len(p.read_bytes()))",
      ],
      { cwd: base, env: environment, windowsHide: true },
    )
    let stdout = '',
      stderr = ''
    const timer = setTimeout(() => child.kill(), 30000)
    child.stdout.on('data', (data) => {
      stdout += data.toString()
    })
    child.stderr.on('data', (data) => {
      stderr += data.toString()
    })
    child.once('error', (error) => {
      stderr += error.message
    })
    child.once('close', (exitCode, signal) => {
      clearTimeout(timer)
      resolve({ uid, exitCode, signal, stdout, stderr })
    })
  })
}
try {
  const version = JSON.parse(await readFile(join(base, 'package.json'), 'utf8')).version
  const archive = join(base, `dsh-plugin-neural-lab-${version}.tgz`)
  const hash = createHash('sha256')
    .update(await readFile(archive))
    .digest('hex')
  diagnostic.version = version
  diagnostic.tarSha256 = hash
  const candidate = join(session, `n-${hash.slice(0, 8)}.tgz`)
  await copyFile(archive, candidate)
  await command([cli, '--profile', profile, '--from-default-profile', 'web', '--help'])
  await command([
    cli,
    'plugin',
    '--profile',
    profile,
    'add',
    candidate,
    '--offline',
    '--store-dir',
    join(repo, '.pnpm-store'),
  ])
  if (process.env.NEURAL_WITH_LEARN === '1')
    await command([
      cli,
      'plugin',
      '--profile',
      profile,
      'add',
      join(repo, 'dist/dsh-plugin-learn-0.5.2.tgz'),
      '--offline',
      '--store-dir',
      join(repo, '.pnpm-store'),
    ])
  const installed = join(home, 'profiles', profile, 'node_modules/dsh-plugin-neural-lab')
  const runtimePath = await realpath(join(installed, 'runtime/student.py'))
  await writeFile(
    join(output, `${prefix}official-runtime-path.json`),
    JSON.stringify({ runtimePath, length: runtimePath.length }, null, 2),
  )
  diagnostic.runtimePath = runtimePath
  diagnostic.runtimePathLength = runtimePath.length
  if (deep) {
    for (const uid of [0, 65534]) diagnostic.probes.push(await probe(dirname(runtimePath), uid))
    await writeFile(join(output, 'deep-diagnostic.json'), JSON.stringify(diagnostic, null, 2))
    console.log(JSON.stringify(diagnostic))
  }
  const hashes = {}
  for (const file of [
    'lib/index.js',
    'lib/client.js',
    'content/catalog.json',
    'runtime/controller.py',
  ]) {
    const expected = createHash('sha256')
      .update(await readFile(join(base, file)))
      .digest('hex')
    const actual = createHash('sha256')
      .update(await readFile(join(installed, file)))
      .digest('hex')
    assert.equal(actual, expected, `Installed artifact differs: ${file}`)
    hashes[file] = actual
  }
  server = spawn(
    process.execPath,
    [cli, '--profile', profile, '--host', '127.0.0.1', '--port', '0', '--no-open'],
    { cwd: base, env: environment, windowsHide: true },
  )
  const url = await new Promise((resolve, reject) => {
    let text = ''
    const timer = setTimeout(() => reject(Error('Official Web startup timed out')), 60000)
    const receive = (data) => {
      text += data.toString()
      const match = /dsh web: (http:\/\/\S+)/.exec(text)
      if (match) {
        clearTimeout(timer)
        resolve(match[1])
      }
    }
    server.stdout.on('data', receive)
    server.stderr.on('data', receive)
    server.once('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    server.once('exit', (code) => {
      clearTimeout(timer)
      reject(Error(`Official Web exit ${code}`))
    })
  })
  const result = await command(
    [join(base, 'tests/ui-official.mjs')],
    {
      ...environment,
      NEURAL_WEB_URL: url,
      NEURAL_EVIDENCE_PREFIX: prefix,
      NEURAL_PROFILE_NAME: profile,
    },
    240000,
  )
  await new Promise((resolve) => {
    server.once('close', resolve)
    server.kill('SIGINT')
  })
  await command([
    cli,
    'plugin',
    '--profile',
    profile,
    'remove',
    'dsh-plugin-neural-lab',
    '--store-dir',
    join(repo, '.pnpm-store'),
  ])
  const manifest = JSON.parse(
    await readFile(join(home, 'profiles', profile, 'package.json'), 'utf8'),
  )
  assert.ok(!manifest.dependencies?.['dsh-plugin-neural-lab'])
  const evidence = JSON.parse(await readFile(evidencePath, 'utf8'))
  evidence.checks.push('official CLI removes package from temporary profile')
  evidence.installedHashes = hashes
  evidence.tarSha256 = hash
  evidence.profileCleanup =
    'The invocation-owned official profile and server are disposed in finally.'
  await writeFile(evidencePath, JSON.stringify(evidence, null, 2))
  diagnostic.officialWebPassed = true
  evidenceWritten = true
  console.log(result.trim())
  console.log(`PASS installed identity ${hash}`)
} catch (error) {
  diagnostic.error = String(error)
  throw error
} finally {
  if (server && server.exitCode === null && server.signalCode === null) {
    await new Promise((resolve) => {
      server.once('close', resolve)
      server.kill('SIGINT')
    })
  }
  const root = await realpath(scratch),
    created = await realpath(session),
    part = relative(root, created)
  if (
    !part ||
    isAbsolute(part) ||
    part.startsWith('..') ||
    !basename(created).startsWith('session-official-')
  )
    throw Error('Refusing cleanup outside invocation-owned session')
  await rm(created, { recursive: true, force: true, maxRetries: 3, retryDelay: 150 })
  diagnostic.cleanupCompleted = true
  diagnostic.serverStopped = !server || server.exitCode !== null || server.signalCode !== null
  if (deep)
    await writeFile(join(output, 'deep-diagnostic.json'), JSON.stringify(diagnostic, null, 2))
  if (evidenceWritten) {
    const evidence = JSON.parse(await readFile(evidencePath, 'utf8'))
    evidence.cleanupCompleted = true
    evidence.serverStopped = server?.exitCode !== null || server?.signalCode !== null
    await writeFile(evidencePath, JSON.stringify(evidence, null, 2))
  }
}
