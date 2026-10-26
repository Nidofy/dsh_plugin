/** Offline, closed one-turn fixture through official rc.3 Session and JSONL APIs. No AgentLoop/model. */
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { randomUUID } from 'node:crypto'
const root = resolve(import.meta.dirname, '..'), work = join(root, '.build/ai-village-rc3-desktop')
const require = createRequire(join(root, '.build/official-runtime-rc3/package.json'))
const module = id => import(pathToFileURL(require.resolve(id)).href)
const { Context } = await module('@deepseek-ai/cordis'), { Session, SessionId, SESSION_FORMAT_VERSION } = await module('@deepseek-ai/dsh-session')
const { createUserMessage, createSystemMessage } = await module('@deepseek-ai/dsh-llm'), persistence = await module('@deepseek-ai/dsh-session-persistence-jsonl')
assert.equal(JSON.parse(await readFile(require.resolve('@deepseek-ai/dsh-session/package.json'), 'utf8')).version, '0.2.1-rc.3')
const evidence = join(work, 'session-fixture.json'); await assert.rejects(readFile(evidence), e => e.code === 'ENOENT')
const ctx = new Context()
try {
  await ctx.plugin(persistence, { root: join(work, 'home/sessions') })
  const entries = await ctx.sessionPersistence.list()
  const previous = entries[0]; assert.ok(previous, 'Open one blank session in the isolated UI first')
  const id = SessionId('session-' + randomUUID()), header = { version: SESSION_FORMAT_VERSION, id, createdAt: Date.now(), cwd: previous.header.cwd, isSeeded: false, delegationDepth: 0, agentPreset: 'standard' }
  const session = Session.create(id, [], header)
  session.append('turn/start', { turn: 1 }); session.append('step/start', { turn: 1, step: 1 })
  session.append('system/message', { turn: 1, step: 1, message: createSystemMessage('') }, { surfaceOp: 'append' })
  const user = session.append('user/message', createUserMessage({ content: [{ type: 'text', text: 'Offline rc.3 UI qualification fixture. No model was called.' }], source: { kind: 'user' } }), { surfaceOp: 'append' })
  session.append('session/title', { title: 'rc.3 offline UI fixture', messageSeqs: [user.seq], source: { kind: 'fallback' } })
  session.append('step/end', { turn: 1, step: 1 }); session.append('turn/end', { turn: 1, reason: { kind: 'completed' } })
  const handle = await ctx.sessionPersistence.create(header); await handle.append(session.snapshotEvents()); await handle.close()
  const check = await ctx.sessionPersistence.open(id, 'read'), saved = await check.read(); await check.close()
  assert.equal(saved.events.at(-1).type, 'turn/end')
  await writeFile(evidence, JSON.stringify({ id, title: 'rc.3 offline UI fixture', header, events: saved.events, modelCalls: 0, writer: '@deepseek-ai/dsh-session-persistence-jsonl@0.2.1-rc.3' }, null, 2), { flag: 'wx' })
  console.log('Created closed synthetic UI fixture through official rc.3 APIs: ' + id)
} finally { await ctx.fiber.dispose() }
