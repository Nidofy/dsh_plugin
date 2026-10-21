import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, mkdir, copyFile, readFile, writeFile, rm, rename, chmod, stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'
import { SourceControl } from '../src/service.ts'
import { gitStatus } from '../src/parsers.ts'
import { command, resolveExecutable } from '../src/process.ts'
import type { Operation, Snapshot } from '../src/shared.ts'

const roots: string[] = [], services: SourceControl[] = []
async function temp() { const root = await mkdtemp(join(tmpdir(), 'dsh-vcs-test-')); roots.push(root); return root }
function cli(exe: string, root: string, args: string[]) {
  const result = spawnSync(exe, args, { cwd: root, encoding: 'utf8', windowsHide: true, env: { ...process.env, HGPLAIN: '1', HGENCODING: 'utf-8', GIT_TERMINAL_PROMPT: '0' } })
  if (result.status !== 0) throw Error(result.stderr || result.error?.message || result.stdout)
  return result.stdout.trim()
}
async function gitRepo() {
  const root = await temp(); cli('git', root, ['init', '-b', 'main'])
  cli('git', root, ['config', 'user.name', 'DSH test']); cli('git', root, ['config', 'user.email', 'test@example.invalid'])
  cli('git', root, ['config', 'core.autocrlf', 'false'])
  return root
}
async function service(root: string, hg?: string) {
  const value = new SourceControl(() => [root], hg ? { hg } : {}); services.push(value)
  const result = await value.list(); expect(result.warnings).toEqual([])
  const id = result.repositories[0]!.id
  return { value, id, status: () => value.status(id), op: (s: Snapshot, op: Operation) => value.mutate({ id, revision: s.revision, ...op }) }
}
afterEach(async () => {
  await Promise.all(services.splice(0).map(s => s.close()))
  for (const root of roots.splice(0)) { if (!resolve(root).startsWith(join(tmpdir(), 'dsh-vcs-test-'))) throw Error('Invalid cleanup path'); await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }) }
})

describe('Git service on real isolated repositories', () => {
  it('handles unborn index, unicode filenames, stale content, staged-only commits and replay', async () => {
    const root = await gitRepo(), s = await service(root), path = '-笔记 file.txt'
    await writeFile(join(root, path), 'alpha\n')
    let snap = await s.status(); expect(snap.head).toBe(''); expect(snap.changes[0]!.path).toBe(path)
    await writeFile(join(root, path), 'bravo\n')
    await expect(s.op(snap, { action: 'stage', paths: [path] })).rejects.toThrow('REVISION_CONFLICT')
    snap = await s.op(await s.status(), { action: 'stage', paths: [path] })
    expect(snap.stagedAdded).toBe(1)
    expect(await s.value.diff(s.id, path, true)).toContain('+bravo')
    snap = await s.op(snap, { action: 'unstage', paths: [path] }); expect(snap.changes[0]!.index).toBe('?')
    snap = await s.op(snap, { action: 'stage', paths: [path] })
    await writeFile(join(root, path), 'later edit\n')
    snap = await s.status()
    const committed = await s.op(snap, { action: 'commit', message: 'first\n\nOnly staged version' })
    expect(cli('git', root, ['show', `HEAD:${path}`])).toBe('bravo')
    expect(committed.changes[0]!.worktree).toBe('M')
    await expect(s.op(snap, { action: 'commit', message: 'replay' })).rejects.toThrow('REVISION_CONFLICT')
    expect((await s.value.history(s.id))[0]!.subject).toBe('first')
  })
  it('checks selected paths, rejects injected roots and allows only one concurrent write', async () => {
    const root = await gitRepo(), s = await service(root)
    await writeFile(join(root, 'file'), 'one\n'); const snap = await s.status()
    await expect(s.op(snap, { action: 'stage', paths: ['../outside'] })).rejects.toThrow('INVALID_PATH')
    await expect(s.value.status(root)).rejects.toThrow('REPOSITORY_UNAVAILABLE')
    const results = await Promise.allSettled([s.op(snap, { action: 'stage', paths: ['file'] }), s.op(snap, { action: 'stage', paths: ['file'] })])
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter(r => r.status === 'rejected')).toHaveLength(1)
    await expect(s.op(await s.status(), { action: 'create', branch: '--orphan' })).rejects.toThrow('CLEAN_WORKTREE_REQUIRED')
  })
  it('switches branches, exposes linked worktrees and pushes only the reviewed HEAD to a local remote', async () => {
    const root = await gitRepo(), s = await service(root)
    await writeFile(join(root, 'file'), 'one\n')
    let snap = await s.op(await s.status(), { action: 'stage', paths: ['file'] })
    snap = await s.op(snap, { action: 'commit', message: 'initial' })
    await expect(s.op(snap, { action: 'create', branch: '--bad' })).rejects.toThrow('INVALID_BRANCH')
    snap = await s.op(snap, { action: 'create', branch: 'feature/new' }); expect(snap.branch).toBe('feature/new')
    snap = await s.op(snap, { action: 'switch', branch: 'main' }); expect(snap.branch).toBe('main')
    const remote = await temp(); cli('git', remote, ['init', '--bare']); cli('git', root, ['remote', 'add', 'origin', remote])
    snap = await s.status()
    await expect(s.op(snap, { action: 'push', remote: '--all' })).rejects.toThrow('INVALID_REMOTE')
    snap = await s.op(snap, { action: 'push', remote: 'origin' })
    expect(cli('git', remote, ['rev-parse', 'refs/heads/main'])).toBe(snap.head)
    snap = await s.op(snap, { action: 'fetch', remote: 'origin' }); expect(snap.branch).toBe('main')
    const worktree = join(await temp(), 'linked'); cli('git', root, ['worktree', 'add', worktree, 'feature/new'])
    expect((await s.value.worktrees(s.id)).map(w => w.branch)).toEqual(['main', 'feature/new'])
  })
  it('handles rename records and deleted parent directories', async () => {
    expect(gitStatus('R  new name\0old name\0 M file\0')).toEqual([{ index: 'R', worktree: ' ', path: 'new name', original: 'old name' }, { index: ' ', worktree: 'M', path: 'file' }])
    const root = await gitRepo(), s = await service(root)
    await mkdir(join(root, 'sub')); await writeFile(join(root, 'sub/file'), 'text\n')
    let snap = await s.op(await s.status(), { action: 'stage', paths: ['sub/file'] })
    snap = await s.op(snap, { action: 'commit', message: 'initial' })
    await rename(join(root, 'sub/file'), join(root, 'new'))
    // Removal is scoped to this newly-created empty temporary directory.
    await rm(join(root, 'sub'), { recursive: true })
    snap = await s.op(await s.status(), { action: 'stage', paths: ['sub/file', 'new'] })
    expect(snap.changes[0]!.original).toBe('sub/file')
    snap = await s.op(snap, { action: 'unstage', paths: ['new'] })
    expect(snap.changes.some(row => row.path === 'sub/file' && row.worktree === 'D')).toBe(true)
  })
  it('invalidates old service generations, fails closed on missing tools and drains disposal', async () => {
    const root = await gitRepo(), first = await service(root), second = await service(root)
    expect((await first.status()).revision).not.toBe((await second.status()).revision)
    const broken = new SourceControl(() => [root], { git: join(root, 'missing.exe') }); services.push(broken)
    expect((await broken.list()).warnings[0]!.error).toBe('TOOL_MISSING')
    const queued = first.status(); await first.value.close(); await expect(queued).rejects.toBeDefined()
    await expect(first.status()).rejects.toBeDefined()
  })
  it('cancels an owned Git hook process tree and returns without waiting for the hook timer', async () => {
    const root = await gitRepo(), script = join(root, 'wait.cjs'), marker = join(root, 'ready')
    await writeFile(script, `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'ready'); setInterval(() => {}, 1000)`)
    const hook = join(root, '.git/hooks/pre-commit')
    await writeFile(hook, `#!/bin/sh\n"${process.execPath.replaceAll('\\', '/')}" "${script.replaceAll('\\', '/')}"\n`)
    await chmod(hook, 0o755)
    const controller = new AbortController()
    const running = command('git', ['commit', '--allow-empty', '-m', 'cancel hook'], root, controller.signal).catch(e => e)
    try {
      await expect.poll(async () => !!await stat(marker).catch(() => false), { timeout: 10000 }).toBe(true)
      controller.abort()
      expect((await running).message).toBe('CANCELLED')
    } finally { controller.abort(); await running }
    expect(cli('git', root, ['status', '--porcelain'])).toContain('ready')
  })
})

const hg = process.env.DSH_TEST_HG || 'hg'
const hgAvailable = spawnSync(hg, ['version'], { encoding: 'utf8', windowsHide: true }).status === 0
if (process.env.DSH_TEST_HG && !hgAvailable) throw Error('Explicit DSH_TEST_HG executable failed')
describe.skipIf(!hgAvailable)('Mercurial service on real isolated repositories', () => {
  async function hgRepo() {
    const root = await temp(); cli(hg, root, ['init'])
    await writeFile(join(root, '.hg/hgrc'), '[ui]\nusername = DSH test <test@example.invalid>\n')
    return root
  }
  it('tracks, forgets, commits selected files and rejects stale edits', async () => {
    const root = await hgRepo(), s = await service(root, hg)
    await writeFile(join(root, 'one'), 'alpha\n'); await writeFile(join(root, 'two'), 'bravo\n')
    let snap = await s.op(await s.status(), { action: 'add', paths: ['one', 'two'] })
    expect(snap.changes.map(row => row.worktree)).toEqual(['A', 'A'])
    snap = await s.op(snap, { action: 'forget', paths: ['two'] })
    expect(await readFile(join(root, 'two'), 'utf8')).toBe('bravo\n')
    snap = await s.op(snap, { action: 'commit', message: 'first hg', paths: ['one'] })
    expect(snap.changes.map(row => row.path)).toEqual(['two'])
    expect((await s.value.history(s.id))[0]!.subject).toBe('first hg')
    await writeFile(join(root, 'one'), 'later\n'); snap = await s.status()
    expect(await s.value.diff(s.id, 'one', false)).toContain('+later')
    await writeFile(join(root, 'one'), 'other\n')
    await expect(s.op(snap, { action: 'commit', message: 'stale', paths: ['one'] })).rejects.toThrow('REVISION_CONFLICT')
  })
  it('creates and switches named branches and exchanges changes with local remotes without updating', async () => {
    const root = await hgRepo(), remote = await hgRepo(), s = await service(root, hg)
    await writeFile(join(root, 'file'), 'initial\n')
    let snap = await s.op(await s.status(), { action: 'add', paths: ['file'] })
    snap = await s.op(snap, { action: 'commit', message: 'initial', paths: ['file'] })
    await writeFile(join(root, '.hg/hgrc'), `[ui]\nusername = DSH test <test@example.invalid>\n[paths]\ndefault = ${remote.replaceAll('\\', '/')}\n`)
    snap = await s.op(await s.status(), { action: 'push', remote: 'default' })
    expect(cli(hg, remote, ['log', '-l', '1', '-T', '{node}'])).toBe(snap.head)
    const head = snap.head
    snap = await s.op(snap, { action: 'fetch', remote: 'default' }); expect(snap.head).toBe(head)
    snap = await s.op(snap, { action: 'create', branch: 'feature' }); expect(snap.branch).toBe('feature')
    snap = await s.op(snap, { action: 'switch', branch: 'default' }); expect(snap.branch).toBe('default')
    expect(snap.head).toBe(head)
    expect(await readFile(join(root, 'file'), 'utf8')).toBe('initial\n')
    snap = await s.op(snap, { action: 'create', branch: 'feature' }); expect(snap.branch).toBe('feature')
    await writeFile(join(root, 'file'), 'feature\n')
    snap = await s.op(await s.status(), { action: 'commit', message: 'branch change', paths: ['file'] })
    snap = await s.op(snap, { action: 'switch', branch: 'default' }); expect(snap.branch).toBe('default')
    expect(await readFile(join(root, 'file'), 'utf8')).toBe('initial\n')
  }, 90_000)
})

it.skipIf(process.platform !== 'win32')('never executes a repository-local git.exe even when PATH includes that directory', async () => {
  const root = await temp(), utility = join(process.env.SystemRoot!, 'System32/whoami.exe')
  await copyFile(utility, join(root, 'git.exe'))
  const original = process.env.PATH
  try {
    process.env.PATH = root + ';.;' + original
    const executable = await resolveExecutable('git', root)
    expect(executable.toLowerCase()).not.toBe(join(root, 'git.exe').toLowerCase())
    expect(await command('git', ['--version'], root, new AbortController().signal)).toMatch(/^git version /)
    await expect(resolveExecutable(join(root, 'git.exe'), root)).rejects.toThrow('TOOL_MISSING')
  } finally { process.env.PATH = original }
})
it('preserves an ignored local file when the target branch tracks that name', async () => {
  const root = await gitRepo(), s = await service(root)
  await writeFile(join(root, '.gitignore'), '.env\n'); cli('git', root, ['add', '.gitignore']); cli('git', root, ['commit', '-m', 'base'])
  cli('git', root, ['switch', '-c', 'target']); await writeFile(join(root, '.env'), 'tracked target\n')
  cli('git', root, ['add', '-f', '.env']); cli('git', root, ['commit', '-m', 'target']); cli('git', root, ['switch', 'main'])
  await writeFile(join(root, '.env'), 'private value\n')
  const snap = await s.status(); expect(snap.changes).toEqual([])
  await expect(s.op(snap, { action: 'switch', branch: 'target' })).rejects.toThrow('COMMAND_FAILED')
  expect(await readFile(join(root, '.env'), 'utf8')).toBe('private value\n')
  expect((await s.status()).branch).toBe('main')
})
it('displays a dirty nested repository without authorizing un-fingerprinted mutations', async () => {
  const root = await gitRepo(), nested = join(root, 'nested'); await mkdir(nested)
  cli('git', nested, ['init', '-b', 'main']); cli('git', nested, ['config', 'user.name', 'DSH test']); cli('git', nested, ['config', 'user.email', 'test@example.invalid'])
  await writeFile(join(nested, 'file'), 'base'); cli('git', nested, ['add', 'file']); cli('git', nested, ['commit', '-m', 'base'])
  cli('git', root, ['add', 'nested']); cli('git', root, ['commit', '-m', 'gitlink'])
  await writeFile(join(nested, 'file'), 'dirty')
  const s = await service(root), snap = await s.status()
  expect(snap.changes.some(c => c.path === 'nested')).toBe(true)
  expect(await s.value.history(s.id)).toHaveLength(1)
  await expect(s.op(snap, { action: 'stage', paths: ['nested'] })).rejects.toThrow('UNSUPPORTED_SUBMODULE')
})
