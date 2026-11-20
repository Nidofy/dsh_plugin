export const STRIDES = [1, 2, 4, 8, 16, 32] as const
export interface WarpAccess {
  stride: number
  baseOffsetElements: number
  broadcast: boolean
}

export function isWarpAccess(value: unknown): value is WarpAccess {
  const v = value as WarpAccess | null
  return !!v && STRIDES.some(s => s === v.stride) && Number.isInteger(v.baseOffsetElements) &&
    v.baseOffsetElements >= 0 && v.baseOffsetElements < 32 && typeof v.broadcast === 'boolean'
}

export function warpAccess(input: WarpAccess) {
  if (!isWarpAccess(input)) throw RangeError('无效的访存参数 / Invalid warp access')
  const banks = Array.from({ length: 32 }, () => new Set<number>())
  const lanes = Array.from({ length: 32 }, (_, lane) => {
    const word = input.baseOffsetElements + (input.broadcast ? 0 : lane * input.stride)
    const address = 4 * word
    const bank = word % 32
    banks[bank]!.add(word)
    return { lane, address, segment: Math.floor(address / 128), bank }
  })
  const segments = [...new Set(lanes.map(l => l.segment))]
  const bankDistribution = banks.map((words, bank) => ({
    bank, lanes: lanes.filter(lane => lane.bank === bank).map(lane => lane.lane),
    distinctWords: [...words], ways: words.size,
  }))
  const transferredBytes = 128 * segments.length
  const usefulBytes = 4 * new Set(lanes.map(l => l.address)).size
  return { lanes, segments, bankDistribution, transactionsCount: segments.length, usefulBytes, transferredBytes,
    utilization: usefulBytes / transferredBytes, maxWayConflict: Math.max(...banks.map(b => b.size)) }
}

export function completedWarpAccess(observations: unknown): boolean {
  if (!Array.isArray(observations) || observations.length > 32 || !observations.every(isWarpAccess)) return false
  const runs = observations.map(warpAccess)
  return runs.some(r => r.utilization === 1 && r.transactionsCount === 1) &&
    runs.some(r => r.transactionsCount >= 4) && runs.some(r => r.maxWayConflict >= 4)
}
