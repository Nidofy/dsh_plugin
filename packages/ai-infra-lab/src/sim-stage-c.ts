export interface TrainingConfig {
  parameters: number // Zero derives P from the decoder geometry.
  layers: number
  hidden: number
  sequence: number
  batch: number
  vocabulary: number
  precision: 'fp32' | 'mixed-bf16-fp32-master'
  optimizer: 'SGD' | 'AdamW'
  fp32Gradients: boolean
  checkpoint: boolean
}

export const trainingExample: TrainingConfig = {
  parameters: 0, layers: 12, hidden: 768, sequence: 512, batch: 2, vocabulary: 32000,
  precision: 'mixed-bf16-fp32-master', optimizer: 'AdamW', fp32Gradients: false, checkpoint: false,
}

function valid(v: unknown): v is TrainingConfig {
  if (!v || typeof v !== 'object') return false
  const c = v as TrainingConfig
  const between = (n: number, lo: number, hi: number) => Number.isSafeInteger(n) && n >= lo && n <= hi
  return between(c.parameters, 0, 100e9) && between(c.layers, 1, 128) && between(c.hidden, 1, 16384) &&
    between(c.sequence, 1, 32768) && between(c.batch, 1, 64) && between(c.vocabulary, 1, 262144) &&
    ['fp32','mixed-bf16-fp32-master'].includes(c.precision) && ['SGD','AdamW'].includes(c.optimizer) &&
    typeof c.fp32Gradients === 'boolean' && typeof c.checkpoint === 'boolean'
}

export function trainingLedger(c: TrainingConfig) {
  if (!valid(c)) throw RangeError('训练配置超出范围 / Training configuration outside model limits')
  const p = c.parameters || 12 * c.layers * c.hidden ** 2 + c.vocabulary * c.hidden
  const width = c.precision === 'fp32' ? 4 : 2
  const parameters = p * width
  const gradients = p * (c.fp32Gradients ? 4 : width)
  const master = width === 2 ? 4 * p : 0
  const moments = c.optimizer === 'AdamW' ? 8 * p : 0
  const staticBytes = parameters + gradients + master + moments
  // Four hidden-width tensors per block, or just the block input on checkpointing.
  const activations = c.layers * c.batch * c.sequence * c.hidden * width * (c.checkpoint ? 1 : 4)
  const forwardFlops = 2 * p * c.batch * c.sequence
  return { p, parameters, gradients, master, moments, staticBytes, activations,
    totalBytes: staticBytes + activations, forwardFlops, stepFlops: forwardFlops * (c.checkpoint ? 4 : 3) }
}

export function completedMemoryLedger(observations: unknown): boolean {
  if (!Array.isArray(observations) || observations.length > 32 || !observations.every(valid)) return false
  const configs: TrainingConfig[] = observations
  const pair = (field: 'checkpoint' | 'optimizer') => configs.some(a => configs.some(b =>
    a[field] !== b[field] && (Object.keys(trainingExample) as (keyof TrainingConfig)[]).every(k => k === field || a[k] === b[k]) &&
    (field === 'checkpoint' ? trainingLedger(a).activations !== trainingLedger(b).activations : trainingLedger(a).moments !== trainingLedger(b).moments)))
  return pair('checkpoint') && pair('optimizer')
}
