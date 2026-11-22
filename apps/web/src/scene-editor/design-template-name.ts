import type { scene } from "@airdesign/document"
import { deckTemplates, templateTheme } from "@airdesign/templates"

const hexOf = (value: string) => `#${value.toLowerCase()}`

export function templateNameOf(theme: scene.Theme): string | null {
  const found = deckTemplates.find(({ id }) => {
    const template = templateTheme(id)
    return (
      template !== undefined &&
      theme.fonts.heading === template.fonts.major &&
      theme.colors.accent1 === hexOf(template.colors.accent1) &&
      theme.colors.accent2 === hexOf(template.colors.accent2)
    )
  })
  return found?.name ?? null
}
