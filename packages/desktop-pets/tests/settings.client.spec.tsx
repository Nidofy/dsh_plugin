// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PetSettingsPage } from '../src/client/Settings.tsx'
import { PetStore } from '../src/client/store.ts'
import { defaults } from '../src/state.ts'
afterEach(()=>{cleanup();vi.unstubAllGlobals()})
it('uses the official switch without embedding a pet in the main window',async()=>{
  let saved=defaults()
  saved.pet.enabled=false
  vi.stubGlobal('fetch',vi.fn(async(url:string,init:RequestInit)=>{
    if(url.endsWith('/preferences')){saved={...JSON.parse(String(init.body)),revision:saved.revision+1};return Response.json(saved)}
    if(url.endsWith('/pet/packages'))return Response.json({items:[{id:'xiaojing',displayName:'小鲸'}]})
    return Response.json({preferences:saved})
  }))
  const store=new PetStore();await store.refresh()
  const page=render(<PetSettingsPage store={store} zh/>)
  expect(page.container.querySelector('iframe')).toBeNull()
  expect(screen.queryByText('管理桌宠')).toBeNull()
  fireEvent.click(screen.getByRole('switch',{name:'显示桌宠'}))
  await waitFor(()=>expect(saved.pets).toBe(true))
  expect(page.container.querySelector('iframe')).toBeNull()
  expect(screen.getByText(/当前客户端尚未接入/)).toBeTruthy()
  expect(saved.pets).toBe(true);expect(saved.pet.enabled).toBe(true);expect(saved.vision).toBe(false)
  fireEvent.click(screen.getByRole('switch',{name:'显示桌宠'}))
  await waitFor(()=>expect(saved.pets).toBe(false))
  store.dispose()
})
it('reads back an uncertain save, reports failure and never replays it',async()=>{
  let saved=defaults(),writes=0
  vi.stubGlobal('fetch',vi.fn(async(url:string,init:RequestInit)=>{
    if(url.endsWith('/preferences')){writes++;saved={...JSON.parse(String(init.body)),revision:1};throw Error('lost response')}
    return Response.json({preferences:saved})
  }))
  const store=new PetStore();await store.refresh();await store.save(p=>{p.pets=true})
  expect(writes).toBe(1);expect(store.snapshot().preferences?.pets).toBe(true);expect(store.snapshot().error).toContain('lost response')
  store.dispose()
})
it('does not publish stale saves after connection reset',async()=>{
  let done:((value:Response)=>void)|undefined
  const fresh=defaults();fresh.revision=3
  vi.stubGlobal('fetch',vi.fn((url:string)=>url.endsWith('/preferences')?new Promise<Response>(resolve=>{done=resolve}):Promise.resolve(Response.json({preferences:fresh}))))
  const store=new PetStore();await store.refresh()
  const save=store.save(p=>{p.pets=true});store.reset()
  await waitFor(()=>expect(store.snapshot().preferences?.revision).toBe(3))
  done!(Response.json({...fresh,revision:2,pets:true}));await save
  expect(store.snapshot().preferences?.pets).toBe(false);expect(store.snapshot().preferences?.revision).toBe(3)
  store.dispose()
})
