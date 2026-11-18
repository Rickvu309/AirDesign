import type { LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { fillCopy, fillWords } from "@/copy/fill-copy"
import { unionValue } from "@/design/controls/union"
import { fillIcons } from "@/design/preset-icons"
import type { ControlProps } from "@/design/panel"
import { cn } from "@/lib/class-names"

const kinds: readonly (readonly [string, LucideIcon])[] = [
  ["none", fillIcons.none],
  ["solid", fillIcons.solid],
  ["gradient", fillIcons.gradient],
  ["image", fillIcons.image],
]

function pictureKindValue(control: ControlProps["control"], palette: ControlProps["palette"], name: string) {
  return name === "image" ? undefined : unionValue(control, palette, name)
}

export function PictureFillKinds({ control, palette, onChange }: ControlProps) {
  return (
    <div
      role="group"
      aria-label={fillCopy.value}
      data-picture-kind
      className="flex h-[var(--control-dense)] items-center rounded-[var(--shape-control)] bg-line p-0.5"
    >
      {kinds.map(([name, Icon]) => {
        const pressed = name === "image"
        const word = fillWords[name] ?? name
        return (
          <Button
            key={name}
            type="button"
            variant="ghost"
            aria-pressed={pressed}
            title={word}
            onClick={() => {
              const value = pictureKindValue(control, palette, name)
              if (value !== undefined) onChange(value)
            }}
            className={cn(
              "h-5 min-w-0 flex-1 rounded-[var(--shape-segment)] px-1 text-xs font-normal text-foreground active:translate-y-0",
              pressed
                ? "bg-white font-medium shadow-[0px_1px_2px_var(--black-10)] hover:bg-white"
                : "hover:bg-transparent",
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
