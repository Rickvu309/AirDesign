import {
  pastedBar,
  pastedLine,
  pastedTitle,
  thumbInk,
  thumbInkMid,
  thumbInkSoft,
  thumbLine,
  thumbMist,
  thumbNavy,
  thumbTeal,
  thumbTitle,
} from "@/editor/slide-thumb-art"
import { cn } from "@/lib/utils"

const bars = [4.1, 4.6, 5, 5.4, 5.7]
const frameShadow = "shadow-[0px_0px_0px_1px_var(--field-edge)]"

export function SlideThumb({ index, width, queued = false }: { index: number; width: number; queued?: boolean }) {
  const height = Math.round((width * 9) / 16)
  const scale = width / 160
  const px = (value: number) => Math.max(1, Math.round(value * scale * 10) / 10)
  if (queued) {
    return (
      <div
        className="flex shrink-0 items-center justify-center rounded-[2px] bg-canvas text-[11px] text-faint shadow-[inset_0px_0px_0px_1px_var(--field-edge)]"
        style={{ width, height }}
      >
        Queued
      </div>
    )
  }
  const pad = px(12)
  const gap = px(5)
  const titleSize = px(10)
  const line = (length: number, color = thumbLine, thickness = 3) => (
    <span
      className="block shrink-0 rounded-full"
      style={{ width: px(length), height: px(thickness), backgroundColor: color }}
    />
  )
  const title = (text: string, color = thumbTitle) => (
    <span className="block font-semibold" style={{ fontSize: titleSize, color, lineHeight: 1.2 }}>
      {text}
    </span>
  )
  const white = index === 2 || index === 3 || index === 4 || index === 5 || index === 7
  let body = null
  if (index === 1) {
    body = (
      <>
        <span className="block flex-1" />
        {title("Q3 Investor Update", thumbInk)}
        {line(50, thumbInkSoft, 2.5)}
      </>
    )
  } else if (index === 2) {
    body = (
      <>
        {title("Three things to know")}
        {line(110)}
        {line(96)}
        {line(104)}
      </>
    )
  } else if (index === 3) {
    body = (
      <>
        {title("Revenue grew 39%")}
        <span className="flex flex-1 items-end" style={{ gap: px(8) }}>
          {bars.map((value, bar) => (
            <span
              key={value}
              className="block"
              style={{ width: px(16), height: px(value * 7 - 14), backgroundColor: bar === 4 ? thumbTeal : thumbMist }}
            />
          ))}
        </span>
      </>
    )
  } else if (index === 4) {
    body = (
      <>
        <span className="block font-semibold" style={{ fontSize: px(26), lineHeight: 1, color: thumbTeal }}>
          71%
        </span>
        {line(60)}
      </>
    )
  } else if (index === 5) {
    body = (
      <>
        {title("Customers")}
        <span className="flex flex-wrap" style={{ gap: px(5) }}>
          {Array.from({ length: 6 }, (_, cell) => (
            <span key={cell} className="block bg-line" style={{ width: px(40), height: px(13) }} />
          ))}
        </span>
      </>
    )
  } else if (index === 6) {
    body = title("Product", thumbNavy)
  } else if (index === 7) {
    body = (
      <>
        {title("Hiring plan")}
        <span className="flex" style={{ gap: px(5) }}>
          {Array.from({ length: 4 }, (_, dot) => (
            <span
              key={dot}
              className="block rounded-full"
              style={{ width: px(16), height: px(16), backgroundColor: thumbLine }}
            />
          ))}
        </span>
      </>
    )
  } else {
    body = (
      <>
        <span className="block flex-1" />
        {title("Next quarter", thumbInk)}
        {line(44, thumbInkMid, 2.5)}
      </>
    )
  }
  const fill = index === 1 ? "bg-navy" : index === 6 ? undefined : index === 8 ? undefined : "bg-white"
  return (
    <div
      className={cn(
        "flex shrink-0 flex-col overflow-hidden rounded-[2px]",
        fill,
        white && frameShadow,
        index === 4 && "justify-center",
      )}
      style={{
        width,
        height,
        padding: pad,
        gap,
        backgroundColor: index === 6 ? thumbMist : index === 8 ? thumbTeal : undefined,
      }}
    >
      {body}
    </div>
  )
}

export function PastedThumb({ kind }: { kind: "region" | "churn" }) {
  const title = kind === "region" ? "Market share by region" : "Churn is down to 4%"
  return (
    <div
      className={cn("flex h-[169px] w-[300px] shrink-0 flex-col gap-3 rounded-[2px] bg-white p-[22px]", frameShadow)}
    >
      <span className="block h-5 text-[15px] leading-5 font-semibold" style={{ color: pastedTitle }}>
        {title}
      </span>
      {kind === "region" ? (
        <span className="flex flex-1 items-end gap-2.5">
          {[46, 34, 58, 26].map((height) => (
            <span key={height} className="block w-[26px]" style={{ height, backgroundColor: pastedBar }} />
          ))}
        </span>
      ) : (
        <span className="flex flex-col gap-2">
          {[180, 150, 164].map((width) => (
            <span key={width} className="block h-[5px] rounded-[3px]" style={{ width, backgroundColor: pastedLine }} />
          ))}
        </span>
      )}
    </div>
  )
}
