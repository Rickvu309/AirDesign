import { sameValue } from "./changing-writes.js"
import { type LibraryTheme, type Theme, themeLibrary } from "./theme.js"

export function libraryThemeOf(theme: Theme): LibraryTheme | undefined {
  return Object.values(themeLibrary).find((entry) => sameValue(entry.theme, theme))
}
