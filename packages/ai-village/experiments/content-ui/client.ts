import { animations, character, resources, roster } from '../../src/definitions.ts'
import { attachFrame, type FrameRuntime } from '../../src/client/frame-bridge.ts'
import { actors } from '../../src/core/world.ts'
import { characterIds, type CharacterId } from '../../src/core/roster.ts'
import { sceneViewport } from '../../src/frame/viewport.ts'
import { ContentPreview, type Food } from './model.ts'
import { bellSlots, candidateScene, type BellSlot } from './scene.ts'

const $ = <T extends HTMLElement = HTMLElement>(selector: string) => document.querySelector<T>(selector)!
const t = (zh: string, en: string) => lang === 'zh' ? zh : en
let lang: 'zh' | 'en' = 'zh', page = 'residents', expanded = true, ready = false, raf = 0, last = 0
let model = new ContentPreview(), signature = '', food: Food = 'tea'
let pair: [CharacterId, CharacterId] = ['bluewhale', 'claude']
const names: Record<CharacterId, string> = { bluewhale: 'DeepSeek', claude: 'Claude', gemini: 'Gemini', gpt: 'GPT', grok: 'Grok', kimi: 'Kimi', qwen: '千问 · Qwen' }
const listeners = new Set<() => void>(), images: Record<string, ArrayBuffer> = {}
const runtime: FrameRuntime = {
  view: () => { const c = model.controller; return { world: c.world, position: c.drag?.active ? c.drag.position : c.world.actor.position,
    dragging: !!c.drag?.active, dragTime: c.world.ticks / 30, paused: !!c.pauseReasons.size, debug: false } },
  bundle: () => ({ character, animations, roster, scene: candidateScene, images: Object.fromEntries(Object.entries(images).map(([key, bytes]) => [key, bytes.slice(0)])) }),
  subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener) } },
  setFrameReady: value => { ready = value; $('#loading').style.display = value ? 'none' : 'grid'; schedule() },
  pointer: intent => { if (model.active) return; model.controller.pointer(intent); emit() },
  cancelDrag: () => { model.controller.cancelDrag(); emit() },
}
function emit() { for (const listener of listeners) listener(); render() }
function schedule() {
  cancelAnimationFrame(raf); raf = 0; last = 0
  if (ready && !model.controller.pauseReasons.size) raf = requestAnimationFrame(tick)
  emit()
}
function tick(now: number) {
  raf = 0
  if (!ready || model.controller.pauseReasons.size) return
  if (!last) last = now
  const delta = (now - last) / 1000
  if (delta >= 1 / 30) { model.advance(Math.min(delta, .1)); last = now; emit() }
  raf = requestAnimationFrame(tick)
}
function setPage(next: string) {
  page = next; model.discard(); model.controller.pause('other-panel', next === 'decor'); schedule()
}
function button(text: string, action: string, kind = 'secondary', disabled = false) {
  return `<button class="${kind}" data-action="${action}" ${disabled ? 'disabled' : ''}>${text}</button>`
}
function bellSvg() {
  return '<path d="M45 6v21" stroke="#b29c63" stroke-width="2"/><path d="M24 53c0-34 42-34 42 0z" fill="#a9ba8b" stroke="#657c53" stroke-width="2"/><ellipse cx="45" cy="53" rx="21" ry="5" fill="#6d835e"/><path d="M45 53v24" stroke="#b29c63" stroke-width="2"/><path d="m39 72 17 2-4 27-17-2z" fill="#f5e5b8" stroke="#b29c63"/><path d="m41 80 9 1m-10 5 8 1" stroke="#a19771"/>'
}
function stageText() {
  return ({ idle: t('两张空椅，等一场相聚。', 'Two seats, waiting for a little gathering.'), approaching: t('伙伴正在前往餐桌…', 'Your companions are walking to the table…'), talking: t('终于坐在了一起。', 'Together at last.'), completed: t('一段小小的回忆，已记在本页手账。', 'A little memory, recorded in this page’s journal.'), cancelled: t('这次相聚暂时中止，可以重新邀请。', 'The gathering stopped. You can invite them again.') })[model.stage]
}
function render() {
  $('#clock').textContent = model.controller.pauseReasons.size ? t('已暂停', 'Paused') : t('小院时光', 'Village time')
  $('#world-status').textContent = stageText()
  $('#pause').textContent = model.controller.world.userPaused ? '▶' : 'Ⅱ'
  $('#pause').setAttribute('aria-label', model.controller.world.userPaused ? '继续 / Resume' : '暂停 / Pause')
  const bubble = $('#bubble'), stage = $('#stage').getBoundingClientRect(), transform = sceneViewport(stage.width, stage.height).world
  const speaker = actors(model.controller.world).find(a => a.id === model.participants[0])
  const showBubble = model.stage === 'talking' || !!model.placed
  bubble.style.display = showBubble ? 'block' : 'none'
  bubble.textContent = model.stage === 'talking'
    ? (model.food === 'tea' ? t('茶还温着，再坐一会儿吧。', 'The tea is still warm. Stay a little longer.') : t('一起吃饭，连午后都变慢了。', 'Sharing a meal makes the afternoon feel slower.'))
    : t('风经过的时候，小院有了新的声音。', 'The breeze has found a new voice here.')
  if (showBubble) { const p = speaker?.position ?? { x: 175, y: 374 }; bubble.style.left = `${transform.x + p.x * transform.scale}px`; bubble.style.top = `${transform.y + (p.y - 113) * transform.scale}px` }
  const key = JSON.stringify([page, lang, model.stage, model.reason, model.unlocked, model.draft, model.placed, food, pair])
  if (key === signature) return
  signature = key
  for (const element of document.querySelectorAll<HTMLElement>('[data-zh]')) element.textContent = element.dataset[lang]!
  $('#language').textContent = lang === 'zh' ? 'EN' : '中'
  $('#mode').textContent = expanded ? t('收起 ↙', 'Compact ↙') : t('展开 ↗', 'Expand ↗')
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en'
  for (const tab of document.querySelectorAll<HTMLElement>('[data-page]')) tab.setAttribute('aria-selected', String(tab.dataset.page === page))
  let html = ''
  if (page === 'residents') {
    html = `<p class="eyebrow">MEET THE NEIGHBOURS</p><h2>${t('今天，大家都在。', 'Everyone is here.')}</h2><p class="description">${t('七位伙伴，各有自己的步调。选两位，分享一段午后时光。', 'Seven companions, each at their own pace. Invite two to share an afternoon.')}</p>`
    html += characterIds.map(id => { const file = resources.find(r => r.key === (id === 'bluewhale' ? 'parts/face-neutral.png' : `${id}/parts/face-neutral.png`))!.file
      return `<div class="resident"><img src="/assets/${file}" alt=""><span><strong>${names[id]}</strong><small>${t('在小院里', 'In the courtyard')}</small></span><span>${t('在场', 'Here')}</span></div>` }).join('')
    html += button(t('一起喝杯茶 →', 'Share some tea →'), 'wishes', 'primary')
  } else if (page === 'wishes') {
    html = `<p class="eyebrow">A LITTLE WISH · 01</p><h2>${t('把午后分给你。', 'An afternoon to share.')}</h2><p class="description">${t('两个人，一张桌子。聊聊天，留下小院的第一段共同回忆。', 'Two companions, one table. A little conversation becomes your first shared memory.')}</p><div class="status-card"><span class="step">${model.stage.toUpperCase()}</span><strong>${stageText()}</strong>${model.stage === 'cancelled' || model.reason ? `<p>${t('原因：', 'Reason: ')}${({ seat: t('座位被占用或路线不可达。', 'A seat is occupied or unreachable.'), blocked: t('路线被其他伙伴阻挡。', 'Another companion blocked the route.'), timeout: t('等待到位超时。', 'Arrival timed out.'), user: t('已主动取消。', 'Cancelled by you.') } as Record<string, string>)[model.reason] ?? ''}</p>` : ''}</div>`
    if (!model.active && model.stage !== 'completed') {
      html += [0, 1].map(i => `<label class="field">${t(`第 ${i + 1} 位伙伴`, `Companion ${i + 1}`)}<select data-pair="${i}">${characterIds.map(id => `<option value="${id}" ${pair[i] === id ? 'selected' : ''}>${names[id]}</option>`).join('')}</select></label>`).join('')
      html += `<div class="food">${['tea', 'rice'].map(item => `<button class="secondary" data-food="${item}" aria-pressed="${food === item}">${item === 'tea' ? t('茶点', 'Tea') : t('白米饭', 'Rice')}</button>`).join('')}</div>`
      html += button(t('邀请他们同桌', 'Invite to the table'), 'invite', 'primary', pair[0] === pair[1])
    } else if (model.active) html += `<p class="description" style="margin-top:18px">${t('到齐后交流 5 秒；样板活动期间暂不拖动角色。', 'Conversation lasts five seconds after both arrive. Dragging is disabled during this study event.')}</p>${button(t('取消这次相聚', 'Cancel gathering'), 'cancel')}`
    else html += `<p class="description" style="margin-top:20px">${t('获得：首次同桌手账 · 一枚风铃（本页内存）', 'Unlocked: first gathering journal · one wind chime (in memory)')}</p>${button(t('去挂风铃 →', 'Hang the chime →'), 'decor', 'primary')}${button(t('翻开手账', 'Open journal'), 'journal')}`
  } else if (page === 'decor') {
    html = `<p class="eyebrow">MAKE IT YOURS · 01</p><h2>${t('风有了落脚处。', 'A place for the breeze.')}</h2><svg class="bell-art" viewBox="0 0 90 110" aria-hidden="true">${bellSvg()}</svg>`
    if (!model.unlocked) html += `<p class="description">${t('完成第一次同桌心愿，留下一枚风铃。', 'Complete the first gathering to unlock a wind chime.')}</p>${button(t('去看看心愿', 'See the wish'), 'wishes', 'primary')}`
    else html += `<p class="description">${t('选一个挂点看看。确认前只是预览；布置时世界暂停。', 'Try a hanging spot. Nothing changes until you confirm. The world pauses while decorating.')}</p><div class="slots">${bellSlots.map(s => `<button class="secondary" data-slot="${s.id}" aria-pressed="${(model.draft ?? model.placed) === s.id}">${s[lang]}</button>`).join('')}</div>${button(t('确认摆放（仅本页）', 'Confirm (this page only)'), 'confirm', 'primary', !model.draft)}${button(t('撤销预览', 'Discard preview'), 'discard', 'secondary', !model.draft)}<p class="description" style="margin-top:16px">${model.placed ? t('已摆放：', 'Placed: ') + bellSlots.find(s => s.id === model.placed)![lang] : t('尚未摆放', 'Not placed yet')}</p>`
  } else {
    html = `<p class="eyebrow">COURTYARD JOURNAL</p><h2>${t('收好这些小事。', 'Keep the little things.')}</h2>`
    html += model.journal.length ? model.journal.map(entry => `<article class="journal-entry"><small>01 · FIRST GATHERING</small><h3>${t('同桌的午后', 'An afternoon together')}</h3><p>${entry.participants.map(id => names[id]).join(' & ')} · ${entry.food === 'tea' ? t('茶点', 'Tea') : t('白米饭', 'Rice')}</p><p>${t('谁也没有催促谁。杯碗之间，小院多了一段可以回想的日常。', 'Nobody was in a hurry. Between cups and bowls, the courtyard gained a memory to return to.')}</p><p>${t('收藏 · 风铃 × 1', 'Collection · Wind chime × 1')}</p></article>`).join('') : `<p class="description">${t('还没有记录。一起坐一会儿，故事就会开始。', 'No entries yet. Sit together for a while, and a story will begin.')}</p>${button(t('去完成第一个心愿', 'Start the first wish'), 'wishes', 'primary')}`
  }
  // All interpolated values above come from the local typed catalog; no external text is HTML.
  const active = document.activeElement as HTMLElement | null
  const focusAttribute = ['data-slot', 'data-action', 'data-pair', 'data-food'].find(attribute => active?.hasAttribute(attribute))
  const focusValue = focusAttribute ? active!.getAttribute(focusAttribute)! : null
  const scroll = $('#panel').scrollTop
  $('#panel').innerHTML = html
  if (focusAttribute && focusValue !== null) $('#panel').querySelector<HTMLElement>(`[${focusAttribute}="${CSS.escape(focusValue)}"]`)?.focus({ preventScroll: true })
  $('#panel').scrollTop = scroll
  const slot = bellSlots.find(s => s.id === (model.draft ?? model.placed))
  $('#decor').innerHTML = slot ? `<g transform="translate(${slot.x - 14},${slot.y - 34}) scale(.32)" opacity="${model.draft ? '.6' : '1'}">${bellSvg()}</g>` : ''
}
$('#panel').addEventListener('change', event => {
  const target = event.target as HTMLSelectElement
  if (target.matches('[data-pair]') && characterIds.includes(target.value as CharacterId)) { pair[Number(target.dataset.pair) as 0 | 1] = target.value as CharacterId; render() }
})
$('#village').addEventListener('click', event => {
  const target = (event.target as Element).closest<HTMLElement>('button')
  if (!target) return
  if (target.dataset.page) setPage(target.dataset.page)
  else if (target.dataset.food) { food = target.dataset.food as Food; render() }
  else if (target.dataset.slot) { model.preview(target.dataset.slot as BellSlot); render() }
  else if (target.dataset.action) {
    const action = target.dataset.action
    if (['wishes', 'decor', 'journal'].includes(action)) setPage(action)
    else if (action === 'invite') { model.invite(pair, food); emit() }
    else if (action === 'cancel') { model.cancel(); emit() }
    else if (action === 'confirm') { model.confirm(); emit() }
    else if (action === 'discard') { model.discard(); emit() }
  }
})
$('#pause').onclick = () => { model.controller.pause('user', !model.controller.world.userPaused); schedule() }
$('#theme').onclick = () => { const shell = $('#village'); shell.dataset.theme = shell.dataset.theme === 'light' ? 'dark' : 'light' }
$('#language').onclick = () => { lang = lang === 'zh' ? 'en' : 'zh'; signature = ''; render() }
$('#mode').onclick = () => { expanded = !expanded; $('#village').className = expanded ? 'expanded' : 'compact'; signature = ''; render() }
$('#reset').onclick = () => { model.controller.cancelDrag(); model = new ContentPreview(); pair = ['bluewhale', 'claude']; food = 'tea'; page = 'residents'; signature = ''; schedule() }
document.addEventListener('visibilitychange', () => { model.controller.pause('hidden', document.hidden); schedule() })
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape' || event.isComposing || !$('#village').contains(document.activeElement)) return
  if (model.draft) { model.discard(); emit(); event.preventDefault() }
})
// Keep this wall-decoration study at the scene's 3:4 ratio: cover cropping would
// otherwise move the painted window relative to world-space hanging anchors.
new ResizeObserver(() => {
  const height = $('.world').clientHeight - $('.world-footer').clientHeight
  $('#stage').style.width = `${Math.min($('.world').clientWidth, height * .75)}px`
  $('#stage').style.alignSelf = 'center'
  render()
}).observe($('.world'))
// Read-only diagnostics for the automated layout harness; never exposed by the plugin.
Object.assign(window, { __contentStudy: () => ({ ticks: model.controller.world.ticks, stage: model.stage, actors: actors(model.controller.world).length,
  journal: model.journal.length, unlocked: model.unlocked, placed: model.placed, draft: model.draft, paused: [...model.controller.pauseReasons], frameReady: ready }) })
render()
async function start() {
  await Promise.all(resources.map(async resource => {
    const response = await fetch('/assets/' + resource.file)
    if (!response.ok) throw Error('ASSET_LOAD_FAILED')
    const bytes = await response.arrayBuffer(), digest = await crypto.subtle.digest('SHA-256', bytes)
    const hash = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('')
    if (bytes.byteLength !== resource.bytes || hash !== resource.sha256) throw Error('ASSET_HASH_MISMATCH')
    images[resource.key] = bytes
  }))
  const response = await fetch('/frame.js'); if (!response.ok) throw Error('FRAME_LOAD_FAILED')
  const code = await response.text(), nonce = crypto.randomUUID()
  const frame = $<HTMLIFrameElement>('#scene')
  const detach = attachFrame(frame, runtime, () => { $('#loading').style.display = 'grid'; $('#loading').textContent = t('场景加载失败，请刷新重试。', 'Scene failed to load. Refresh to retry.') })
  frame.srcdoc = `<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}' 'unsafe-eval'; style-src 'unsafe-inline'; img-src blob: data:; connect-src 'none'"><style>html,body{margin:0;overflow:hidden;height:100%}canvas{display:block}</style><script nonce="${nonce}">${code.replaceAll('</script', '<\\/script')}</script>`
  window.addEventListener('pagehide', () => { detach(); cancelAnimationFrame(raf) }, { once: true })
}
void start().catch(error => { $('#loading').textContent = t('加载失败：', 'Load failed: ') + String(error); console.error(error) })
