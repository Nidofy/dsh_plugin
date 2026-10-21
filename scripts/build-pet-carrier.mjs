/** Narrow native-window integration for the verified official Windows carrier, never an installed app. */
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import { Readable } from 'node:stream'
import { readFile, writeFile, mkdir, readdir, stat, copyFile } from 'node:fs/promises'
import { resolve, join, normalize } from 'node:path'
const root = resolve(import.meta.dirname, '..')
const baseline = resolve(process.argv[2] ?? join(root, '.build/ai-village-phase5/carrier'))
const original = join(baseline, 'resources/app.asar')
const expected = '47874618bf5b3011fcaac10cd4c85f69da333e70d4f99b921207c78d0999512a'
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
if (sha(await readFile(original)) !== expected) throw Error('UNVERIFIED_CARRIER: requires the pinned official Windows 0.2.1-rc.2 archive')
const { source } = JSON.parse(await readFile(join(root, '.local/environment.json'), 'utf8'))
const dependencies = join(source, 'node_modules/.pnpm')
const tool = (await readdir(dependencies)).find(name => name === '@electron+asar@3.4.1')
if (!tool) throw Error('ASAR_3_4_1_REQUIRED')
const asar = createRequire(join(dependencies, tool, 'node_modules/@electron/asar/package.json'))('@electron/asar')
const out = join(root, 'dist/desktop-pets-carrier-0.2.1-rc.2')
await mkdir(out, { recursive: true })
const overrides = new Map()
const patchOnce = (source, anchor, replacement) => {
  if (source.split(anchor).length !== 2) throw Error('CARRIER_ANCHOR_MISMATCH: ' + anchor)
  return source.replace(anchor, replacement)
}
let main = asar.extractFile(original, 'lib/main.js').toString()
main = 'import { installPetDesktop as installNidofyPets } from "./nidofy-pets.js";\n' + main
main = patchOnce(main, '\tprotocol.handle(SCHEME, (request) => {', `
  const nidofyPets = installNidofyPets(fileURLToPath(new URL('./preload-pets.cjs', import.meta.url)), () => {
    if (backend.host === void 0 || hostUrl === void 0 || hostCookie === void 0) throw Error('PET_HOST_NOT_READY');
    return { url: hostUrl, cookie: hostCookie };
  }, sessionId => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show(); mainWindow.focus();
    mainWindow.webContents.send('nidofy:pet-navigate', sessionId);
  });
  protocol.handle(SCHEME, (request) => {`)
main = patchOnce(main, 'return forwardWebRequest(request, hostUrl, hostCookie);', `return forwardWebRequest(request, hostUrl, hostCookie).then(response => {
        if (response.ok && request.method === 'POST' && ['/api/nidofy-pets/preferences', '/api/nidofy-pets/pet/update'].includes(url.pathname)) nidofyPets.refresh();
        return response;
      });`)
overrides.set('lib/main.js', Buffer.from(main))
overrides.set('lib/preload-app.cjs', Buffer.concat([
  asar.extractFile(original, 'lib/preload-app.cjs'), Buffer.from('\n;(() => {\n'),
  await readFile(join(root, 'packages/desktop-pets/lib/carrier-preload.cjs')), Buffer.from('\n})();\n'),
]))
overrides.set('lib/nidofy-pets.js', await readFile(join(root, 'packages/desktop-pets/lib/electron.js')))
overrides.set('lib/preload-pets.cjs', await readFile(join(root, 'packages/desktop-pets/lib/preload.cjs')))
const manifest = JSON.parse(asar.extractFile(original, 'package.json'))
if (manifest.version !== '0.2.1-rc.2' || manifest.dshBuildCommit !== '332895e0f7c9d4dbfb29729f5eb367fa263ff986') throw Error('CARRIER_VERSION_MISMATCH')
manifest.dshBuildDirty = true
manifest.nidofyPetCarrier = { version: 1, plugin: '0.2.1', originalAsarSha256: expected }
overrides.set('package.json', Buffer.from(JSON.stringify(manifest, null, 2) + '\n'))
const fileNames = asar.listPackage(original).map(name => name.slice(1).replaceAll('\\', '/'))
const streams = []
for (const name of [...fileNames, ...[...overrides.keys()].filter(name => !fileNames.includes(name))]) {
  const entry = fileNames.includes(name) ? asar.statFile(original, normalize(name), true) : { size: overrides.get(name).length }
  if (entry.files) { streams.push({ path: name, type: 'directory', unpacked: !!entry.unpacked }); continue }
  const bytes = () => overrides.get(name) ?? asar.extractFile(original, normalize(name), true)
  streams.push({ path: name, type: 'file', unpacked: !!entry.unpacked,
    stat: { size: overrides.get(name)?.length ?? entry.size, mode: entry.executable ? 0o100755 : 0o100644 },
    streamGenerator: () => Readable.from([bytes()]) })
}
const output = join(out, 'app.asar')
await asar.createPackageFromStreams(output, streams)
for (const [name, bytes] of overrides) if (!asar.extractFile(output, name).equals(bytes)) throw Error('CARRIER_OUTPUT_MISMATCH: ' + name)
await copyFile(join(root, 'scripts/install-pet-carrier.ps1'), join(out, 'Install-PetCarrier.ps1'))
await writeFile(join(out, 'manifest.json'), JSON.stringify({ version: manifest.version, plugin: '0.2.1', originalAsarSha256: expected,
  asarSha256: sha(await readFile(output)), bytes: (await stat(output)).size, adapted: true, officialSignedRelease: false }, null, 2) + '\n')
console.log('Native pet carrier patch built: ' + out)
