export function trainingDataset(key?: string): string | undefined {
  if (key === 'train-mlp-v1') return 'quadratic-2d-v1'
  if (key === 'train-char-v1') return 'tiny-char-v1'
}
