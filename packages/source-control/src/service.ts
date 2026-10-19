import { createHash, randomUUID } from 'node:crypto'
import { realpath, lstat, readFile, readlink } from 'node:fs/promises'
import { basename, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { command, VcsError, type Executables } from './process.ts'
import { gitStatus, hgStatus, lineCounts } from './parsers.ts'
import type { Branch, Change, Commit, Discovery, Mutation, Repository, Snapshot, Vcs, Worktree } from './shared.ts'

const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex')
const fail = (code: string): never => { throw new VcsError(code) }
const label = (value: unknown, max = 240): string => typeof value === 'string' && value.length > 0 && value.length <= max && !/[\x00-\x1f\x7f]/.test(value) ? value : fail('INVALID_INPUT')
const refName = (value: unknown): string => { const text = label(value); if (text.startsWith('-') || !/^[\p{L}\p{N}_][\p{L}\p{N}_./-]*$/u.test(text) || text.includes('..') || text.endsWith('/') || text.endsWith('.lock')) fail('INVALID_BRANCH'); return text }
async function exists(path: string): Promise<boolean> { try { await lstat(path); return true } catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return false; throw e } }
const errorCode = (error: unknown) => error instanceof VcsError ? error.code : 'REPOSITORY_UNAVAILABLE'

/** One queue owns commands and lifecycle. Roots are supplied only by trusted host configuration/registry. */
export class SourceControl {
  private lifetime = new AbortController()
  private queue: Promise<unknown> = Promise.resolve()
  private epoch = 0
  private generation = randomUUID()
  constructor(private roots: () => string[], private executables: Executables = {}) {}
  async close(): Promise<void> { this.lifetime.abort(); await this.queue.catch(() => {}) }
  private serial<T>(work: (signal: AbortSignal) => Promise<T>, request?: AbortSignal): Promise<T> {
    const signal = request ? AbortSignal.any([request, this.lifetime.signal]) : this.lifetime.signal
    const next = this.queue.catch(() => {}).then(() => { signal.throwIfAborted(); return work(signal) })
    this.queue = next; return next
  }
  private run(repo: Repository, args: string[], signal: AbortSignal, accepted?: number[]) { return command(repo.vcs, args, repo.root, signal, this.executables, accepted) }
  private async discover(signal: AbortSignal): Promise<Discovery> {
    const repositories: Repository[] = [], warnings: Discovery['warnings'] = []
    for (const path of [...new Set(this.roots())].slice(0, 64)) {
      try {
        if (!isAbsolute(path)) fail('ABSOLUTE_ROOT_REQUIRED')
        const root = await realpath(path)
        const vcs: Vcs | null = await exists(join(root, '.git')) ? 'git' : await exists(join(root, '.hg')) ? 'hg' : null
        if (!vcs) { warnings.push({ root, error: 'NOT_REPOSITORY' }); continue }
        const repo = { id: hash(root), name: basename(root), root, vcs }
        const actual = (await this.run(repo, vcs === 'git' ? ['rev-parse', '--show-toplevel'] : ['root'], signal)).trim()
        if (await realpath(actual) !== root) fail('ROOT_CHANGED')
        if (!repositories.some(item => item.id === repo.id)) repositories.push(repo)
      } catch (error) { signal.throwIfAborted(); warnings.push({ root: path, error: errorCode(error) }) }
    }
    return { repositories, warnings }
  }
  list(signal?: AbortSignal) { return this.serial(s => this.discover(s), signal) }
  private async repository(id: unknown, signal: AbortSignal): Promise<Repository> {
    const list = await this.discover(signal)
    return list.repositories.find(repo => repo.id === id) ?? fail('REPOSITORY_UNAVAILABLE')
  }
  /** Refuse traversal and symlink parents. Final symlink is a versioned entry, never followed. */
  private async safePath(repo: Repository, path: string): Promise<string> {
    if (!path || path.includes('\0') || (process.platform === 'win32' && (path.includes('\\') || path.includes(':'))) || isAbsolute(path) || path.split('/').some(p => p === '..' || p === '.' || /^\.(git|hg)$/i.test(p))) fail('INVALID_PATH')
    const absolute = resolve(repo.root, path), rel = relative(repo.root, absolute)
    if (!rel || rel.startsWith('..' + sep) || isAbsolute(rel)) fail('INVALID_PATH')
    const parents = path.split('/').slice(0, -1); let current = repo.root
    for (const part of parents) {
      current = join(current, part)
      try { if ((await lstat(current)).isSymbolicLink()) fail('SYMLINK_PARENT') }
      catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') break; throw error }
    }
    return absolute
  }
  private async fingerprint(repo: Repository, changes: Change[], strict = false): Promise<string> {
    const digest = createHash('sha256'); let bytes = 0
    for (const path of [...new Set(changes.flatMap(row => [row.path, ...row.original ? [row.original] : []]))].sort()) {
      digest.update(path)
      try {
        const absolute = await this.safePath(repo, path), info = await lstat(absolute)
        if (info.isSymbolicLink()) digest.update(await readlink(absolute))
        else if (info.isFile()) {
          bytes += info.size; if (bytes > 32 * 1024 * 1024) fail('SNAPSHOT_LIMIT')
          digest.update(String(info.mode)); digest.update(await readFile(absolute))
        } else if (info.isDirectory()) { if (strict) fail('UNSUPPORTED_SUBMODULE'); digest.update('directory:' + String(info.mtimeMs)) }
        else fail('UNSUPPORTED_FILE')
      } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') digest.update('missing'); else throw error }
    }
    return digest.digest('hex')
  }
  private async snapshot(repo: Repository, signal: AbortSignal): Promise<Snapshot> {
    const run = (args: string[], accepted?: number[]) => this.run(repo, args, signal, accepted)
    let changes: Change[], branch: string, head: string, branches: Branch[], remotes: string[], patch: string, staged = '', metadata: string
    if (repo.vcs === 'git') {
      const status = await run(['status', '--porcelain=v1', '-z', '--untracked-files=all'])
      changes = gitStatus(status)
      branch = (await run(['symbolic-ref', '--quiet', '--short', 'HEAD'], [0, 1])).trim()
      head = (await run(['rev-parse', '--verify', '--quiet', 'HEAD'], [0, 1])).trim()
      const refs = await run(['for-each-ref', '--format=%(refname:short)%00%(objectname)', 'refs/heads/'])
      branches = refs.trim().split('\n').filter(Boolean).map(line => { const [name = '', node = ''] = line.split('\0'); return { name, node, current: name === branch } })
      remotes = (await run(['remote'])).trim().split('\n').filter(Boolean)
      patch = await run(['diff', '--no-ext-diff', '--no-textconv', '--no-renames', '--no-color', '--unified=3'])
      staged = await run(['diff', '--cached', '--no-ext-diff', '--no-textconv', '--no-renames', '--no-color', '--unified=3'])
      metadata = await run(['ls-files', '--stage', '-z'])
      // Capture remote targets and configuration without exposing URLs/credentials to the client.
      metadata += await run(['config', '--null', '--list'])
    } else {
      changes = hgStatus(await run(['status', '-0']))
      branch = (await run(['branch'])).trim()
      head = (await run(['log', '-r', '.', '-T', '{node}'])).trim()
      const rows = JSON.parse(await run(['branches', '-T', 'json'])) as { branch: string; node: string }[]
      branches = rows.map(row => ({ name: row.branch, node: row.node, current: row.branch === branch }))
      const paths = JSON.parse(await run(['paths', '-T', 'json'])) as { name: string; url: string }[]
      remotes = paths.map(row => row.name); metadata = JSON.stringify(paths)
      patch = await run(['diff', '--git', '--nodates'])
      metadata += '\n' + await run(['resolve', '--list'])
    }
    const counts = lineCounts(patch), stagedCounts = lineCounts(staged)
    const content = await this.fingerprint(repo, changes)
    const revision = hash(JSON.stringify([repo, head, branch, branches, changes, patch, staged, metadata, content, this.generation, this.epoch]))
    const conflict = repo.vcs === 'git' ? changes.some(row => ['DD', 'AU', 'UD', 'UA', 'DU', 'AA', 'UU'].includes(row.index + row.worktree)) : /^U /m.test(metadata)
    return { ...repo, head, branch, branches, remotes, changes, revision, ...counts, stagedAdded: stagedCounts.added, stagedRemoved: stagedCounts.removed, conflict }
  }
  status(id: unknown, signal?: AbortSignal) { return this.serial(async s => this.snapshot(await this.repository(id, s), s), signal) }
  diff(id: unknown, path: unknown, staged: boolean, signal?: AbortSignal): Promise<string> {
    return this.serial(async s => {
      const repo = await this.repository(id, s), snap = await this.snapshot(repo, s)
      if (typeof path !== 'string' || !snap.changes.some(row => row.path === path)) fail('INVALID_PATH')
      const absolute = await this.safePath(repo, path as string), row = snap.changes.find(row => row.path === path)!
      if (row.index === '?' || row.worktree === '?') {
        const info = await lstat(absolute)
        if (!info.isFile() || info.size > 256 * 1024) fail('PREVIEW_UNAVAILABLE')
        const text = await readFile(absolute, 'utf8'); if (text.includes('\0')) fail('PREVIEW_UNAVAILABLE')
        return text
      }
      return this.run(repo, repo.vcs === 'git' ? ['diff', ...staged ? ['--cached'] : [], '--no-ext-diff', '--no-textconv', '--no-color', '--', path as string] : ['diff', '--git', '--', 'path:' + path], s)
    }, signal)
  }
  history(id: unknown, signal?: AbortSignal): Promise<Commit[]> {
    return this.serial(async s => {
      const repo = await this.repository(id, s)
      if (repo.vcs === 'hg') {
        const rows = JSON.parse(await this.run(repo, ['log', '-l', '40', '-T', 'json'], s)) as { node: string; parents: string[]; desc: string; user: string; date: number[] }[]
        return rows.map(r => ({ node: r.node, parents: r.parents, subject: r.desc.split('\n')[0]!, author: r.user, date: new Date(r.date[0]! * 1000).toISOString() }))
      }
      const snap = await this.snapshot(repo, s); if (!snap.head) return []
      return (await this.run(repo, ['log', '--topo-order', '-40', '--format=%H%x00%P%x00%s%x00%an%x00%aI%x00'], s)).split('\0\n').filter(Boolean).map(row => {
        const [node = '', parents = '', subject = '', author = '', date = ''] = row.split('\0')
        return { node, parents: parents.split(' ').filter(Boolean), subject, author, date }
      })
    }, signal)
  }
  worktrees(id: unknown, signal?: AbortSignal): Promise<Worktree[]> {
    return this.serial(async s => {
      const repo = await this.repository(id, s); if (repo.vcs !== 'git') return []
      return (await this.run(repo, ['worktree', 'list', '--porcelain', '-z'], s)).split('\0\0').filter(Boolean).map(block => {
        const fields = block.split('\0'); return { path: fields.find(x => x.startsWith('worktree '))?.slice(9) ?? '', head: fields.find(x => x.startsWith('HEAD '))?.slice(5) ?? '', branch: fields.find(x => x.startsWith('branch '))?.slice(7).replace(/^refs\/heads\//, '') ?? '' }
      })
    }, signal)
  }
  mutate(input: Mutation, signal?: AbortSignal): Promise<Snapshot> {
    signal?.throwIfAborted()
    return this.serial(async s => {
      const repo = await this.repository(input.id, s), snap = await this.snapshot(repo, s)
      if (input.revision !== snap.revision) fail('REVISION_CONFLICT')
      await this.fingerprint(repo, snap.changes, true)
      const run = (args: string[], accepted?: number[]) => this.run(repo, args, s, accepted)
      let args: string[], accepted = [0]
      switch (input.action) {
        case 'stage': case 'unstage': case 'add': case 'forget': {
          if (!Array.isArray(input.paths) || !input.paths.length || input.paths.length > 200) fail('INVALID_PATH')
          const paths: string[] = []
          for (const path of input.paths!) {
            if (typeof path !== 'string') fail('INVALID_PATH')
            const row = snap.changes.find(row => row.path === path); if (!row) fail('INVALID_PATH')
            await this.safePath(repo, path); paths.push(path)
            if (row!.original) { await this.safePath(repo, row!.original); paths.push(row!.original) }
          }
          if (repo.vcs === 'git' && input.action === 'stage') args = ['add', '--', ...paths]
          else if (repo.vcs === 'git' && input.action === 'unstage') args = snap.head ? ['restore', '--staged', '--', ...paths] : ['rm', '--cached', '--', ...paths]
          else if (repo.vcs === 'hg' && ['add', 'forget'].includes(input.action)) args = [input.action, '--', ...paths.map(path => 'path:' + path)]
          else return fail('UNSUPPORTED_ACTION')
          break
        }
        case 'commit': {
          if (snap.conflict) fail('UNRESOLVED_CONFLICT')
          const message = typeof input.message === 'string' && input.message.trim().length > 0 && input.message.length <= 8000 && !input.message.includes('\0') ? input.message : fail('INVALID_MESSAGE')
          if (repo.vcs === 'git') {
            if (!snap.changes.some(row => ![' ', '?', '!'].includes(row.index))) fail('NOTHING_STAGED')
            args = ['-c', 'core.editor=true', 'commit', '-m', message]
          } else {
            if (!Array.isArray(input.paths) || !input.paths.length || input.paths.length > 200) fail('SELECT_FILES')
            for (const path of input.paths!) { if (!snap.changes.some(row => row.path === path && ['M', 'A', 'R'].includes(row.worktree))) fail('INVALID_PATH'); await this.safePath(repo, path) }
            args = ['commit', '-m', message, '--', ...input.paths!.map(path => 'path:' + path)]
          }
          break
        }
        case 'create': case 'switch': {
          if (snap.changes.length || snap.conflict) fail('CLEAN_WORKTREE_REQUIRED')
          const branch = input.action === 'create' ? refName(input.branch) : label(input.branch)
          if (input.action === 'switch' && !snap.branches.some(row => row.name === branch)) fail('INVALID_BRANCH')
          if (input.action === 'create' && snap.branches.some(row => row.name === branch)) fail('BRANCH_EXISTS')
          if (repo.vcs === 'git') args = input.action === 'create' ? ['switch', '--no-overwrite-ignore', '-c', branch] : ['switch', '--no-overwrite-ignore', '--', branch]
          else args = input.action === 'create' ? ['branch', '--', branch] : ['update', '--check', '--rev', snap.branches.find(row => row.name === branch)!.node]
          break
        }
        case 'fetch': case 'push': {
          const remote = label(input.remote)
          if (remote.startsWith('-') || !snap.remotes.includes(remote)) fail('INVALID_REMOTE')
          if (repo.vcs === 'git') {
            if (input.action === 'push' && (!snap.head || !snap.branch)) fail('BRANCH_REQUIRED')
            args = input.action === 'fetch' ? ['fetch', '--', remote] : ['push', '--', remote, `${snap.head}:refs/heads/${snap.branch}`]
          } else { args = input.action === 'fetch' ? ['pull', '--', remote] : ['push', '--rev', snap.head, '--', remote]; accepted = [0, 1] }
          break
        }
        default: return fail('UNSUPPORTED_ACTION')
      }
      // Consume the preview even on failure: never automatically replay a potentially completed write.
      this.epoch++
      await run(args, accepted)
      // Updating to the existing parent preserves an uncommitted Hg branch name.
      // Reset only that name after a successful checked update, never file content.
      if (repo.vcs === 'hg' && input.action === 'switch') await run(['branch', '--clean'])
      return this.snapshot(repo, s)
    }, undefined)
  }
}
