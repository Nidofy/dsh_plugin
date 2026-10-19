/** DSH 0.2.0-rc.2 geometry adapter. No private service or hashed CSS class access.
 * The public overlay seat has no width-reservation API. Mark only the main chat
 * identified inside the column preceding data-rightbar-col; never embedded chats.
 */
export interface FloatingGeometry { left: number; top: number; height: number }
export function attachFloatingLayout(anchor: HTMLElement, publish: (geometry: FloatingGeometry | null) => void): () => void {
  const layer = anchor.closest<HTMLElement>('[data-shell-overlay]')
  const frame = layer?.parentElement
  if (!layer || !frame) { publish(null); return () => {} }
  let marked: HTMLElement | null = null
  let observed: HTMLElement | null = null
  let previous = ''
  const release = () => { marked?.removeAttribute('data-nidofy-vcs-space'); marked = null }
  const update = () => {
    const right = frame.querySelector<HTMLElement>(':scope > [data-rightbar-col]')
    const center = right?.previousElementSibling as HTMLElement | null
    if (observed !== center) {
      if (observed) resize.unobserve(observed)
      observed = center
      if (observed) resize.observe(observed)
    }
    const content = center?.querySelector<HTMLElement>('[data-conversation-content]') ?? null
    const bounds = center?.getBoundingClientRect()
    const contentBounds = content?.getBoundingClientRect()
    const visible = frame.hasAttribute('data-rightbar-collapsed') && !frame.hasAttribute('data-rightbar-fullscreen')
      && bounds && contentBounds && bounds.width >= 764 && contentBounds.height > 0
    if (marked !== content || !visible) release()
    let geometry: FloatingGeometry | null = null
    if (visible && content) {
      marked = content
      if (!content.hasAttribute('data-nidofy-vcs-space')) content.setAttribute('data-nidofy-vcs-space', '')
      const origin = layer.getBoundingClientRect()
      geometry = { left: bounds.right - origin.left - 352, top: contentBounds.top - origin.top + 12, height: Math.max(0, contentBounds.height - 24) }
    }
    const next = JSON.stringify(geometry)
    if (next !== previous) { previous = next; publish(geometry) }
  }
  const resize = new ResizeObserver(update)
  const mutations = new MutationObserver(update)
  resize.observe(frame)
  // Child replacement covers navigation/HMR. Attributes only cover frame presentation,
  // avoiding observing our own reservation marker and streaming text mutations.
  mutations.observe(frame, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-rightbar-collapsed', 'data-rightbar-fullscreen'] })
  update()
  return () => { resize.disconnect(); mutations.disconnect(); release() }
}
