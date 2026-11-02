import { useRef, useState } from 'react'
import type { LabApi, Overview } from '../types.ts'

type Profile = Record<string, string>
type Draft = { base: Profile; local: Profile; revision: number; inflight?: Profile }
const fields = [
  ['background', '已有基础 Background'],
  ['goal', '学习目标 Goal'],
  ['difficulties', '常见卡点 Difficulties'],
  ['explanations', '有效讲法 Preferred explanation'],
] as const
const equal = (a: Profile, b: Profile) => fields.every(([key]) => (a[key] ?? '') === (b[key] ?? ''))

export function ProfileTab({ initial, api }: { initial: Overview; api: LabApi }) {
  const key = 'neural-lab-profile/' + initial.profileId
  const [draft, setDraft] = useState<Draft>(() => {
    try {
      const stored = JSON.parse(sessionStorage.getItem(key) ?? 'null')
      if (
        stored?.local &&
        stored.base &&
        Number.isSafeInteger(stored.revision) &&
        (stored.inflight ||
          !equal(stored.base, stored.local) ||
          stored.revision > initial.profileRevision)
      )
        return stored
    } catch {}
    return { local: initial.profile, base: initial.profile, revision: initial.profileRevision }
  })
  const latest = useRef(draft)
  const [remote, setRemote] = useState<Overview>()
  const [status, setStatus] = useState('')
  const [saving, setSaving] = useState(false)
  const lock = useRef(false)
  function update(value: Draft) {
    latest.current = value
    setDraft(value)
    try {
      sessionStorage.setItem(key, JSON.stringify(value))
    } catch {
      setStatus('本地恢复副本不可用 / Local recovery cache unavailable')
    }
  }
  async function save() {
    if (lock.current) return
    lock.current = true
    setSaving(true)
    try {
      while (latest.current.inflight || !equal(latest.current.base, latest.current.local)) {
        const submitted = latest.current
        if (!submitted.inflight) {
          update({ ...submitted, inflight: submitted.local })
          try {
            const revision = await api.saveProfile(submitted.local, submitted.revision)
            update({ local: latest.current.local, base: submitted.local, revision })
            continue
          } catch {
            // The write may have committed before its acknowledgement was lost.
          }
        }
        const current = await api.overview()
        const sent = submitted.inflight ?? submitted.local
        if (current.profileRevision !== submitted.revision + 1 || !equal(current.profile, sent)) {
          setRemote(current)
          throw Error('请核对档案并合并 / Verify the remote profile before retrying')
        }
        update({ local: latest.current.local, base: sent, revision: current.profileRevision })
      }
      setStatus('档案已保存 / Profile saved')
    } catch (error) {
      setStatus(String(error))
    } finally {
      lock.current = false
      setSaving(false)
    }
  }
  function merge() {
    if (!remote) return
    const local = { ...remote.profile }
    for (const [field] of fields)
      if ((draft.local[field] ?? '') !== (draft.base[field] ?? ''))
        local[field] = draft.local[field] ?? ''
    update({ local, base: remote.profile, revision: remote.profileRevision })
    setRemote(undefined)
    setStatus('请核对合并内容并保存 / Review merged fields and save')
  }
  return (
    <section className="nl-profile">
      <p>档案属于学习者，贯穿整条课程路线。/ Your profile applies across all lessons.</p>
      {fields.map(([field, title]) => (
        <label key={field}>
          {title}
          <textarea
            value={draft.local[field] ?? ''}
            maxLength={3000}
            onChange={(event) => {
              setStatus('未保存 / Unsaved')
              update({
                ...latest.current,
                local: { ...latest.current.local, [field]: event.target.value },
              })
            }}
          />
        </label>
      ))}
      {remote && (
        <section className="nl-error" role="alert">
          <p>档案版本冲突 / Profile revision conflict</p>
          <pre>{JSON.stringify(remote.profile, null, 2)}</pre>
          <a
            download="neural-lab-profile-draft.json"
            href={
              'data:application/json;charset=utf-8,' +
              encodeURIComponent(JSON.stringify(draft.local))
            }
          >
            下载本地副本 / Download local copy
          </a>
          <button onClick={merge}>合并本地修改 / Merge local changes</button>
        </section>
      )}
      <button className="nl-primary" disabled={saving || !!remote} onClick={() => void save()}>
        保存档案 Save profile
      </button>
      <p role="status">{status}</p>
    </section>
  )
}
