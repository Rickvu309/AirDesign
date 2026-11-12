import type { PaintBox } from "./paint-box.js"
import type { Scaled } from "./text-look.js"

const labelSize = 177_800
const labelInset = 91_440
const labelWidth = 1_800_000
const labelHeight = 450_000

export function UnshownLabel(props: {
  readonly box: PaintBox | null
  readonly scaled: Scaled
  readonly text: string | undefined
}) {
  const { box, scaled, text } = props
  if (text === undefined || box === null || box.width < labelWidth || box.height < labelHeight) return null
  return (
    <div
      data-unshown-label
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: scaled(labelInset),
        textAlign: "center",
        fontFamily: "var(--font-sans)",
        fontSize: `${scaled(labelSize)}px`,
        lineHeight: 1.3,
        color: "var(--placeholder-prompt)",
        pointerEvents: "none",
        userSelect: "none",
      }}
    >
      {text}
    </div>
  )
}
