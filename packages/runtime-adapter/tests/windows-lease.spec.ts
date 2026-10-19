import {it,expect,onTestFinished} from 'vitest'
import {mkdtemp,mkdir,symlink,rm} from 'node:fs/promises'
import {join,resolve} from 'node:path'
import {tmpdir} from 'node:os'
import {spawn} from 'node:child_process'
import {pathToFileURL} from 'node:url'
import {once} from 'node:events'
import {acquireLockHandleWin32,releaseLockHandleWin32} from '../src/jsonl/win32.ts'
it.skipIf(process.platform!=='win32')('excludes an alias in another process and releases ownership after holder death',async()=>{
 const base=await mkdtemp(join(tmpdir(),'dsh-lease-regression-')),real=join(base,'real'),alias=join(base,'alias')
 await mkdir(real);await symlink(real,alias,'junction')
 const module=pathToFileURL(resolve('packages/runtime-adapter/src/jsonl/win32.ts')).href
 const child=spawn(process.execPath,['--input-type=module','-e',`import {acquireLockHandleWin32} from ${JSON.stringify(module)}; await acquireLockHandleWin32(${JSON.stringify(join(real,'session.lock'))}); process.stdout.write('ready');setInterval(()=>{},1000)`],{windowsHide:true,stdio:['ignore','pipe','pipe']})
 onTestFinished(async()=>{if(child.exitCode===null && child.signalCode===null){child.kill();await once(child,'exit')}await rm(base,{recursive:true,force:true})})
 await Promise.race([once(child.stdout,'data'),once(child,'exit').then(()=>{throw Error('Holder failed to start')})])
 await expect(acquireLockHandleWin32(join(alias,'session.lock'))).rejects.toMatchObject({code:'EBUSY'})
 await expect(rm(join(real,'session.lock'))).rejects.toBeDefined()
 child.kill();await once(child,'exit')
 const next=await acquireLockHandleWin32(join(alias,'session.lock'));await releaseLockHandleWin32(next)
})
