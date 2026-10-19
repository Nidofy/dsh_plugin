import { it, expect } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { SandboxProvider } from '@deepseek-ai/dsh-sandbox'
import { SubprocessRuntime } from '@deepseek-ai/dsh-subprocess'
import { FileSystem } from '@deepseek-ai/dsh-fs'
import { GuardFiles, GuardSandbox, GuardSubprocess, apply } from '../src/index.ts'

it('is built against the pinned official baseline rather than desktop code', async () => {
  const { readFile } = await import('node:fs/promises')
  const { join } = await import('node:path')
  const pkg = JSON.parse(await readFile(join(process.env.DSH_SANDBOX_OFFICIAL!, 'package.json'), 'utf8'))
  expect(pkg.version).toBe('0.2.1-rc.2')
})
it('registers genuine official services and disposes them with their parent', async () => {
  const ctx = new Context(), fiber = ctx.plugin({ name: 'qualification', apply })
  try {
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(ctx.sandbox).toBeInstanceOf(SandboxProvider)
    expect(ctx.subprocess).toBeInstanceOf(SubprocessRuntime)
    expect(ctx.fs).toBeInstanceOf(FileSystem)
    expect(ctx.sandbox).toBeInstanceOf(GuardSandbox)
    await expect(ctx.sandbox.confine(['cmd.exe', '/c', 'echo unsafe'], { mode: 'workspace-write', workspaceRoot: 'C:\\project' })).rejects.toMatchObject({ code: 'SANDBOX_UNAVAILABLE' })
  } finally { await fiber.dispose() }
  expect(ctx.get('sandbox')).toBeUndefined(); expect(ctx.get('subprocess')).toBeUndefined(); expect(ctx.get('fs')).toBeUndefined()
})
it('blocks subprocess bypass, Terminal and file writes independently of confine', async () => {
  const ctx = new Context(), process = new GuardSubprocess(ctx), files = new GuardFiles(ctx)
  expect(() => process.spawn()).toThrow('no qualified isolated execution backend')
  await expect(process.spawnTerminal()).rejects.toMatchObject({ code: 'SANDBOX_UNAVAILABLE' })
  await expect(files.writeText()).rejects.toMatchObject({ code: 'SANDBOX_UNAVAILABLE' })
  await expect(files.editText()).rejects.toMatchObject({ code: 'SANDBOX_UNAVAILABLE' })
  await expect(files.readBytes()).rejects.toMatchObject({ code: 'SANDBOX_UNAVAILABLE' })
})

it('fails official boot when a conflicting file provider prevents guard readiness', async () => {
  const { boot } = await import('@deepseek-ai/dsh-app-boot')
  const { mkdtemp,writeFile,rm }=await import('node:fs/promises'),{tmpdir}=await import('node:os'),{join}=await import('node:path')
  const dir=await mkdtemp(join(tmpdir(),'dsh-guard-boot-'));let started=false
  class ExistingFiles extends FileSystem { override async readText():Promise<string>{return 'not guarded'} }
  try {
    const path=join(dir,'cordis.yml')
    await writeFile(path, JSON.stringify([{id:'filesystem',name:'cordis:existing-files'},
      {id:'windows-sandbox-guard',name:'cordis:qualification'},
      {id:'agent-loop',name:'cordis:guard-consumer',inject:['windowsSandboxGuardReady'] }]))
    await expect(boot('guard-test',path,undefined,ctx=>{
      Object.assign(ctx.loader.builtins,{'existing-files':ExistingFiles,qualification:{apply},
        'guard-consumer':{apply(){started=true}}})
    })).rejects.toThrow(/agent-loop|windowsSandboxGuardReady/)
    expect(started).toBe(false)
  }finally{await rm(dir,{recursive:true,force:true})}
})
