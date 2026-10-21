import official from './ai-village-official.vitest.mjs'
export default { ...official, test: { ...official.test, include: ['packages/source-control/tests/**/*.spec.{ts,tsx}', 'packages/live2d/tests/**/*.spec.{ts,tsx}'] } }
