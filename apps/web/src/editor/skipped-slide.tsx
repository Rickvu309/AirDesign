import { EyeOff } from "lucide-react"

export function SkippedSlide() {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute right-2 bottom-2 grid size-6 place-items-center rounded-md bg-foreground text-white"
    >
      <EyeOff className="size-4" />
    </span>
  )
}
