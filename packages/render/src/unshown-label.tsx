import type { Scaled } from "./text-look.js"

const labelSize = 177_800
const labelInset = 91_440

export function UnshownLabel({ scaled, text }: { readonly scaled: Scaled; readonly text: string | undefined }) {
  if (text === undefined) return null
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
