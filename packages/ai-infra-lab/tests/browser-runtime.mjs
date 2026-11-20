import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { readFile, readdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export const pkg = resolve(import.meta.dirname, '..')
const repo = resolve(pkg, '../..')
export const carrier = existsSync(join(repo, '.build/official-runtime-rc5')) ? repo : resolve(repo, '../..')
export const official = createRequire(join(carrier, '.build/official-runtime-rc5/package.json'))

export async function loadPlaywright() {
  const local = createRequire(import.meta.url)
  let entry = process.env.PLAYWRIGHT_MODULE
  if (!entry) {
    try { entry = local.resolve('playwright') }
    catch {
      let source = process.env.DSH_SOURCE
      if (!source) source = JSON.parse(await readFile(join(carrier, '.local/environment.json'), 'utf8')).source
      const modules = join(source, 'node_modules/.pnpm')
      const name = (await readdir(modules)).sort().reverse().find(n => n.startsWith('playwright@'))
      assert.ok(name, 'Set PLAYWRIGHT_MODULE to the local Playwright entry point')
      entry = join(modules, name, 'node_modules/playwright/index.mjs')
    }
  }
  return import(pathToFileURL(resolve(entry)).href)
}

export async function launchBrowser() {
  const { chromium } = await loadPlaywright()
  const executablePath = process.env.CHROMIUM_PATH ?? [
    process.env['ProgramFiles(x86)'] && join(process.env['ProgramFiles(x86)'], 'Microsoft/Edge/Application/msedge.exe'),
    chromium.executablePath(),
  ].find(p => p && existsSync(p))
  assert.ok(executablePath && existsSync(executablePath), 'Set CHROMIUM_PATH to a local Edge or Chromium executable')
  return chromium.launch({executablePath, headless:true, args:['--disable-background-networking','--no-first-run']})
}
