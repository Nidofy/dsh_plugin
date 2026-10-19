import { expect, it } from 'vitest'
import { repositoriesForProject } from '../src/client/project.ts'
import type { Repository } from '../src/shared.ts'
const repo = (root: string): Repository => ({ root, name: root, id: root, vcs: 'git' })
it('matches Windows roots and selects the nearest containing repository, never a sibling', () => {
  const parent = repo('D:/projects/dsh'), child = repo('D:/projects/dsh/electron'), sibling = repo('D:/projects/dsh_plugin')
  expect(repositoriesForProject([parent, child, sibling], 'd:\\PROJECTS\\dsh\\electron\\src\\')).toEqual([child])
  expect(repositoriesForProject([parent, child, sibling], 'D:/projects/dsh')).toEqual([parent])
  expect(repositoriesForProject([parent], 'D:/projects/dsh_plugin')).toEqual([])
  expect(repositoriesForProject([parent], null)).toEqual([])
})
it('keeps POSIX case sensitivity and supports UNC project paths', () => {
  expect(repositoriesForProject([repo('/work/Foo')], '/work/foo')).toEqual([])
  const unc = repo('\\\\server\\share\\project')
  expect(repositoriesForProject([unc], '//SERVER/SHARE/project/sub')).toEqual([unc])
})
