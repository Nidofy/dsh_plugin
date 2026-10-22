const paths = {
  home: 'M3 11 12 3l9 8M5 10v11h14V10M9 21v-7h6v7',
  camera: 'M3 7h4l2-3h6l2 3h4v14H3ZM16 14a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  expand: 'M14 3h7v7M21 3l-8 8M10 21H3v-7M3 21l8-8',
  compact: 'M21 3l-8 8M13 4v7h7M3 21l8-8M4 13h7v7',
  settings: 'M4 6h16M4 12h16M4 18h16M8 3v6M16 9v6M10 15v6',
  close: 'm6 6 12 12M18 6 6 18',
} as const
/** Repository-owned vector marks; accessible names belong to the enclosing control. */
export function VillageIcon({ name }: { name: keyof typeof paths }) {
  return <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" focusable="false"
    style={{ verticalAlign: 'middle', flexShrink: 0 }} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={paths[name]} />
  </svg>
}
