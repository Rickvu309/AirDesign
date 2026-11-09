import { cn } from "@/lib/utils"

const bars = [
  { label: "Q3 24", value: 4.1 },
  { label: "Q4 24", value: 4.6 },
  { label: "Q1 25", value: 5 },
  { label: "Q2 25", value: 5.4 },
  { label: "Q3 25", value: 5.7 },
]

export function RevenueSlide({
  width,
  working = false,
  selected = false,
}: {
  width: number
  working?: boolean
  selected?: boolean
}) {
  const chartHeight = Math.round((210 * width) / 800)
  const slide = (
    <div
      className={cn(
        "relative flex shrink-0 flex-col gap-1.5 bg-white px-14 pt-11 pb-7",
        working
          ? "rounded-[4px]"
          : "rounded-[2px] shadow-[0px_0px_0px_1px_#0000000f,0px_2px_8px_#0000000d,0px_12px_32px_#00000008]",
      )}
      style={{ width, height: Math.round((width * 9) / 16) }}
    >
      <span className="text-[11px] font-semibold tracking-[1.2px] text-[#1d6b8f]">REVENUE</span>
      <span className="text-[30px] font-semibold tracking-[-0.6px] text-navy">Revenue grew 39% year over year</span>
      <span className="block flex-1" />
      <div
        className={cn(
          "relative flex flex-col gap-0 p-1",
          working && "rounded-[6px] shadow-[0px_0px_0px_1px_#4d94fb59]",
          selected && "rounded-none shadow-[0_0_0_1px_#4D94FB]",
          !working && !selected && "rounded-[6px]",
        )}
      >
        <div className="flex gap-6 border-b border-[#d7d7d6]" style={{ height: chartHeight + 26 }}>
          {bars.map((bar, index) => (
            <span key={bar.label} className="flex flex-1 flex-col items-center justify-end gap-1.5">
              <span className="text-[13px] font-semibold text-navy">${bar.value}M</span>
              <span
                className="block w-[72px]"
                style={{
                  height: Math.round((bar.value / 5.7) * chartHeight),
                  backgroundColor: index === 4 ? "#1d6b8f" : "#a9c4d2",
                }}
              />
            </span>
          ))}
        </div>
        <div className="flex gap-6 pt-2">
          {bars.map((bar) => (
            <span key={bar.label} className="flex flex-1 justify-center text-xs text-[#666666]">
              {bar.label}
            </span>
          ))}
        </div>
        {working ? (
          <span className="absolute inset-0 rounded-[6px] bg-[linear-gradient(100deg,#4d94fb00_25%,#4d94fb26_50%,#8b7bff1a_62%,#4d94fb00_80%)]" />
        ) : null}
        {selected ? <SelectionHandles /> : null}
      </div>
      <span className="text-[10px] text-faint">Source: Q3 board notes, unaudited</span>
    </div>
  )
  if (!working) return slide
  return (
    <div className="shrink-0 rounded-[6px] bg-[linear-gradient(135deg,#4D94FB_0%,#A9C8FF_35%,#B9A8FF_65%,#4D94FB_100%)] p-[2px] shadow-[0px_0px_28px_#4d94fb59,-18px_-12px_56px_#93b8ef47,18px_14px_56px_#b39dff47]">
      {slide}
    </div>
  )
}

function SelectionHandles() {
  const handle = "pointer-events-none absolute size-[7px] bg-white shadow-[inset_0_0_0_1px_#4D94FB]"
  return (
    <>
      <span className={`${handle} [inset-block-start:-3.5px] [inset-inline-start:-3.5px]`} />
      <span className={`${handle} [inset-block-start:-3.5px] [inset-inline-end:-3.5px]`} />
      <span className={`${handle} [inset-block-end:-3.5px] [inset-inline-start:-3.5px]`} />
      <span className={`${handle} [inset-block-end:-3.5px] [inset-inline-end:-3.5px]`} />
    </>
  )
}
