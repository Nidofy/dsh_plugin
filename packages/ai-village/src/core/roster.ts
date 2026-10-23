/** Stable allowlist used by storage validation; no asset paths or user-provided identifiers. */
export const characterIds = ['bluewhale', 'claude', 'gemini', 'gpt', 'grok', 'kimi', 'qwen', 'seedance', 'glm', 'minimax', 'llama', 'mistral'] as const
/** Approved entrance composition stays independent of the selectable resident catalog. */
export const approvedEntranceCharacterIds = ['bluewhale', 'claude', 'gemini', 'gpt', 'grok', 'kimi', 'qwen'] as const
export type CharacterId = typeof characterIds[number]
export function isCharacterId(value: unknown): value is CharacterId {
  return typeof value === 'string' && characterIds.includes(value as CharacterId)
}
export const characterNames: Record<CharacterId, string> = {
  bluewhale: 'DeepSeek', claude: 'Claude', gemini: 'Gemini', gpt: 'GPT', grok: 'Grok', kimi: 'Kimi', qwen: 'Qwen',
  seedance: 'Seedance', glm: 'GLM', minimax: 'MiniMax', llama: 'Llama', mistral: 'Mistral',
}
