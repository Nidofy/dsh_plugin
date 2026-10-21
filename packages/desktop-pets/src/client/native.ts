interface DesktopPetsBridge {
  protocolVersion: number
  onNavigate: (listener: (sessionId: string) => void) => () => void
}
export function desktopPetsBridge(): DesktopPetsBridge | undefined {
  const bridge = (globalThis as typeof globalThis & { nidofyPetDesktop?: DesktopPetsBridge }).nidofyPetDesktop
  return bridge?.protocolVersion === 1 && typeof bridge.onNavigate === 'function' ? bridge : undefined
}
