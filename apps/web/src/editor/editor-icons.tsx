import { cn } from "@/lib/class-names"

const iconPaths = {
  link: '<path d="m10 13 4-4M8 15l-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0M16 9l1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0"/>',
  chev: '<path d="m6 9 6 6 6-6"/>',
  chevr: '<path d="m9 6 6 6-6 6"/>',
  chevl: '<path d="m15 6-6 6 6 6"/>',
  slide: '<rect x="2.5" y="4" width="19" height="16" rx="1.2"/><rect x="6.5" y="8" width="11" height="8" rx="0.4"/>',
  grid: '<rect x="3" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5"/>',
  cursor:
    '<path d="M4.04 4.69a.5.5 0 0 1 .65-.65l16 6.5a.5.5 0 0 1-.06.95l-6.12 1.58a2 2 0 0 0-1.44 1.43l-1.58 6.13a.5.5 0 0 1-.95.06z"/>',
  text: '<path d="M5 6V4.5h14V6M12 4.5v15M9 19.5h6"/>',
  shape: '<rect x="3.5" y="3.5" width="10" height="10" rx="1.5"/><circle cx="15.5" cy="15.5" r="5"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="m21 16-5-5-9 9"/>',
  icon: '<path d="M12 3.5 14.6 9l5.9.6-4.5 3.9 1.3 5.8L12 16.3l-5.3 3 1.3-5.8-4.5-3.9 5.9-.6z"/>',
  table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M10 4v16"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  doc: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  hand: '<path d="M18 11V6a2 2 0 0 0-4 0v5"/><path d="M14 10V4a2 2 0 0 0-4 0v6"/><path d="M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>',
  mic: '<rect x="9" y="2.5" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3.5"/>',
  arrowr: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  sliders: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
  history: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>',
  pen: '<path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.4 2.6a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  upload: '<path d="M12 15V4M7 9l5-5 5 5"/><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  chart: '<path d="M4 20h16M7 16v-5M12 16V7M17 16v-8"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  bold: '<path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z"/>',
  italic: '<path d="M19 4h-9M14 20H5M15 4 9 20"/>',
  underline: '<path d="M6 4v6a6 6 0 0 0 12 0V4M4 20h16"/>',
  minus: '<path d="M5 12h14"/>',
  play: '<path d="M7 4.8v14.4a.8.8 0 0 0 1.2.7l11.5-7.2a.8.8 0 0 0 0-1.4L8.2 4.1a.8.8 0 0 0-1.2.7z"/>',
  presenter: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4M7 8h6M7 11h4"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  restart: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  more: '<circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none"/>',
  dropper:
    '<path d="m2 22 1-1h3l9-9"/><path d="M3 21v-3l9-9"/><path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z"/>',
  alignLeft: '<path d="M4 6h16M4 12h10M4 18h16"/>',
  alignCenter: '<path d="M4 6h16M7 12h10M4 18h16"/>',
  alignRight: '<path d="M4 6h16M10 12h10M4 18h16"/>',
  bullets:
    '<circle cx="6" cy="7" r="1.15" fill="currentColor" stroke="none"/><circle cx="6" cy="12" r="1.15" fill="currentColor" stroke="none"/><circle cx="6" cy="17" r="1.15" fill="currentColor" stroke="none"/><path d="M10 7h10M10 12h10M10 17h10"/>',
  blur: '<g fill="currentColor" stroke="none"><circle cx="7" cy="7" r="1.15"/><circle cx="12" cy="7" r="1.15"/><circle cx="17" cy="7" r="1.15"/><circle cx="7" cy="12" r="1.15"/><circle cx="12" cy="12" r="1.15"/><circle cx="17" cy="12" r="1.15"/><circle cx="7" cy="17" r="1.15"/><circle cx="12" cy="17" r="1.15"/><circle cx="17" cy="17" r="1.15"/></g>',
  match:
    '<rect x="3.5" y="3.5" width="7" height="7" rx="1.3"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.3" stroke-dasharray="2.1 1.8"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.3" stroke-dasharray="2.1 1.8"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.3" stroke-dasharray="2.1 1.8"/>',
  swap: '<path d="M5.5 7.4h5.6a1.4 1.4 0 0 1 1.4 1.4V11"/><path d="M5.5 7.4V13a1.4 1.4 0 0 0 1.4 1.4h2"/><path d="M14.8 8.4a5.7 5.7 0 1 1-4.6 7.4"/><path d="M17.6 4.4 14.6 8.2h4.6"/>',
} as const

export type EditorIconName = keyof typeof iconPaths

export function EditorIcon({
  name,
  size = 16,
  className,
  strokeWidth = 1.75,
}: {
  name: EditorIconName
  size?: number
  className?: string
  strokeWidth?: number
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("shrink-0", className)}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: iconPaths[name] }}
    />
  )
}

export function SparkIcon({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={cn("shrink-0", className)} aria-hidden="true">
      <path
        d="M4.5 20.5 9.4 10.2M19.5 20.5 14.6 10.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        fill="currentColor"
        d="M12 1.6c.43 2.37 1.63 3.57 4 4-2.37.43-3.57 1.63-4 4-.43-2.37-1.63-3.57-4-4 2.37-.43 3.57-1.63 4-4z"
      />
    </svg>
  )
}
