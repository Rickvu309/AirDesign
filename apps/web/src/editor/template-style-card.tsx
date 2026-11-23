import type { TemplateStyle } from "@airdesign/pptx"
import { designCopy } from "@/copy/design-copy"

export function TemplateStyleFace({ style }: { style: TemplateStyle }) {
  const { name, major, minor, swatches } = style
  const fonts =
    major && minor
      ? major === minor
        ? major
        : designCopy.templateFontLine(major, minor)
      : major
        ? designCopy.headingFont(major)
        : minor
          ? designCopy.bodyFont(minor)
          : designCopy.templateFontsMissing
  const bars = ["lt1", "dk1", "accent1"].map((slot) => swatches.find(({ scheme }) => scheme === slot))
  return (
    <>
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
        <span className="truncate font-semibold" title={name ?? designCopy.currentTemplateStyle}>
          {name ?? designCopy.currentTemplateStyle}
        </span>
        <span className="truncate font-normal text-[length:var(--panel-card-meta)]" title={fonts}>
          {fonts}
        </span>
      </span>
    </>
  )
}
