import * as doom from "@airdesign/doom"
import { designCopy } from "@/copy/design-copy"
import type { Swatch } from "@/design/color-choices"
import { DesignSection } from "@/editor/design-sections"
import { templateNameOf } from "./design-template-name"

const barColors = ["background", "text", "accent1"] as const

export function DoomThemeCard(props: { readonly theme: doom.Theme; readonly swatches: readonly Swatch[] }) {
  const { theme, swatches } = props
  const name = templateNameOf(theme) ?? designCopy.currentTemplateStyle
  const { heading, body } = theme.fonts
  const fonts = heading === body ? heading : designCopy.templateFontLine(heading, body)
  const bars = barColors.map((color) => swatches.find((swatch) => swatch.var === color))
  return (
    <DesignSection title={designCopy.templateStyle}>
      <div data-template-style className="flex min-w-0 items-center gap-2">
        <span aria-hidden="true" className="flex h-8 w-8 shrink-0 overflow-hidden rounded-sm border border-line">
          {bars.map((bar, index) => (
            <span
              key={index}
              className="flex-1 bg-muted"
              style={bar === undefined ? undefined : { backgroundColor: bar.css }}
            />
          ))}
        </span>
        <span className="flex min-w-0 flex-col text-[length:var(--panel-control-size)]">
          <span className="truncate font-semibold" title={name}>
            {name}
          </span>
          <span className="truncate font-normal text-[length:var(--panel-card-meta)]" title={fonts}>
            {fonts}
          </span>
        </span>
      </div>
    </DesignSection>
  )
}
