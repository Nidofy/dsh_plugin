import { Context } from '@deepseek-ai/cordis'
import { SandboxProvider } from '@deepseek-ai/dsh-sandbox'
import { SubprocessRuntime } from '@deepseek-ai/dsh-subprocess'
import { FileSystem } from '@deepseek-ai/dsh-fs'
import { HarnessError } from '@deepseek-ai/dsh-llm'

function denied(): never {
  throw new HarnessError('Windows Sandbox Enhanced has no qualified isolated execution backend. Refusing this operation; no full-access fallback is available.', 'SANDBOX_UNAVAILABLE')
}
export class GuardSandbox extends SandboxProvider {
  override async confine(): Promise<never> { return denied() }
}
export class GuardSubprocess extends SubprocessRuntime {
  override async resolveExecutable(): Promise<never> { return denied() }
  override async terminalEnvironment(): Promise<never> { return denied() }
  override spawn(): never { return denied() }
  override async spawnTerminal(): Promise<never> { return denied() }
}
export class GuardFiles extends FileSystem {
  override async resolve(): Promise<never> { return denied() }
  override processPath(): never { return denied() }
  override fileUrl(): never { return denied() }
  override contains(): never { return denied() }
  override async stat(): Promise<never> { return denied() }
  override async lstat(): Promise<never> { return denied() }
  override async readText(): Promise<never> { return denied() }
  override async streamText(): Promise<never> { return denied() }
  override async readBytes(): Promise<never> { return denied() }
  override async readByteRange(): Promise<never> { return denied() }
  override async listDir(): Promise<never> { return denied() }
  override async writeText(): Promise<never> { return denied() }
  override async editText(): Promise<never> { return denied() }
}
export const name = 'windows-sandbox-guard'
export function apply(ctx: Context): void {
  if (process.platform !== 'win32') { ctx.provide('windowsSandboxGuardReady', true); return }
  // Register in the top-level fiber. A conflict must fail the owning plugin
  // and be rejected by the official loader startup audit, not only a child fiber.
  new GuardSandbox(ctx)
  new GuardSubprocess(ctx)
  new GuardFiles(ctx)
  // Consumers cannot activate until the complete provider set belongs to us.
  ctx.provide('windowsSandboxGuardReady', true)
}
