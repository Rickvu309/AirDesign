import { EyeOff } from "lucide-react"

export function SkippedSlide({ badge = false }: { badge?: boolean }) {
  const eye = <EyeOff aria-hidden="true" data-slide-skip-mark />
  return badge ? <span data-slide-skip-badge>{eye}</span> : eye
}
