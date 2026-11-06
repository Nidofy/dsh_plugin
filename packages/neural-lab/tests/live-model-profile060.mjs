/** Test-only minimal account borrowing. Call before starting the isolated official Web server.
 * Caller owns the fresh home/profile and its cleanup; never call logout on the borrowed account.
 * Usage: await prepareLiveModelProfile({ home: absoluteIsolatedHome, profile: 'qualification' }).
 * No provider call is made here and returned readiness is configuration readiness only.
 */
import { chmod, lstat, open, readFile, realpath, writeFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'
import { parseDocument, isSeq, isMap } from 'yaml'

const exec = promisify(execFile)
const sourceHome = 'C:/Users/enxi1/.dsh'
const recordKeys = ['deepseek-account-platform/default', 'deepseek-account-platform/device']
const expectedSelection = { provider: 'deepseek-account', model: 'deepseek-flash', reasoningEffort: 'high' }
const same = (a, b) => process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b
const within = (parent, child) => {
  const tail = relative(parent, child)
  return tail === '' || (!isAbsolute(tail) && tail !== '..' && !tail.startsWith('..' + sep))
}
function requireValue(condition) { if (!condition) throw Error('validation') }
function parse(text) {
  // Parser diagnostics can contain source lines, so never propagate their text or warnings.
  const doc = parseDocument(text, { logLevel: 'silent' })
  requireValue(doc.errors.length === 0)
  return doc
}
async function noLink(path, optional = false) {
  try { requireValue(!(await lstat(path)).isSymbolicLink()) }
  catch (error) { if (!optional || error?.code !== 'ENOENT') throw error }
}
async function restrictFile(path) {
  if (process.platform !== 'win32') { await chmod(path, 0o600); return 'posix-0600' }
  // Use an environment argument, never interpolate a path or credential into executable text.
  // Apply a fresh protected DACL before writing any secret bytes. No inherited broad grants.
  const script = `
    $ErrorActionPreference = 'Stop'
    $credentialTarget = $env:NEURAL_TUTOR060_CREDENTIAL_PATH
    $currentSid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
    $systemSid = [System.Security.Principal.SecurityIdentifier]::new('S-1-5-18')
    $acl = [System.Security.AccessControl.FileSecurity]::new()
    $acl.SetOwner($currentSid)
    $acl.SetAccessRuleProtection($true, $false)
    foreach ($sid in @($currentSid, $systemSid)) {
      $rule = [System.Security.AccessControl.FileSystemAccessRule]::new($sid, 'FullControl', 'Allow')
      $acl.AddAccessRule($rule)
    }
    Set-Acl -LiteralPath $credentialTarget -AclObject $acl
    $check = Get-Acl -LiteralPath $credentialTarget
    if (-not $check.AreAccessRulesProtected) { throw 'ACL is not protected' }
    $rules = $check.GetAccessRules($true, $true, [System.Security.Principal.SecurityIdentifier])
    foreach ($rule in $rules) {
      if ($rule.IsInherited -or $rule.AccessControlType -ne 'Allow' -or
          ($rule.IdentityReference.Value -ne $currentSid.Value -and $rule.IdentityReference.Value -ne $systemSid.Value)) {
        throw 'Unexpected credential access rule'
      }
    }
  `
  await exec('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
    windowsHide: true, timeout: 30000, env: { ...process.env,
      // Windows PowerShell 5 must not autoload the parent PowerShell 7 modules.
      PSModulePath: join(process.env.SystemRoot ?? 'C:/Windows', 'System32/WindowsPowerShell/v1.0/Modules'),
      NEURAL_TUTOR060_CREDENTIAL_PATH: path },
  })
  return 'windows-protected-current-user-and-system'
}

export async function prepareLiveModelProfile({ home, profile }) {
  let stage = 'isolated-target-validation'
  try {
    requireValue(typeof home === 'string' && isAbsolute(home))
    requireValue(typeof profile === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(profile))
    const targetHome = await realpath(home), originalHome = await realpath(sourceHome)
    requireValue(same(targetHome, resolve(home))) // refuse junction/symlink redirection
    requireValue(!within(originalHome, targetHome) && !within(targetHome, originalHome))
    const targetProfile = join(targetHome, 'profiles', profile)
    requireValue(same(await realpath(targetProfile), targetProfile))
    requireValue((await lstat(targetProfile)).isDirectory())
    const destination = join(targetHome, '.credentials.yaml')
    const homePatch = join(targetHome, 'cordis.patch.yml')
    await noLink(homePatch, true)
    await noLink(destination, true)
    // Confirm an initialized official base-backed profile, not an arbitrary output directory.
    const profilePackage = JSON.parse(await readFile(join(targetProfile, 'package.json'), 'utf8'))
    const bundles = profilePackage.dsh?.profile?.bundles
    requireValue(Array.isArray(bundles) && bundles.includes('@deepseek-ai/dsh-base') && bundles.includes('@deepseek-ai/dsh-web-app'))

    stage = 'read-minimal-source-configuration'
    const credentialDoc = parse(await readFile(join(sourceHome, '.credentials.yaml'), 'utf8')).toJS({ maxAliasCount: 0 })
    requireValue(credentialDoc?.version === 1)
    const grant = credentialDoc.records?.[recordKeys[0]], device = credentialDoc.records?.[recordKeys[1]]
    requireValue(grant?.kind === 'grant' && grant.payload?.version === 1 &&
      typeof grant.payload.token === 'string' && grant.payload.token.length > 0 &&
      typeof grant.payload.issuer === 'string' && new URL(grant.payload.issuer).protocol === 'https:')
    requireValue(device?.kind === 'grant' && typeof device.payload?.id === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(device.payload.id))
    const sourcePatch = parse(await readFile(join(sourceHome, 'profiles', 'desktop', 'cordis.patch.yml'), 'utf8')).toJS({ maxAliasCount: 0 })
    requireValue(Array.isArray(sourcePatch))
    const selection = sourcePatch.filter(row => row?.id === 'agent-default-model').at(-1)?.config
    requireValue(selection && Object.entries(expectedSelection).every(([key, value]) => selection[key] === value))
    // Project only the two supported payloads: never copy refs, browser sessions or other records.
    const credentials = { version: 1, records: {
      [recordKeys[0]]: { kind: 'grant', payload: { version: 1, token: grant.payload.token, issuer: grant.payload.issuer } },
      [recordKeys[1]]: { kind: 'grant', payload: { id: device.payload.id } },
    } }

    stage = 'prepare-isolated-home-patch'
    const prior = await readFile(homePatch, 'utf8').catch(error => {
      if (error.code === 'ENOENT') return '[]\n'
      throw error
    })
    const patch = parse(prior)
    requireValue(isSeq(patch.contents))
    // rc.5 profile-boot applies home AFTER profile. Put the selection in that winning layer.
    // Base already registers account + account LLM; explicit enable avoids a stale disable.
    const rows = [
      { id: 'agent-default-model', config: { ...expectedSelection } },
      { id: 'credentials', disabled: false, config: { path: destination } },
      { id: 'deepseek-account', disabled: false, config: { desktopPlatform: null } },
      { id: 'llm-deepseek-account', disabled: false },
    ]
    const ids = new Set(rows.map(row => row.id))
    patch.contents.items = patch.contents.items.filter(row => !(isMap(row) && ids.has(row.get('id'))))
    for (const row of rows) patch.contents.add(patch.createNode(row))

    stage = 'restrict-new-credential-file'
    // Refuse existing credentials, even inside the isolated home. Call before browser auth starts.
    const file = await open(destination, 'wx', 0o600)
    let access
    try {
      access = await restrictFile(destination)
      stage = 'write-minimal-credentials'
      await file.writeFile(JSON.stringify(credentials, null, 2) + '\n', 'utf8') // JSON is YAML 1.2
      await file.sync()
    } finally { await file.close() }
    stage = 'apply-home-patch'
    await writeFile(homePatch, patch.toString(), { encoding: 'utf8', mode: 0o600 })
    return { configurationReady: true, modelCallVerified: false, isolated: true,
      profile, selection: { ...expectedSelection }, credentialRecordCount: 2,
      credentialRecordKeys: [...recordKeys], access, patchLayer: 'home-after-profile',
      sourceModified: false }
  } catch {
    // Never surface YAML fragments, provider payloads or child-process errors to logs.
    throw Error(`Live model profile preparation failed at ${stage}; no retry or escalation performed. The caller must clean its isolated home.`)
  }
}
