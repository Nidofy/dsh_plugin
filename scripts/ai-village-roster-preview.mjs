import sharp from 'sharp'
import { readFile, mkdir } from 'node:fs/promises'
import { resolve, join } from 'node:path'
const pkg = resolve(import.meta.dirname, '../packages/ai-village')
const output = join(pkg, 'art/QA/roster')
await mkdir(output, { recursive: true })
const tiles = []
for (const [index, id] of ['claude', 'gemini', 'gpt', 'grok', 'kimi', 'qwen'].entries()) {
  const dir = join(pkg, 'assets/characters', id), character = JSON.parse(await readFile(join(dir, 'character.json'), 'utf8'))
  const parts = character.parts, ordered = []
  function traverse(parent) {
    for (const p of parts.filter(p => p.parent === parent).sort((a, b) => a.z - b.z)) { ordered.push(p); traverse(p.id) }
  }
  traverse(null)
  const layers = []
  for (const p of ordered) {
    const file = p.file ?? p.expressions?.neutral
    if (file) layers.push({ input: await sharp(join(dir, file)).resize(p.size[0], p.size[1], { fit: 'fill' }).toBuffer(), left: p.offset[0], top: p.offset[1] })
  }
  const buffer = await sharp({ create: { width: 1024, height: 1024, channels: 4, background: '#f5eee2' } }).composite(layers).png().toBuffer()
  await sharp(buffer).toFile(join(output, `${id}-assembled.png`))
  tiles.push({ input: await sharp(buffer).resize(256, 256).toBuffer(), left: index % 3 * 256, top: Math.floor(index / 3) * 256 })
}
await sharp({ create: { width: 768, height: 512, channels: 4, background: '#f5eee2' } }).composite(tiles).png().toFile(join(output, 'assembled-contact.png'))
