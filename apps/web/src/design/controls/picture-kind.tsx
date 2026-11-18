import type { LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { fillCopy, fillWords } from "@/copy/fill-copy"
import { fillIcons } from "@/design/preset-icons"
import { cn } from "@/lib/class-names"

const heldBack = "This image can't change to another fill yet."

const kinds: readonly (readonly [string, LucideIcon])[] = [
  ["none", fillIcons.none],
  ["solid", fillIcons.solid],
  ["gradient", fillIcons.gradient],
  ["picture", fillIcons.picture],
]

export function PictureFillKinds() {
  return (
    <div
      role="group"
      aria-label={fillCopy.value}
      data-picture-kind
      className="flex h-[var(--control-dense)] items-center rounded-[var(--shape-control)] bg-line p-0.5"
    >
      {kinds.map(([name, Icon]) => {
        const pressed = name === "picture"
        const word = fillWords[name] ?? name
        return (
          <Button
            key={name}
            type="button"
            variant="ghost"
            aria-pressed={pressed}
            disabled={!pressed}
            title={pressed ? word : heldBack}
            className={cn(
              "h-5 min-w-0 flex-1 rounded-[var(--shape-segment)] px-1 text-xs font-normal active:translate-y-0",
              pressed
                ? "bg-white font-medium text-foreground shadow-[0px_1px_2px_var(--black-10)] hover:bg-white"
                : "text-quiet",
            )}
          >
            <Icon size={14} className="size-3.5" strokeWidth={1.5} aria-hidden />
            <span className="sr-only">{word}</span>
          </Button>
        )
      })}
    </div>
  )
}
