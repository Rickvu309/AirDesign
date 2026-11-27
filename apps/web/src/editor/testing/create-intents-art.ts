import * as doom from "@airdesign/doom"
import { testTheme } from "@airdesign/doom/testing"

export const darkTheme: doom.Theme = {
  ...testTheme,
  colors: { ...testTheme.colors, text: "#f4f6fa", background2: "#1a2438" },
}
