/** Browser preview uses only authenticated Host routes; native capabilities remain with Electron. */
export function installBrowserBridge() {
  if (window.nidofyPet) return () => {}
  const listeners = new Map(), lifetime = new AbortController()
  const id = new URLSearchParams(location.search).get('id') || '1'
  let pending = false
  const rpc = async (method, input = {}) => {
    const response = await fetch('/api/nidofy-pets/' + method, { method: 'POST',
      headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...input, id }), signal: lifetime.signal })
    const value = await response.json()
    if (!response.ok) throw Error(value.error || 'PET_PLUGIN_UNAVAILABLE')
    return value
  }
  const emit = (name, payload) => { for (const callback of listeners.get(name) ?? []) callback({ payload }) }
  const bridge = {
    listen: async (name, callback) => {
      if (!listeners.has(name)) listeners.set(name, new Set())
      const rows = listeners.get(name); rows.add(callback)
      return () => rows.delete(callback)
    },
    invoke: async (method, input = {}) => {
      if (method === 'pet_ready') return
      if (method === 'pet_snapshot') return rpc('pet/snapshot')
      if (method === 'pet_resource') return rpc('pet/resource')
      if (method !== 'pet_action') throw Error('PET_ACTION_REFUSED')
      if (['hit-test', 'bubble-size', 'drag', 'drag-move', 'drag-end'].includes(input.action)) return
      if (input.action === 'menu') { emit('pet-layout', { open: input.target?.open === true, side: 'right', width: 430 }); return }
      if (!['pin', 'unpin', 'hide', 'interact'].includes(input.action)) throw Error('PET_DESKTOP_REQUIRED')
      await rpc('pet/update', input)
      return rpc('pet/snapshot')
    },
  }
  window.nidofyPet = bridge
  const timer = setInterval(async () => {
    if (pending || lifetime.signal.aborted || document.hidden) return
    pending = true
    try {
      const snapshot = await rpc('pet/snapshot')
      if (!lifetime.signal.aborted) { emit('pet-settings', snapshot.settings); emit('pet-state', snapshot.state) }
    } catch { if (!lifetime.signal.aborted) emit('pet-state', { disconnected: true, items: [] }) }
    finally { pending = false }
  }, 1500)
  const dispose = () => { lifetime.abort(); clearInterval(timer); listeners.clear();
    if (window.nidofyPet === bridge) delete window.nidofyPet
    window.removeEventListener('pagehide', dispose)
  }
  window.addEventListener('pagehide', dispose, { once: true })
  return dispose
}
