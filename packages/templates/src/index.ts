type TemplateThemeColors = {
  readonly dk1: string
  readonly lt1: string
  readonly dk2: string
  readonly lt2: string
  readonly accent1: string
  readonly accent2: string
  readonly accent3: string
  readonly accent4: string
  readonly accent5: string
  readonly accent6: string
  readonly hlink: string
  readonly folHlink: string
}

export type TemplateTheme = {
  readonly id: string
  readonly name: string
  readonly map: "light" | "dark"
  readonly colors: TemplateThemeColors
  readonly fonts: { readonly major: string; readonly minor: string }
}

const templateThemes: readonly TemplateTheme[] = [
  {
    id: "neutral",
    name: "Neutral",
    map: "light",
    colors: {
      dk1: "16191D",
      lt1: "FFFFFF",
      dk2: "1B2A4A",
      lt2: "F2F4F7",
      accent1: "2F5BD3",
      accent2: "0E9384",
      accent3: "E08A1E",
      accent4: "7A5AF8",
      accent5: "D92D20",
      accent6: "4E8B2F",
      hlink: "2F5BD3",
      folHlink: "7A5AF8",
    },
    fonts: { major: "Inter SemiBold", minor: "Inter" },
  },
  {
    id: "midnight",
    name: "Midnight",
    map: "dark",
    colors: {
      dk1: "0E1626",
      lt1: "F4F6FA",
      dk2: "1A2438",
      lt2: "9AA6BA",
      accent1: "6B9BFF",
      accent2: "34C3A6",
      accent3: "F5B54A",
      accent4: "A98BFA",
      accent5: "F06A73",
      accent6: "8AD167",
      hlink: "7AA6FF",
      folHlink: "C3A9FF",
    },
    fonts: { major: "Inter SemiBold", minor: "Inter" },
  },
  {
    id: "editorial",
    name: "Editorial",
    map: "light",
    colors: {
      dk1: "231F1C",
      lt1: "FBF8F3",
      dk2: "3A2E26",
      lt2: "EFE8DD",
      accent1: "B4532A",
      accent2: "5F7A4A",
      accent3: "C8962E",
      accent4: "7B4B6E",
      accent5: "2F6F8F",
      accent6: "8C6239",
      hlink: "B4532A",
      folHlink: "7B4B6E",
    },
    fonts: { major: "Source Serif 4 SemiBold", minor: "Inter" },
  },
]

export const deckTemplates: readonly { readonly id: string; readonly name: string }[] = templateThemes.map(
  ({ id, name }) => ({ id, name }),
)

export const blankTemplate = "neutral"

export function templateTheme(id: string): TemplateTheme | undefined {
  return templateThemes.find((each) => each.id === id)
}

export function templateFile(id: string, start = false): string {
  return `files/${id}${start ? "-start" : ""}.pptx`
}

export function startIndexFile(id: string): string {
  return `files/${id}-start.index.json`
}
