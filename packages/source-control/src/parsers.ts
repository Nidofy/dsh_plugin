import type { Change } from './shared.ts'

/** Porcelain -z emits destination then source for renames, without quoted filenames. */
export function gitStatus(text: string): Change[] {
  const fields = text.split('\0'), rows: Change[] = []
  for (let i = 0; i < fields.length; i++) {
    const value = fields[i]; if (!value) continue
    const row: Change = { index: value[0]!, worktree: value[1]!, path: value.slice(3) }
    if (/[RC]/.test(row.index + row.worktree)) row.original = fields[++i]!
    rows.push(row)
  }
  return rows
}
export function hgStatus(text: string): Change[] {
  return text.split('\0').filter(Boolean).map(value => ({ index: ' ', worktree: value[0]!, path: value.slice(2) }))
}
export function lineCounts(patch: string): { added: number; removed: number } {
  let added = 0, removed = 0, hunk = false
  for (const line of patch.split('\n')) {
    if (line.startsWith('diff ')) hunk = false
    else if (line.startsWith('@@')) hunk = true
    else if (hunk && line.startsWith('+')) added++
    else if (hunk && line.startsWith('-')) removed++
  }
  return { added, removed }
}
