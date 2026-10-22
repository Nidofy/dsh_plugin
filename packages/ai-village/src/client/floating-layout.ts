/** DSH 0.2.1 shared rail protocol: Git grows with content; companions use the remaining space. */
export interface FloatingGeometry { left: number; top: number; height: number; stacked?: boolean }
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
    const targets = new Set<Element>([frame, ...[center, content, body].filter((e): e is HTMLElement => !!e)])
    for (const element of observed) if (!targets.has(element)) { resize.unobserve(element); observed.delete(element) }
    for (const element of targets) if (!observed.has(element)) { resize.observe(element); observed.add(element) }
    const bounds = center?.getBoundingClientRect(), box = content?.getBoundingClientRect()
    const visible = frame.hasAttribute('data-rightbar-collapsed') && !frame.hasAttribute('data-rightbar-fullscreen')
      && bounds && box && (expanded ? innerWidth >= 640 && innerHeight >= 440 : bounds.width >= 764) && box.height > 0
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
