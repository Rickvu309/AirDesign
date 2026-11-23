import { markBar, markColor, markSlash, markStem } from "@/components/ui/airdesign-mark-art"

export function AirdesignMark({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className="shrink-0" aria-hidden="true">
      <path
        d="M13 57l19-50 19 50"
        fill="none"
        stroke={markColor}
        strokeWidth={markStem}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M6 44l52-14" fill="none" stroke={markSlash} strokeWidth={markBar} strokeLinecap="round" />
    </svg>
  )
}
