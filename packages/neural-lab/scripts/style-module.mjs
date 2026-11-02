import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

/** One readable CSS source, deterministically embedded in the host module factory. */
export async function generateStyleModule(base) {
  const css = await readFile(join(base, 'src/style.css'), 'utf8')
  const literal = css.replaceAll('\\', '\\\\').replaceAll('`', '\\`').replaceAll('${', '\\${')
  await writeFile(
    join(base, 'src/client-style.ts'),
    '// GENERATED from style.css; do not edit.\nexport const css = `' + literal + '`\n',
  )
}
