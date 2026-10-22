const paths = {
  back: 'M15 4 7 12l8 8M7 12h14',
  residents: 'M15 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0M5 21v-3a7 7 0 0 1 14 0v3',
  wishes: 'm12 3 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z',
  decor: 'M4 12h16v8H4ZM6 12V5h12v7M7 20v2M17 20v2',
  journal: 'M4 3h14l2 2v16H4ZM8 3v18M11 8h6M11 12h6',
  notifications: 'M20 16H4l2-3V9a6 6 0 0 1 12 0v4ZM9 20h6',
  more: 'M5 11h1v2H5ZM11 11h1v2h-1ZM17 11h1v2h-1Z',
  view: 'M16 10a6 6 0 1 1-12 0 6 6 0 0 1 12 0m-1 5 6 6M7 10h6M10 7v6',
  pause: 'M8 4v16M16 4v16',
  play: 'm7 4 13 8-13 8Z',
  home: 'M3 11 12 3l9 8M5 10v11h14V10M9 21v-7h6v7',
  camera: 'M3 7h4l2-3h6l2 3h4v14H3ZM16 14a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  expand: 'M14 3h7v7M21 3l-8 8M10 21H3v-7M3 21l8-8',
  compact: 'M21 3l-8 8M13 4v7h7M3 21l8-8M4 13h7v7',
  settings: 'M4 6h16M4 12h16M4 18h16M8 3v6M16 9v6M10 15v6',
  close: 'm6 6 12 12M18 6 6 18',
} as const
/** Repository-owned vector marks; accessible names belong to the enclosing control. */
export function VillageIcon({ name }: { name: keyof typeof paths }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false"
    style={{ verticalAlign: 'middle', flexShrink: 0 }} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d={paths[name]} />
  </svg>
}
