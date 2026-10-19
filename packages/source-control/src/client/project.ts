import type { Repository } from '../shared.ts'

function normalize(path: string): string {
  const value = path.replaceAll('\\', '/').replace(/\/+$/, '')
  return /^[A-Za-z]:\//.test(value) || value.startsWith('//') ? value.toLowerCase() : value
}

/** Select the nearest registered repository containing the current project directory. */
export function repositoriesForProject(repositories: Repository[], projectRoot: string | null): Repository[] {
  if (!projectRoot) return []
  const project = normalize(projectRoot)
  const matches = repositories.filter(repo => {
    const root = normalize(repo.root)
    return root === project || project.startsWith(root + '/')
  }).sort((a, b) => normalize(b.root).length - normalize(a.root).length)
  return matches.slice(0, 1)
}
