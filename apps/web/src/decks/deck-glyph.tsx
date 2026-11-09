import { gearIconPath, trashIconPaths } from "@/decks/icon-paths"

type Glyph = "search" | "clock" | "decks" | "trash" | "gear" | "folder" | "chevron" | "grid" | "list" | "plug"

const native: Record<Glyph, number> = {
  search: 15,
  clock: 16,
  decks: 16,
  trash: 15,
  gear: 16,
  folder: 15,
  chevron: 14,
  grid: 15,
  list: 15,
  plug: 14,
}

export function DeckGlyph({ name, size }: { name: Glyph; size?: number }) {
  const box = size ?? native[name]
  if (name === "search") {
    return (
      <svg width={box} height={box} viewBox="0 0 15 15" fill="none" aria-hidden="true">
        <circle cx="6.875" cy="6.875" r="4.065" stroke="currentColor" strokeWidth="1.12" />
        <line x1="9.88" y1="9.88" x2="12.5" y2="12.5" stroke="currentColor" strokeWidth="1.13" strokeLinecap="round" />
      </svg>
    )
  }
  if (name === "clock") {
    return (
      <svg width={box} height={box} viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="7.995" cy="7.995" r="5.665" stroke="currentColor" strokeWidth="1.2" />
        <path
          d="M8 5 L8 8 L10 9.33"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }
  if (name === "decks") {
    return (
      <svg width={box} height={box} viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <rect x="2" y="4" width="10" height="7.33" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
        <path
          d="M4.67 2.33 H13.33 C13.7 2.33 14 2.63 14 3 V9.67"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }
  if (name === "trash") {
    return (
      <svg width={box} height={box} viewBox="10 10.5 15 15" aria-hidden="true">
        {trashIconPaths.map((d) => (
          <path key={d.slice(0, 24)} d={d} fill="currentColor" />
        ))}
      </svg>
    )
  }
  if (name === "gear") {
    return (
      <svg width={box} height={box} viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d={gearIconPath} stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    )
  }
  if (name === "folder") {
    const scale = box / 15
    return (
      <span
        className="inline-flex shrink-0 items-center justify-center overflow-visible"
        style={{ width: box, height: box }}
      >
        <svg width={16.5 * scale} height={15.12 * scale} viewBox="0 0 16.5 15.12" fill="none" aria-hidden="true">
          <line x1="2" y1="2" x2="14.5" y2="2" stroke="currentColor" strokeWidth="1.13" strokeLinecap="round" />
          <path
            d="M13.88 2 V8.87 C13.88 9.56 13.32 10.12 12.63 10.12 H3.88 C3.19 10.12 2.63 9.56 2.63 8.87 V2"
            stroke="currentColor"
            strokeWidth="1.13"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M5.13 13.25 L8.25 10.12 L11.38 13.25"
            stroke="currentColor"
            strokeWidth="1.13"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    )
  }
  if (name === "chevron") {
    const wide = box >= 14
    return (
      <svg width={box} height={box} viewBox={wide ? "0 0 14 14" : "0 0 12 12"} fill="none" aria-hidden="true">
        <path
          d={wide ? "M4.08 5.83 L7 8.75 L9.92 5.83" : "M3.5 5 L6 7.5 L8.5 5"}
          stroke="currentColor"
          strokeWidth={wide ? 1.17 : 1.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }
  if (name === "grid") {
    return (
      <svg width={box} height={box} viewBox="0 0 15 15" fill="none" aria-hidden="true">
        {[
          [2.5, 2.5],
          [8.44, 2.5],
          [2.5, 8.44],
          [8.44, 8.44],
        ].map(([x, y]) => (
          <rect
            key={`${x}-${y}`}
            x={x}
            y={y}
            width="4.06"
            height="4.06"
            rx="1.2"
            stroke="currentColor"
            strokeWidth="1.12"
          />
        ))}
      </svg>
    )
  }
  if (name === "list") {
    return (
      <svg width={box} height={box} viewBox="0 0 15 15" fill="none" aria-hidden="true">
        <path
          d="M5.63 4.06 H12.5 M5.63 7.5 H12.5 M5.63 10.94 H12.5 M2.81 4.06 H3.13 M2.81 7.5 H3.13 M2.81 10.94 H3.13"
          stroke="currentColor"
          strokeWidth="1.13"
          strokeLinecap="round"
        />
      </svg>
    )
  }
  return (
    <svg width={box} height={box} viewBox="0 0 14 14" fill="none" overflow="visible" aria-hidden="true">
      <line x1="5.25" y1="5.5" x2="5.25" y2="2" stroke="currentColor" strokeWidth="1.17" strokeLinecap="round" />
      <line x1="8.75" y1="5.5" x2="8.75" y2="2" stroke="currentColor" strokeWidth="1.17" strokeLinecap="round" />
      <path
        d="M10.5 5.5 V8.41 C10.5 9.7 9.46 10.75 8.17 10.75 H5.83 C4.54 10.75 3.5 9.7 3.5 8.41 V5.5 Z"
        stroke="currentColor"
        strokeWidth="1.17"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line x1="7" y1="10.75" x2="7" y2="13.66" stroke="currentColor" strokeWidth="1.17" strokeLinecap="round" />
    </svg>
  )
}
