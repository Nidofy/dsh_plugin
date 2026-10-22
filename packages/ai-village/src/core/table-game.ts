import { characterIds, type CharacterId } from './roster.ts'

export type TableResult = 'player' | 'resident' | 'draw' | null
const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]] as const
export const blankTableBoard = (): number[] => Array(9).fill(-1)
export function tableResult(board: readonly number[]): TableResult {
  for (const line of lines) if (board[line[0]] !== -1 && line.every(i => board[i] === board[line[0]])) return board[line[0]] === 0 ? 'player' : 'resident'
  return board.every(n => n !== -1) ? 'draw' : null
}
/** A small, deterministic opponent: finish a line, block a line, then choose its favorite corner. */
function residentMove(board: readonly number[], resident: CharacterId): number {
  const empty = board.map((v,i)=>v===-1?i:-1).filter(i=>i>=0)
  for (const mark of [1,0]) for (const i of empty) {
    const next = [...board]; next[i] = mark
    if (tableResult(next) === (mark===1?'resident':'player')) return i
  }
  const corners = [0,2,8,6], offset = characterIds.indexOf(resident) % 4
  const order = [4,...corners.slice(offset),...corners.slice(0,offset),1,3,5,7]
  return order.find(i=>board[i]===-1)!
}
/** Both marks are one candidate transaction, so a missing ACK cannot repeat the resident turn. */
export function tableRound(source: readonly number[], cell: number, resident: CharacterId): { board: number[]; choices: string[] } {
  if (source.length!==9 || source.some(n=>![-1,0,1].includes(n)) || tableResult(source)
    || source.filter(n=>n===0).length!==source.filter(n=>n===1).length || !Number.isInteger(cell) || cell<0 || cell>8 || source[cell]!==-1) throw Error('INVALID_TABLE_MOVE')
  const board = [...source], choices = [String(cell)]; board[cell] = 0
  if (!tableResult(board)) { const reply = residentMove(board,resident); board[reply] = 1; choices.push(String(reply)) }
  return { board, choices }
}
/** Replay at most five candidate turns. Reject forged boards, post-win moves and impossible replies. */
export function validTableHistory(board: unknown, choices: unknown, resident: CharacterId): boolean {
  if (!Array.isArray(board) || board.length!==9 || board.some(n=>![-1,0,1].includes(n)) || !Array.isArray(choices) || choices.length>9 || choices.some(c=>typeof c!=='string'||!/^[0-8]$/.test(c))) return false
  let expected = blankTableBoard(), cursor = 0
  try {
    while(cursor<choices.length) {
      const round = tableRound(expected,Number(choices[cursor]),resident)
      if (round.choices.some((v,i)=>v!==choices[cursor+i])) return false
      expected = round.board; cursor += round.choices.length
    }
  } catch { return false }
  return cursor===choices.length && expected.every((v,i)=>v===board[i])
}
