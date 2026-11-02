import type { ComponentContract } from './types.ts'

// A project is still a regular Python submission. Markers define its portable component boundaries.
export function splitProject(code: string, contracts: ComponentContract[]) {
  const chunks = code.split(/^# %% ([a-z_]+)\r?\n/gm)
  if (chunks.length !== contracts.length * 2 + 1) throw Error('Invalid project component markers')
  const preamble = chunks[0]!
  const parts = contracts.map(({ name }, i) => {
    if (chunks[2 * i + 1] !== name) throw Error('Missing or out-of-order component: ' + name)
    return { name, code: chunks[2 * i + 2]! }
  })
  return { preamble, parts }
}
export function assembleProject(preamble: string, parts: { name: string; code: string }[]) {
  return preamble + parts.map((p) => '# %% ' + p.name + '\n' + p.code).join('')
}
