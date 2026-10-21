/** Supersample at 100% scaling as well as HiDPI; cap backing-store memory. */
export function renderResolution(dpr: number, width: number, height: number): number {
  const native = Number.isFinite(dpr) && dpr > 0 ? dpr : 1
  return Math.max(1, Math.min(Math.max(2,native),3,Math.sqrt(4_000_000/Math.max(1,width*height))))
}
