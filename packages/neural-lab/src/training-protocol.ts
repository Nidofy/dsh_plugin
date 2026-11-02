export function trainingDataset(key?: string): string | undefined {
  if (key === 'project-char-v1' || key === 'project-char-wide-v1') return 'tiny-char-v1'
  if (key === 'project-signal-v1') return 'damped-signal-v1'
  if (key === 'train-mlp-v1') return 'quadratic-2d-v1'
  if (key === 'train-char-v1') return 'tiny-char-v1'
}
