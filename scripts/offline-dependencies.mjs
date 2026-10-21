/** Materialize runtime dependencies, preserving licenses, for Windows x64 offline tarballs. */
import { readFile, writeFile, mkdir, cp, realpath } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, basename } from 'node:path'

export async function bundleRuntimeDependencies(root, directory, copyLocal) {
  if (process.platform !== 'win32' || process.arch !== 'x64') throw Error('This release lane targets Windows x64')
  const manifest = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'))
  const copied = new Map(), records = []
  const locate = async (name, owner) => {
    const require = createRequire(join(owner, 'package.json'))
    for (const base of require.resolve.paths(name) ?? []) {
      const path = join(base, name)
      if (existsSync(join(path, 'package.json'))) return realpath(path)
    }
    return null
  }
  const copy = async (name, owner, optional = false) => {
    const source = name === '@nidofy/dsh-plugin-shared' ? join(root, 'packages/plugin-shared') : await locate(name, owner)
    if (!source) { if (optional) return; throw Error('Missing runtime dependency: ' + name) }
    const pkg = JSON.parse(await readFile(join(source, 'package.json'), 'utf8'))
    if (pkg.os && !pkg.os.includes('win32') || pkg.cpu && !pkg.cpu.includes('x64')) {
      if (optional) return
      throw Error('Wrong native runtime: ' + name)
    }
    if (copied.has(name)) {
      if (copied.get(name) !== pkg.version) throw Error('Conflicting offline dependency versions: ' + name)
      return
    }
    copied.set(name, pkg.version)
    const dest = join(directory, 'node_modules', name)
    await mkdir(dest, { recursive: true })
    if (name === '@nidofy/dsh-plugin-shared') await copyLocal('plugin-shared', dest)
    else await cp(source, dest, { recursive: true, dereference: true,
      filter: path => !['node_modules', '.git'].includes(basename(path)) && !/\.(?:log|tsbuildinfo)$/.test(path) })
    const dependencies = { ...pkg.dependencies }, optionalDependencies = {}
    for (const dep of Object.keys(pkg.dependencies ?? {})) await copy(dep, source)
    for (const dep of Object.keys(pkg.optionalDependencies ?? {})) {
      await copy(dep, source, true)
      if (copied.has(dep)) optionalDependencies[dep] = copied.get(dep)
    }
    for (const dep of Object.keys(dependencies)) dependencies[dep] = copied.get(dep)
    // Drop build-only manifests, uninstalled foreign-platform optional packages and lifecycle scripts.
    // Prebuilt native binaries are tested from the installed tarball; no compiler/download is needed.
    delete pkg.devDependencies; delete pkg.scripts
    pkg.dependencies = dependencies; pkg.optionalDependencies = optionalDependencies
    pkg.bundledDependencies = [...Object.keys(dependencies), ...Object.keys(optionalDependencies)]
    await writeFile(join(dest, 'package.json'), JSON.stringify(pkg, null, 2) + '\n')
    records.push({ name, version: pkg.version, license: pkg.license ?? 'SEE LICENSE IN PACKAGE' })
  }
  for (const name of Object.keys(manifest.dependencies ?? {})) await copy(name, root)
  manifest.bundledDependencies = [...copied.keys()]
  // Declare the complete flattened closure so npm and pnpm retain every embedded native package.
  manifest.dependencies = Object.fromEntries(copied)
  manifest.os = ['win32']; manifest.cpu = ['x64']
  delete manifest.devDependencies
  await writeFile(join(directory, 'package.json'), JSON.stringify(manifest, null, 2) + '\n')
  await writeFile(join(directory, 'OFFLINE-DEPENDENCIES.json'), JSON.stringify({ platform: 'win32-x64', host: 'DSH 0.2.1-rc.2', packages: records.sort((a,b) => a.name.localeCompare(b.name)) }, null, 2) + '\n')
  return manifest
}
