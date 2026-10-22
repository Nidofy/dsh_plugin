/** DSH 0.2.1 shared rail protocol: Git grows with content; companions use the remaining space. */
export interface FloatingGeometry { left: number; top: number; height: number; width?: number; stacked?: boolean }
export function attachFloatingLayout(anchor: HTMLElement, publish: (geometry: FloatingGeometry | null) => void, expanded = false): () => void {
  const layer = anchor.closest<HTMLElement>('[data-shell-overlay]'), frame = layer?.parentElement
  if (!layer || !frame) { publish(null); return () => {} }
  let marked: HTMLElement | null = null, previous = ''
  const observed = new Set<Element>()
  const release = () => { marked?.removeAttribute('data-nidofy-ai-village-space'); marked = null }
  const resize = new ResizeObserver(() => update())
  const update = () => {
    const right = frame.querySelector<HTMLElement>(':scope > [data-rightbar-col]')
    const center = right?.previousElementSibling as HTMLElement | null
    const content = center?.querySelector<HTMLElement>('[data-conversation-content]') ?? null
    const git = frame.querySelector<HTMLElement>('[data-nidofy-vcs-overlay]')
    const body = git?.querySelector<HTMLElement>('.dsh-vcs') ?? null
    const composer = center?.querySelector<HTMLElement>('[data-composer-card]') ?? null
    const targets = new Set<Element>([frame, ...[center, content, body, composer].filter((e): e is HTMLElement => !!e)])
    for (const element of observed) if (!targets.has(element)) { resize.unobserve(element); observed.delete(element) }
    for (const element of targets) if (!observed.has(element)) { resize.observe(element); observed.add(element) }
    const bounds = center?.getBoundingClientRect(), box = content?.getBoundingClientRect()
    const visible = frame.hasAttribute('data-rightbar-collapsed') && !frame.hasAttribute('data-rightbar-fullscreen')
      && bounds && box && (expanded ? innerWidth >= 400 && innerHeight >= 300 : bounds.width >= 764) && box.height > 0
    if (marked !== content || !visible) release()
    let geometry: FloatingGeometry | null = null
    if (visible && content) {
      marked = content
      if (expanded) content.removeAttribute('data-nidofy-ai-village-space')
      else if (!content.hasAttribute('data-nidofy-ai-village-space')) content.setAttribute('data-nidofy-ai-village-space', '')
      const origin = layer.getBoundingClientRect(), height = Math.max(0, box.height - 24), top = box.top - origin.top + 12
      const stacked = !!git && !!frame.querySelector('[data-nidofy-village-open],[data-nidofy-live2d-open]')
      const reserve = Math.min(600, height * .48), limit = Math.max(0, height - reserve - 12)
      const natural = body?.getBoundingClientRect().height ?? 0
      const upper = Math.min(limit, natural || limit)
      geometry = { left: bounds.right - origin.left - 352, top: top + (true && stacked ? upper + 12 : 0),
        height: stacked ? (true ? Math.max(0, height - upper - 12) : upper) : height, ...(stacked ? {stacked:true} : {}) }
      if (expanded) {
        // Stay inside the conversation column and outside the entire composer
        // card (attachments, input and controls), using its public DOM marker.
        const left = bounds.right - bounds.width + 12, right = bounds.right - (git ? 364 : 12)
        const width = Math.max(0, Math.min(1080, right - left))
        let start = box.top + 12, end = Math.min(innerHeight - 12, box.top + box.height - 12)
        const input = composer?.getBoundingClientRect()
        if (input && input.height > 0 && input.left < right && input.right > left && input.bottom > start && input.top < end) {
          const above = Math.max(0, input.top - 12 - start), below = Math.max(0, end - input.bottom - 12)
          if (above >= below) end = start + above
          else start = end - below
        }
        geometry = { left: left - origin.left, top: start - origin.top, width, height: Math.max(0, Math.min(760, end - start)) }
      }
    }
    const next = JSON.stringify(geometry)
    if (next !== previous) { previous = next; publish(geometry) }
  }
  const mutations = new MutationObserver(update)
  mutations.observe(frame, { childList: true, subtree: true, attributes: true,
    attributeFilter: ['data-rightbar-collapsed', 'data-rightbar-fullscreen', 'data-nidofy-village-open', 'data-nidofy-live2d-open'] })
  update()
  return () => { resize.disconnect(); mutations.disconnect(); release() }
}
