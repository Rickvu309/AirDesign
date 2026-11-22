import { useState } from "react"
import { doom } from "@airdesign/document"
import { schemeNames } from "@airdesign/document"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { designCopy } from "@/copy/design-copy"
import { arrange } from "@/design/panel-arrangement"
import { ColorPicker } from "@/design/color-picker"
import { DesignSection, SectionStrips } from "@/editor/design-panel"
import { EditorIcon } from "@/editor/editor-icons"
import { TemplateStyleFace } from "@/editor/template-style-card"
import { oldControl } from "./design-controls"
import { slotOfVar } from "./design-values"
import { swatchesOf } from "./design-palette"
import { templateNameOf } from "./design-template-name"
import { themeColorWrites } from "./chart-theme-writes"
import type { EditorClient } from "./use-doom-deck"

const fontName = (name: "heading" | "body") => name

export function DoomThemeCard(props: {
  readonly client: EditorClient
  readonly view: doom.Doom
  readonly theme: doom.Theme
}) {
  const { client, view, theme } = props
  const [editing, setEditing] = useState(false)
  const swatches = swatchesOf(theme)
  const templateName = templateNameOf(theme)
  const face = {
    name: templateName,
    major: theme.fonts.heading,
    minor: theme.fonts.body,
    swatches: swatches.filter((swatch) => (schemeNames as readonly string[]).includes(swatch.scheme)),
  }
  const deck = [...view.nodes.values()].find((node) => node.type === "deck")
  const fonts = [
    oldControl("templateStyle", "major", { value: theme.fonts.heading }),
    oldControl("templateStyle", "minor", { value: theme.fonts.body }),
  ]
  const setFont = (field: string, value: unknown) => {
    if (deck === undefined || typeof value !== "string" || value === "") return
    const name = fontName(field === "major" ? "heading" : "body")
    client.push([{ node: deck.id, prop: "theme", value: { ...theme, fonts: { ...theme.fonts, [name]: value } } }])
  }
  return (
    <DesignSection
      title={designCopy.templateStyle}
      action={
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-6"
          aria-label={designCopy.editTemplateStyle}
          onClick={() => setEditing(true)}
        >
          <EditorIcon name="styleSliders" size={14} />
        </Button>
      }
    >
      <div className="flex min-w-0 items-center gap-1 rounded border border-line p-2 hover:bg-muted">
        <button
          type="button"
          data-template-style
          aria-label={designCopy.editTemplateStyle}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          onClick={() => setEditing(true)}
        >
          <TemplateStyleFace style={face} />
        </button>
      </div>
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent data-template-style-dialog>
          <DialogTitle className="min-w-0 flex-1 truncate">
            {templateName ?? designCopy.currentTemplateStyle}
          </DialogTitle>
          <DialogDescription>{designCopy.templateScope}</DialogDescription>
          <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto">
            <section className="flex flex-col gap-3">
              <h3 className="font-medium">{designCopy.templateColors}</h3>
              <div className="grid grid-cols-6 gap-2">
                {(Object.keys(slotOfVar) as doom.ColorVar[]).map((name, at) => {
                  const hex = theme.colors[name]
                  const label = swatches[at]?.name ?? name
                  return (
                    <ColorPicker
                      key={name}
                      title={label}
                      value={{ rgb: hex.slice(1).toUpperCase() }}
                      palette={{ templateColors: [], deck: [] }}
                      showTemplateColors={false}
                      onPick={(color) => {
                        if ("rgb" in color) client.push(themeColorWrites(view, name, `#${color.rgb}`))
                      }}
                      children={null}
                      trigger={
                        <Button
                          variant="outline"
                          className="size-9"
                          aria-label={label}
                          title={`${label} ${hex}`}
                          style={{ backgroundColor: hex }}
                        />
                      }
                    />
                  )
                })}
              </div>
            </section>
            <section className="flex flex-col gap-2">
              <h3 className="font-medium">{designCopy.templateFonts}</h3>
              <SectionStrips
                strips={arrange("templateStyle", fonts)}
                palette={{ templateColors: [], deck: [] }}
                onChange={(control, value) => setFont(control.field, value)}
              />
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </DesignSection>
  )
}
