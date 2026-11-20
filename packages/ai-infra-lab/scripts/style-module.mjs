import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

/** Deterministically embed readable CSS source into the browser bundle module. */
export async function generateStyleModule(base) {
  const css = await readFile(join(base, 'src/style.css'), 'utf8')
  const literal = css.replaceAll('\\', '\\\\').replaceAll('`', '\\`').replaceAll('${', '\\${')
  await writeFile(
    join(base, 'src/client-style.ts'),
    '// GENERATED from style.css; do not edit.\nexport const css = `' + literal + '`\n',
  )
}
