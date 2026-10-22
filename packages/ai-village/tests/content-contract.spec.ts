import { it, expect } from 'vitest'
import { contractLimits } from '../experiments/content-ui/contracts.ts'
import { previewWorld } from '../experiments/content-ui/scene.ts'
import { blankHome } from '../src/core/home-state.ts'

it('fits bounded schema-4 structural capacity in world, save, snapshot and state UTF-8 budgets', () => {
  // Structural maximum with 64-byte future catalog IDs; not a current catalog-valid save.
  const id = 'x'.repeat(contractLimits.identifierBytes), uuid = 'f'.repeat(36)
  const world = { ...previewWorld(), schemaVersion: 4, sceneVersion: 2, simulationRulesVersion: 1, contentRevision: 1,
    activeEvent: { id: uuid, definitionId: id, definitionVersion: 1, participants: ['bluewhale', 'claude'], food: 'tea',
      seats: ['eat/left', 'eat/right'], phase: 'talking', remainingTicks: 900, approachRemainingTicks: 1800, retryCount: 2, branch: 'familiar' },
    progress: { completedWishes: [id], discovered: Array(64).fill(id), unlocked: Array(64).fill(id), lastCompletedEventId: uuid },
    journal: Array.from({ length: 32 }, () => ({ id: uuid, templateId: id, eventId: uuid, participants: ['bluewhale', 'claude'], food: 'rice', completedTick: Number.MAX_SAFE_INTEGER, count: Number.MAX_SAFE_INTEGER })),
    decorations: { layoutRevision: Number.MAX_SAFE_INTEGER, windChime: { id, slot: 'window' } },
  }
  for (const actor of [world.actor, ...world.companions]) {
    actor.intent = { furnitureId: id, seat: id, activity: 'eat', stage: 'approach', expires: Number.MAX_SAFE_INTEGER,
      route: Array.from({ length: 9 }, () => ({ x: 123.12345678901234, y: 321.12345678901234 })) }
  }
  const bytes = (value: unknown) => Buffer.byteLength(JSON.stringify(value), 'utf8')
  const saved = { revision: Number.MAX_SAFE_INTEGER, operationId: uuid, world }
  expect(bytes(world)).toBeLessThanOrEqual(contractLimits.worldBytes)
  for (const envelope of [saved, { lease: uuid, epoch: uuid, operationId: uuid, expectedRevision: Number.MAX_SAFE_INTEGER, world },
    { profileId: id, epoch: uuid, saved, retention: { limit: 32, removed: 32, diagnostic: 'SAVE_RETENTION_SCAN_LIMIT' } }]) {
    expect(bytes(envelope)).toBeLessThanOrEqual(contractLimits.envelopeBytes)
  }
  expect(bytes({ text: '小院' })).toBeGreaterThan(JSON.stringify({ text: '小院' }).length)
  // Upper structural bounds include the schema-6 additions; the deliberately
  // oversized future IDs above are not claimed to be catalog-valid game data.
  const homeWorld = { ...world, schemaVersion: 6, sceneVersion: 3, simulationRulesVersion: 3, contentRevision: 3,
    home: { ...blankHome(), revision: Number.MAX_SAFE_INTEGER },
    neighborhood: { layout: 'reading', layoutRevision: Number.MAX_SAFE_INTEGER, nextInteractionTick: Number.MAX_SAFE_INTEGER,
      event: null, lastEventId: uuid, decorations: { lantern: 'window', planter: 'door' },
      memories: Array.from({ length: 12 }, () => ({ id, eventId: uuid, participants: ['bluewhale', 'claude'], completedTick: Number.MAX_SAFE_INTEGER, count: Number.MAX_SAFE_INTEGER })),
      bonds: Array.from({ length: 21 }, () => ({ pair: ['bluewhale', 'claude'], count: Number.MAX_SAFE_INTEGER, lastTick: Number.MAX_SAFE_INTEGER })) } }
  expect(bytes(homeWorld)).toBeLessThanOrEqual(contractLimits.worldBytes)
  for (const envelope of [{ ...saved, world: homeWorld }, { lease: uuid, epoch: uuid, operationId: uuid, expectedRevision: Number.MAX_SAFE_INTEGER, world: homeWorld },
    { profileId: id, epoch: uuid, saved: { ...saved, world: homeWorld }, retention: { diagnostic: 'SAVE_RETENTION_SCAN_LIMIT' } }]) {
    expect(bytes(envelope)).toBeLessThanOrEqual(contractLimits.envelopeBytes)
  }
})
