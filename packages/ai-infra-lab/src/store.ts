import { randomUUID } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import type { AnswerRecord, Evidence, HelpLevel, RunRecord } from './types.ts'

/** Dedicated SQLite application_id: 0x494C4142 ('ILAB') = 1229734210 */
export const AI_INFRA_LAB_APP_ID = 1229734210

export class Store {
  readonly db: DatabaseSync

  constructor(path: string) {
    this.db = new DatabaseSync(path)
    try {
      this.db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=3000;')
      const app = Number(this.db.prepare('PRAGMA application_id').get()?.application_id)
      if (app !== 0 && app !== AI_INFRA_LAB_APP_ID) {
        throw Error('This database belongs to another application (expected AI Infra Lab)')
      }
      const version = Number(this.db.prepare('PRAGMA user_version').get()?.user_version)
      if (version > 1) {
        throw Error('Unsupported AI Infra Lab schema version')
      }
      if (
        app === 0 &&
        this.db
          .prepare(
            "SELECT count(*) AS n FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
          )
          .get()?.n !== 0
      ) {
        throw Error('Refusing to adopt an unrecognized database')
      }
      if (version === 0) {
        this.db.exec(`BEGIN IMMEDIATE;
        CREATE TABLE kv(key TEXT PRIMARY KEY, value TEXT NOT NULL);
        CREATE TABLE drafts(id TEXT PRIMARY KEY, code TEXT NOT NULL, revision INTEGER NOT NULL);
        CREATE TABLE runs(id TEXT PRIMARY KEY, exercise TEXT NOT NULL, body TEXT NOT NULL);
        CREATE TABLE history(seq INTEGER PRIMARY KEY, exercise TEXT NOT NULL, kind TEXT NOT NULL, body TEXT NOT NULL, at TEXT NOT NULL);
        PRAGMA application_id=${AI_INFRA_LAB_APP_ID};
        PRAGMA user_version=1;
        COMMIT;`)
      }
      this.db.exec(
        'CREATE INDEX IF NOT EXISTS history_activity ON history(exercise, kind); CREATE INDEX IF NOT EXISTS run_activity ON runs(exercise);',
      )
      for (const run of this.runs()) {
        if (run.run_status === 'queued' || run.run_status === 'running') {
          this.putRun({
            ...run,
            run_status: 'interrupted',
            check_status: 'not_run',
            reason: 'Host restarted before container execution was confirmed',
            finishedAt: new Date().toISOString(),
          })
        }
      }
    } catch (error) {
      this.db.close()
      throw error
    }
  }

  transaction<T>(operation: () => T): T {
    this.db.exec('BEGIN IMMEDIATE')
    try {
      const value = operation()
      this.db.exec('COMMIT')
      return value
    } catch (error) {
      this.db.exec('ROLLBACK')
      throw error
    }
  }

  get<T>(key: string, fallback: T): T {
    const row = this.db.prepare('SELECT value FROM kv WHERE key=?').get(key)
    return row ? (JSON.parse(String(row.value)) as T) : fallback
  }

  set(key: string, value: unknown): void {
    this.db
      .prepare('INSERT INTO kv VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
      .run(key, JSON.stringify(value))
  }

  draft(id: string): { code: string; revision: number } | undefined {
    const row = this.db.prepare('SELECT code, revision FROM drafts WHERE id=?').get(id)
    return row ? { code: String(row.code), revision: Number(row.revision) } : undefined
  }

  saveDraft(id: string, code: string, revision: number): number {
    return this.transaction(() => {
      const current = this.draft(id)
      if ((current?.revision ?? 0) !== revision) {
        throw Error('Draft conflict: reload the latest saved revision')
      }
      const next = revision + 1
      this.db
        .prepare(
          'INSERT INTO drafts VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET code=excluded.code, revision=excluded.revision',
        )
        .run(id, code, next)
      return next
    })
  }

  putRun(run: RunRecord): void {
    this.db
      .prepare('INSERT INTO runs VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body')
      .run(run.id, run.exerciseId, JSON.stringify(run))
  }

  runs(exerciseId?: string): RunRecord[] {
    const rows = exerciseId
      ? this.db
          .prepare('SELECT id, body FROM runs WHERE exercise=? ORDER BY rowid DESC')
          .all(exerciseId)
      : this.db.prepare('SELECT id, body FROM runs ORDER BY rowid DESC').all()
    return rows.map((r) => {
      try {
        const parsed = JSON.parse(String(r.body)) as RunRecord
        if (parsed?.id !== r.id) throw Error('Unexpected run identity')
        return parsed
      } catch {
        throw Error(
          `损坏的运行记录 / Corrupt run ${String(r.id)}. Back up the closed database before recovery.`,
        )
      }
    })
  }

  run(id: string): RunRecord {
    const row = this.db.prepare('SELECT body FROM runs WHERE id=?').get(id)
    if (!row) throw Error('Unknown run')
    return JSON.parse(String(row.body)) as RunRecord
  }

  record(exerciseId: string, kind: string, body: unknown, at = new Date().toISOString()): void {
    this.db
      .prepare('INSERT INTO history(exercise, kind, body, at) VALUES(?,?,?,?)')
      .run(exerciseId, kind, JSON.stringify(body), at)
  }

  history<T>(exerciseId: string, kind: string): T[] {
    return this.db
      .prepare('SELECT body FROM history WHERE exercise=? AND kind=? ORDER BY seq')
      .all(exerciseId, kind)
      .map((r) => JSON.parse(String(r.body)) as T)
  }

  help(exerciseId: string): HelpLevel {
    const levels: HelpLevel[] = ['none', 'concept', 'steps', 'formula', 'code', 'unknown', 'answer']
    const since = this.get<number>('helpCycle:' + exerciseId, 0)
    return this.history<HelpLevel>(exerciseId, 'hint')
      .slice(since)
      .reduce((a, b) => (levels.indexOf(a) > levels.indexOf(b) ? a : b), 'none')
  }

  beginIndependent(exerciseId: string): void {
    this.transaction(() => {
      this.set('attempt:' + exerciseId, randomUUID())
      this.set('helpCycle:' + exerciseId, this.history(exerciseId, 'hint').length)
      this.record(exerciseId, 'independent-retry', {
        note: 'Learner started a fresh independent attempt',
      })
    })
  }

  evidence(): Evidence[] {
    return this.db
      .prepare("SELECT body FROM history WHERE kind='evidence' ORDER BY seq")
      .all()
      .map((r) => JSON.parse(String(r.body)) as Evidence)
  }

  archiveAnswers(): (AnswerRecord & {exerciseId: string})[] {
    return this.db.prepare("SELECT exercise,body FROM history WHERE kind='answer' ORDER BY seq").all()
      .map(r=>({...JSON.parse(String(r.body)) as AnswerRecord, exerciseId:String(r.exercise)}))
  }

  exportArchive(contentVersion: string): string {
    const size = this.db.prepare(`SELECT
      (SELECT coalesce(sum(length(cast(body AS blob))),0) FROM runs) +
      (SELECT coalesce(sum(length(cast(body AS blob))),0) FROM history WHERE kind IN ('evidence','answer')) AS bytes,
      (SELECT count(*) FROM runs) AS runs,
      (SELECT count(*) FROM history WHERE kind='answer') AS answers,
      (SELECT count(*) FROM history WHERE kind='evidence') AS evidence`).get()!
    if (Number(size.bytes)>4_000_000 || Number(size.runs)>1000 || Number(size.answers)>5000 || Number(size.evidence)>5000) {
      throw Error('归档超出容量或条目上限 / Archive exceeds size or item budget')
    }
    const runs = this.runs()
    if (runs.some(r=>r.run_status==='queued' || r.run_status==='running' || r.cleanupPending)) {
      throw Error('请等待运行与清理完成后导出 / Wait for pending runs and cleanup before exporting')
    }
    const answers=this.archiveAnswers()
    const evidence=this.evidence()
    const answerIds=new Set(answers.map(a=>a.id))
    const legacyAnswerIds=[...new Set(evidence.flatMap(e=>e.answerId && !answerIds.has(e.answerId)?[e.answerId]:[]))]
    const raw=JSON.stringify({ format:'ai-infra-lab-archive/1',schemaVersion:1,contentVersion,
      exportedAt:new Date().toISOString(),readLessons:this.get<string[]>('readLessons',[]),
      fastTrackedLessons:this.get<string[]>('fastTrackedLessons',[]),runs,answers,evidence,legacyAnswerIds })
    if (Buffer.byteLength(raw)>4_000_000) throw Error('归档超过 4 MB / Archive exceeds 4 MB')
    return raw
  }

  close(): void {
    this.db.close()
  }
}
