export function trainingDataset(key?: string): string | undefined {
  if (key === 'train-mlp-multi-v1') return 'quadratic-2d-multi-v1'
  if (['project-char-flex-v1', 'project-char-two-v1', 'project-char-observe-v1'].includes(key ?? '')) return 'tiny-char-v2'
  if (key === 'project-char-v1' || key === 'project-char-wide-v1') return 'tiny-char-v1'
  if (key === 'project-signal-v1') return 'damped-signal-v1'
  if (key === 'train-mlp-v1') return 'quadratic-2d-v1'
  if (key === 'train-char-v1') return 'tiny-char-v1'
}

export function validateTrainingConfig(key: string | undefined, config: Record<string, number>): void {
  const advanced = ['project-char-flex-v1', 'project-char-two-v1', 'project-char-observe-v1'].includes(key ?? '')
  for (const [name, value] of Object.entries(config)) {
    if (!Number.isFinite(value)) throw Error('Nonfinite configuration')
    if (name === 'seed' && Number.isInteger(value) && value >= 0 && value <= 10000) continue
    if (name === 'learningRate' && trainingDataset(key) && value >= .001 && value <= .3) continue
    if (advanced && Number.isInteger(value)) {
      if (name === 'batchSize' && value >= 1 && value <= 4) continue
      if (name === 'context' && value >= 2 && value <= 8) continue
      if (name === 'heads' && [1,2,3,6].includes(value)) continue
      if (name === 'steps' && key === 'project-char-observe-v1' && value >= 8 && value <= 24) continue
    }
    throw Error('Invalid experiment configuration: ' + name)
  }
}
