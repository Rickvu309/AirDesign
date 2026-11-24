import { useId } from "react"
import { Button } from "@/components/ui/button"
import { designCopy } from "@/copy/design-copy"
import { UnionControl } from "@/design/controls/union"
import { resolveControl } from "@/design/panel-arrangement"
import { fillIcons } from "@/design/preset-icons"
import { ColorPicker } from "@/design/color-picker"
import type { Desc } from "@/design/control-desc"
import { ColorField, fieldLook } from "@/design/controls/color"
import { type DesignShown } from "@/design/design-shown"
import type { PanelPaint } from "@/design/panel"
import { ControlView, DesignSection } from "@/editor/design-sections"

export function SlideBackground({
  shown,
  deck,
  onFill,
  paint,
}: {
  shown: Pick<DesignShown, "background" | "fill" | "templateColors">
  deck: readonly string[]
  onFill: (paint: PanelPaint) => void
  paint: Desc
}) {
  const { background } = shown
  const named = useId()
  const cases = paint.kind === "union" ? paint.cases : {}
  const base = resolveControl({
    trait: "fills",
    field: "paint",
    label: designCopy.background,
    desc: {
      kind: "union",
      plain: null,
      cases: {
        ...Object.fromEntries(Object.entries(cases).filter(([key]) => ["solid", "gradient", "image"].includes(key))),
      },
    },
    value: shown.fill ?? (background.value === undefined ? { image: null } : { solid: background.value }),
    mixed: false,
    inherited: false,
    reset: null,
  })
  const control = {
    ...base,
    look: {
      ...base.look,
      options: { solid: fillIcons.solid, gradient: fillIcons.gradient, image: fillIcons.image },
    },
  }
  return (
    <DesignSection title={designCopy.background}>
      <UnionControl
        control={control}
        palette={{ templateColors: shown.templateColors, deck }}
        onChange={(value) => onFill(value as PanelPaint)}
        inner={(props) =>
          props.control.field === "paint.solid" ? (
            <ColorPicker
              title={designCopy.background}
              value={background.value}
              palette={{ templateColors: shown.templateColors, deck }}
              onPick={(solid) => onFill({ solid })}
              trigger={
                <Button
                  type="button"
                  variant="ghost"
                  aria-label={designCopy.backgroundColor(background.name)}
                  data-design-swatch
                  className={fieldLook}
                />
              }
            >
              <ColorField id={named} css={background.css} name={background.name} />
            </ColorPicker>
          ) : (
            <ControlView {...props} />
          )
        }
      />
    </DesignSection>
  )
}
