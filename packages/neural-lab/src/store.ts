import { randomUUID } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import type { Evidence, HelpLevel, RunRecord } from './types.ts'
export class Store {
  readonly db: DatabaseSync
  constructor(path: string) {
    this.db = new DatabaseSync(path)
    this.db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=3000;')
    const app = Number(this.db.prepare('PRAGMA application_id').get()?.application_id)
    if (app !== 0 && app !== 1313620290) {
      this.db.close()
      throw Error('This database belongs to another application')
    }
    const version = Number(this.db.prepare('PRAGMA user_version').get()?.user_version)
    if (version > 1) {
      this.db.close()
      throw Error('Unsupported Neural Lab schema version')
    }
    if (
      app === 0 &&
      this.db
        .prepare(
          "SELECT count(*) AS n FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
        )
        .get()?.n !== 0
    ) {
      this.db.close()
      throw Error('Refusing to adopt an unrecognized database')
    }
    if (version === 0)
      this.db.exec(`BEGIN IMMEDIATE;
      CREATE TABLE kv(key TEXT PRIMARY KEY,value TEXT NOT NULL);
      CREATE TABLE drafts(id TEXT PRIMARY KEY,code TEXT NOT NULL,revision INTEGER NOT NULL);
      CREATE TABLE runs(id TEXT PRIMARY KEY,exercise TEXT NOT NULL,body TEXT NOT NULL);
      CREATE TABLE history(seq INTEGER PRIMARY KEY,exercise TEXT NOT NULL,kind TEXT NOT NULL,body TEXT NOT NULL,at TEXT NOT NULL);
      PRAGMA application_id=1313620290; PRAGMA user_version=1; COMMIT;`)
    this.db.exec(
      'CREATE INDEX IF NOT EXISTS history_activity ON history(exercise,kind); CREATE INDEX IF NOT EXISTS run_activity ON runs(exercise)',
    )
    for (const run of this.runs())
      if (['queued', 'running'].includes(run.run_status))
        this.putRun({
          ...run,
          run_status: 'interrupted',
          check_status: 'not_run',
          reason: 'Host restarted before execution was confirmed',
          finishedAt: new Date().toISOString(),
        })
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
    const row = this.db.prepare('SELECT code,revision FROM drafts WHERE id=?').get(id)
    return row ? { code: String(row.code), revision: Number(row.revision) } : undefined
  }
  saveDraft(id: string, code: string, revision: number): number {
    this.db.exec('BEGIN IMMEDIATE')
    try {
      const current = this.draft(id)
      if ((current?.revision ?? 0) !== revision)
        throw Error('Draft conflict: reload the latest saved revision')
      this.db
        .prepare(
          'INSERT INTO drafts VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET code=excluded.code,revision=excluded.revision',
        )
        .run(id, code, revision + 1)
      this.db.exec('COMMIT')
      return revision + 1
    } catch (error) {
      this.db.exec('ROLLBACK')
      throw error
    }
  }
  putRun(run: RunRecord): void {
    this.db
      .prepare('INSERT INTO runs VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body')
      .run(run.id, run.exerciseId, JSON.stringify(run))
  }
  runs(id?: string): RunRecord[] {
    return (
      id
        ? this.db.prepare('SELECT body FROM runs WHERE exercise=? ORDER BY rowid DESC').all(id)
        : this.db.prepare('SELECT body FROM runs ORDER BY rowid DESC').all()
    ).map((r) => JSON.parse(String(r.body)) as RunRecord)
  }
  run(id: string): RunRecord {
    const row = this.db.prepare('SELECT body FROM runs WHERE id=?').get(id)
    if (!row) throw Error('Unknown run')
    return JSON.parse(String(row.body)) as RunRecord
  }
  record(id: string, kind: string, body: unknown): void {
    this.db
      .prepare('INSERT INTO history(exercise,kind,body,at) VALUES(?,?,?,?)')
      .run(id, kind, JSON.stringify(body), new Date().toISOString())
  }
  history<T>(id: string, kind: string): T[] {
    return this.db
      .prepare('SELECT body FROM history WHERE exercise=? AND kind=? ORDER BY seq')
      .all(id, kind)
      .map((r) => JSON.parse(String(r.body)) as T)
  }
  help(id: string): HelpLevel {
    const levels: HelpLevel[] = ['none', 'concept', 'steps', 'code', 'unknown', 'answer']
    const since = this.get<number>('helpCycle:' + id, 0)
    return this.history<HelpLevel>(id, 'hint')
      .slice(since)
      .reduce((a, b) => (levels.indexOf(a) > levels.indexOf(b) ? a : b), 'none')
  }
  beginIndependent(id: string): void {
    this.set('attempt:' + id, randomUUID())
    this.set('helpCycle:' + id, this.history(id, 'hint').length)
    this.record(id, 'independent-retry', {
      note: 'Self-reported fresh attempt; external help cannot be verified',
    })
  }
  evidence(): Evidence[] {
    return this.db
      .prepare("SELECT body FROM history WHERE kind='evidence' ORDER BY seq")
      .all()
      .map((r) => {
        const e = JSON.parse(String(r.body)) as Evidence
        return {
          ...e,
          provenance: e.id && e.contentVersion ? ('recorded' as const) : ('legacy' as const),
        }
      })
  }
  export(): string {
    return JSON.stringify(
      {
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        settings: this.db.prepare('SELECT * FROM kv').all(),
        drafts: this.db.prepare('SELECT * FROM drafts').all(),
        runs: this.runs(),
        evidence: this.evidence(),
        history: this.db.prepare('SELECT * FROM history').all(),
      },
      null,
      2,
    )
  }
  close(): void {
    this.db.close()
  }
}
