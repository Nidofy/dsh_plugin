import { DatabaseSync } from 'node:sqlite'
import { randomUUID } from 'node:crypto'
/** A short SQLite transaction serializes stale-owner recovery with competing startups. */
export async function acquireOwner(path:string):Promise<()=>Promise<void>> {
  const token=randomUUID(),db=new DatabaseSync(path)
  db.exec('PRAGMA busy_timeout=3000; CREATE TABLE IF NOT EXISTS owner(slot INTEGER PRIMARY KEY CHECK(slot=1),pid INTEGER NOT NULL,token TEXT NOT NULL); BEGIN IMMEDIATE;')
  try {
    const prior=db.prepare('SELECT pid FROM owner WHERE slot=1').get()
    if(prior){const pid=Number(prior.pid);if(!Number.isSafeInteger(pid)||pid<1)throw Error('Invalid owner identity')
      try{process.kill(pid,0);throw Error('Neural Lab data root already has an active owner')}catch(probe){if(!(probe instanceof Error&&'code' in probe&&probe.code==='ESRCH'))throw probe}}
    db.prepare('INSERT INTO owner VALUES(1,?,?) ON CONFLICT(slot) DO UPDATE SET pid=excluded.pid,token=excluded.token').run(process.pid,token)
    db.exec('COMMIT')
  }catch(error){db.exec('ROLLBACK');db.close();throw error}
  let released=false
  return async()=>{if(released)return;released=true;try{db.prepare('DELETE FROM owner WHERE slot=1 AND token=?').run(token)}finally{db.close()}}
}
