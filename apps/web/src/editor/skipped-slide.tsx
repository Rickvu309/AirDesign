import { EyeOff } from "lucide-react"

export function SkippedSlide({ width }: { width?: number | undefined }) {
  return (
    <span aria-hidden="true" data-slide-skip-cover style={width === undefined ? undefined : { width }}>
      <EyeOff data-slide-skip-mark />
    </span>
  )
}
