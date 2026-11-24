import * as doom from "@airdesign/doom"

export function templateNameOf(theme: doom.Theme): string | null {
  const found = Object.values(doom.themeLibrary).find(
    ({ theme: builtIn }) =>
      theme.fonts.heading === builtIn.fonts.heading &&
      theme.colors.accent1 === builtIn.colors.accent1 &&
      theme.colors.accent2 === builtIn.colors.accent2,
  )
  return found?.name ?? null
}
