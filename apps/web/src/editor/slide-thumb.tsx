import { cn } from "@/lib/utils"

const bars = [4.1, 4.6, 5, 5.4, 5.7]

export function SlideThumb({ index, width, queued = false }: { index: number; width: number; queued?: boolean }) {
  const height = Math.round((width * 9) / 16)
  const scale = width / 160
  const px = (value: number) => Math.max(1, Math.round(value * scale * 10) / 10)
  if (queued) {
    return (
      <div
        className="flex shrink-0 items-center justify-center rounded-[2px] bg-canvas text-[11px] text-faint shadow-[inset_0px_0px_0px_1px_#d7d7d6]"
        style={{ width, height }}
      >
        Queued
      </div>
    )
  }
  const pad = px(12)
  const gap = px(5)
  const titleSize = px(10)
  const line = (length: number, color = "#d7d7d6", thickness = 3) => (
    <span
      className="block shrink-0 rounded-full"
      style={{ width: px(length), height: px(thickness), backgroundColor: color }}
    />
  )
  const title = (text: string, color = "#222222") => (
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
        {title("Q3 Investor Update", "#ffffff")}
        {line(50, "#ffffff55", 2.5)}
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
              style={{ width: px(16), height: px(value * 7 - 14), backgroundColor: bar === 4 ? "#1d6b8f" : "#a9c4d2" }}
            />
          ))}
        </span>
      </>
    )
  } else if (index === 4) {
    body = (
      <>
        <span className="block font-semibold text-[#1d6b8f]" style={{ fontSize: px(26), lineHeight: 1 }}>
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
    body = title("Product", "#0f2433")
  } else if (index === 7) {
    body = (
      <>
        {title("Hiring plan")}
        <span className="flex" style={{ gap: px(5) }}>
          {Array.from({ length: 4 }, (_, dot) => (
            <span key={dot} className="block rounded-full bg-[#d7d7d6]" style={{ width: px(16), height: px(16) }} />
          ))}
        </span>
      </>
    )
  } else {
    body = (
      <>
        <span className="block flex-1" />
        {title("Next quarter", "#ffffff")}
        {line(44, "#ffffff66", 2.5)}
      </>
    )
  }
  const fill = index === 1 ? "bg-navy" : index === 6 ? "bg-[#a9c4d2]" : index === 8 ? "bg-[#1d6b8f]" : "bg-white"
  return (
    <div
      className={cn(
        "flex shrink-0 flex-col overflow-hidden rounded-[2px]",
        fill,
        white && hairline,
        index === 4 && "justify-center",
      )}
      style={{ width, height, padding: pad, gap }}
    >
      {body}
    </div>
  )
}

const hairline = "shadow-[0px_0px_0px_1px_#d7d7d6]"

export function PastedThumb({ kind }: { kind: "region" | "churn" }) {
  const title = kind === "region" ? "Market share by region" : "Churn is down to 4%"
  return (
    <div className="flex h-[169px] w-[300px] shrink-0 flex-col gap-3 rounded-[2px] bg-white p-[22px] shadow-[0px_0px_0px_1px_#d7d7d6]">
      <span className="block h-5 text-[15px] leading-5 font-semibold text-[#1f1f1f]">{title}</span>
      {kind === "region" ? (
        <span className="flex flex-1 items-end gap-2.5">
          {[46, 34, 58, 26].map((height) => (
            <span key={height} className="block w-[26px] bg-[#8a8a8a]" style={{ height }} />
          ))}
        </span>
      ) : (
        <span className="flex flex-col gap-2">
          {[180, 150, 164].map((width) => (
            <span key={width} className="block h-[5px] rounded-[3px] bg-[#d7d7d6]" style={{ width }} />
          ))}
        </span>
      )}
    </div>
  )
}
