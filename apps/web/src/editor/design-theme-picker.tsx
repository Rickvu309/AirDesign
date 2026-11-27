import * as doom from "@airdesign/doom"
import { themePresets, themePresetOf } from "@airdesign/taste"
import { fontFamily } from "@airdesign/fonts"
import { fontsFor } from "@airdesign/render"
import { useEffect } from "react"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { designCopy } from "@/copy/design-copy"
import { cn } from "@/lib/class-names"
import { useServedFaces } from "@/design/served-faces"
import { DesignSection } from "./design-sections"

const themes = [...themePresets].sort((one, two) => one.name.localeCompare(two.name))
const thumbnailAccents = ["accent1", "accent2", "accent3"] as const

function ThemeThumbnail({ theme, compact = false }: { readonly theme: doom.Theme; readonly compact?: boolean }) {
  const { colors, fonts, textStyles } = theme
  const heading = fonts.heading
  const loader = typeof document === "undefined" ? undefined : fontsFor(document)
  useEffect(() => {
    void loader?.load(heading)
  }, [loader, heading])
  const pending = loader !== undefined && !loader.ready(heading)
  return (
    <span
      aria-hidden="true"
      data-fonts-pending={pending ? "" : undefined}
      className={cn(
        "flex aspect-video shrink-0 flex-col items-center justify-center overflow-hidden rounded-[var(--shape-control)] outline -outline-offset-1 outline-black/10 [font-synthesis:none] dark:outline-white/10",
        compact ? "w-12 gap-0.5 text-[length:var(--type-body)]" : "w-18 gap-1 text-[length:var(--type-title)]",
        "leading-none",
      )}
      style={{ backgroundColor: colors.background }}
    >
      <span
        style={{
          color: colors.text,
          fontFamily: fontFamily(loader?.servedFamily(heading) ?? null),
          fontWeight: textStyles.title.weight,
        }}
      >
        {designCopy.themeSample}
      </span>
      <span className="flex gap-0.5">
        {thumbnailAccents.map((accent) => (
          <span
            key={accent}
            className={cn("rounded-full", compact ? "h-1 w-2" : "h-1.5 w-3")}
            style={{ backgroundColor: colors[accent] }}
          />
        ))}
      </span>
    </span>
  )
}

export function ThemePicker({
  theme,
  onChoose,
}: {
  readonly theme: doom.Theme
  readonly onChoose: (id: string) => void
}) {
  useServedFaces()
  const current = themePresetOf(theme)
  const name = current?.name ?? designCopy.customTheme
  return (
    <DesignSection title={designCopy.theme}>
      <Select
        modal={false}
        value={current?.id ?? null}
        onValueChange={(id) => {
          if (id !== null) onChoose(id)
        }}
      >
        <SelectTrigger
          aria-label={designCopy.chooseTheme(name)}
          className="w-full rounded-[var(--shape-control)] border-line bg-background px-2 text-[length:var(--panel-control-size)] hover:bg-muted data-placeholder:text-foreground data-popup-open:bg-muted data-[size=default]:h-9"
        >
          <SelectValue className="min-w-0 gap-2">
            <ThemeThumbnail theme={theme} compact />
            <span className="truncate">{name}</span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent
          alignItemWithTrigger={false}
          className="overscroll-contain text-[length:var(--panel-control-size)] outline-none"
        >
          <SelectGroup>
            {themes.map(({ id, name, theme }) => (
              <SelectItem
                key={id}
                value={id}
                label={name}
                className="min-h-9 pl-1 text-[length:var(--panel-control-size)] [&>span:last-child]:min-w-0 [&>span:last-child]:shrink"
              >
                <ThemeThumbnail theme={theme} />
                <span className="self-center truncate" title={name}>
                  {name}
                </span>
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </DesignSection>
  )
}
