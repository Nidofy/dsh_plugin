export type Vcs = 'git' | 'hg'
export interface Change { path: string; original?: string; index: string; worktree: string }
export interface Branch { name: string; node: string; current: boolean }
export interface Snapshot {
  id: string; name: string; root: string; vcs: Vcs; revision: string; branch: string; head: string
  changes: Change[]; branches: Branch[]; remotes: string[]; added: number; removed: number
  stagedAdded: number; stagedRemoved: number; conflict: boolean
}
export interface Repository { id: string; name: string; root: string; vcs: Vcs }
export interface Discovery { repositories: Repository[]; warnings: { root: string; error: string }[] }
export interface Commit { node: string; parents: string[]; subject: string; author: string; date: string }
export interface Worktree { path: string; branch: string; head: string }
export type Action = 'stage' | 'unstage' | 'add' | 'forget' | 'commit' | 'create' | 'switch' | 'fetch' | 'push'
export interface Operation { action: Action; paths?: string[]; message?: string; branch?: string; remote?: string }
export interface Mutation extends Operation { id: string; revision: string }
