// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { collectionFacts } from '../src/core/collection-catalog.ts'
import { CollectionPanel } from '../src/client/CollectionPanel.tsx'
import { createLivingWorld } from '../src/core/living-state.ts'
import { LivingController } from '../src/core/living-controller.ts'
import { scene } from '../src/definitions.ts'
import type { Album } from '../src/core/photo.ts'
import type { VillageRuntime } from '../src/client/runtime.ts'
import { AlbumClient } from '../src/client/album-client.ts'
afterEach(cleanup)
const photo = (title: string) => ({ id: crypto.randomUUID(), title, tick: 30, width: 720, height: 960, bytes: 100, hash: 'a'.repeat(64) })
it('never counts present residents or an unopened album as discovered shared memories or saved photos', () => {
  const controller = new LivingController(createLivingWorld(scene), scene, () => {})
  controller.setCharacterPresent('claude', true); controller.setCharacterPresent('gemini', true)
  const before = controller.snapshot(), facts = collectionFacts(controller.world, null)
  expect(facts.categories.find(c => c.id === 'company')!.items).toEqual([])
  expect(facts.categories.find(c => c.id === 'photos')).toMatchObject({ known: false, items: [] })
  expect(facts.goals.find(g => g.id === 'photo-album')!.count).toBeNull()
  expect(facts.goals.find(g => g.id === 'shared-residents')!.count).toBe(0)
  expect(controller.snapshot()).toEqual(before)
})
it('counts saved types, actual shared participants and distinct bond pairs without adding replay totals', () => {
  const world = createLivingWorld(scene)
  world.neighborhood.memories.push(
    { id: 'lost-rice', eventId: crypto.randomUUID(), participants: ['bluewhale', 'claude'], completedTick: 10, count: 5 },
    { id: 'find-whale', eventId: crypto.randomUUID(), participants: ['gpt'], completedTick: 20, count: 8 },
  )
  world.neighborhood.bonds.push({ pair: ['bluewhale', 'claude'], count: 5, lastTick: 20 })
  world.play.decorations['rice-bowl'] = 'window'
  const before = structuredClone(world), facts = collectionFacts(world, { schemaVersion: 1, photos: [] })
  expect(facts.categories.find(c => c.id === 'story')!.items.map(i => i.id)).toEqual(['lost-rice'])
  expect(facts.categories.find(c => c.id === 'game')!.items.map(i => i.id)).toEqual(['find-whale'])
  expect(facts.categories.find(c => c.id === 'company')!.items.map(i => i.id)).toEqual(['bluewhale', 'claude'])
  expect(facts.goals.find(g => g.id === 'shared-pairs')!.count).toBe(1)
  expect(facts.categories.find(c => c.id === 'keepsakes')!.items.map(i => i.id)).toEqual(['rice-bowl', 'whale-token'])
  expect(facts.categories.find(c => c.id === 'photos')).toMatchObject({ known: true, items: [] })
  expect(facts.goals.find(g => g.id === 'photo-album')!.count).toBe(0)
  expect(world).toEqual(before)
})
it('uses the loaded album only and allows photo deletion to reduce the optional goal', () => {
  const world = createLivingWorld(scene), album: Album = { schemaVersion: 1, photos: [photo('Morning'), photo('Friends'), photo('Evening')] }
  expect(collectionFacts(world, album).goals.find(g => g.id === 'photo-album')!.count).toBe(3)
  album.photos.pop()
  expect(collectionFacts(world, album).goals.find(g => g.id === 'photo-album')!.count).toBe(2)
  const runtime = { controller: { world }, album: { loaded: true, state: { world: album }, pending: { kind: 'add' }, error: 'PHOTO_UNCONFIRMED' } }
  render(<CollectionPanel runtime={runtime as unknown as VillageRuntime} tab="journal" locale="en"/>)
  expect(screen.getByText('Photos · 2')).toBeTruthy()
  expect(screen.getByText('Morning')).toBeTruthy()
  expect(screen.getByText(/Only its last loaded records/)).toBeTruthy()
})
it('distinguishes a successfully read empty album from unread and stale profile data', async () => {
  let identity={profileId:crypto.randomUUID(),epoch:crypto.randomUUID(),lease:crypto.randomUUID()}
  const album=new AlbumClient(async()=>new Response(JSON.stringify({...identity,saved:null}),{headers:{'content-type':'application/json'}}),()=>identity,()=>{})
  const runtime={controller:{world:createLivingWorld(scene)},album} as unknown as VillageRuntime
  const ui=render(<CollectionPanel runtime={runtime} tab="journal" locale="en"/> )
  expect(screen.getByText('Photos · Not loaded')).toBeTruthy();expect(album.loaded).toBe(false)
  await album.refresh();expect(album.loaded).toBe(true);expect(album.state).toBeNull()
  ui.rerender(<CollectionPanel runtime={runtime} tab="journal" locale="en"/> )
  expect(screen.getByText('Photos · 0')).toBeTruthy()
  ui.rerender(<CollectionPanel runtime={runtime} tab="wishes" locale="en"/> )
  expect(screen.getByText('0/3', {selector:'article:last-of-type p'})).toBeTruthy()
  identity={...identity,profileId:crypto.randomUUID()};expect(album.loaded).toBe(false)
  ui.rerender(<CollectionPanel runtime={runtime} tab="journal" locale="en"/> )
  expect(screen.getByText('Photos · Not loaded')).toBeTruthy()
})
it('shows bilingual category and optional-goal sources without inventing an unread album count', () => {
  const runtime = { controller: { world: createLivingWorld(scene) }, album: { state: null, pending: null, error: '' } }
  const ui = render(<CollectionPanel runtime={runtime as unknown as VillageRuntime} tab="wishes" locale="zh"/>)
  expect(screen.getByText('相册尚未读取')).toBeTruthy()
  expect(screen.getByText(/不重复的居民组合/)).toBeTruthy()
  ui.rerender(<CollectionPanel runtime={runtime as unknown as VillageRuntime} tab="journal" locale="en"/>)
  expect(screen.getByText('Photos · Not loaded')).toBeTruthy()
  expect(screen.getByText(/Being present alone does not count/)).toBeTruthy()
  expect(screen.getByRole('heading', { name: 'Collection categories' })).toBeTruthy()
})
