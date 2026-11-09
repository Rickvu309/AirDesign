type MarkWeight = "regular" | "bold"

const strokes: Record<MarkWeight, { color: string; stem: string; bar: string }> = {
  regular: { color: "#111111", stem: "3.063", bar: "2.188" },
  bold: { color: "#222222", stem: "5.76", bar: "4.16" },
}

export function AirdesignMark({
  size,
  weight = "regular",
}: {
  size: number
  weight?: MarkWeight
}) {
  const stroke = strokes[weight]
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className="shrink-0" aria-hidden="true">
      <path
        d="M13 57l19-50 19 50"
        fill="none"
        stroke={stroke.color}
        strokeWidth={stroke.stem}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6 44l52-14"
        fill="none"
        stroke="#FF58AE"
        strokeWidth={stroke.bar}
        strokeLinecap="round"
      />
    </svg>
  )
}
