import theme0 from "./themes/editorial.json" with { type: "json" }
import theme1 from "./themes/fallback.json" with { type: "json" }
import theme2 from "./themes/midnight.json" with { type: "json" }
import theme3 from "./themes/neutral.json" with { type: "json" }

export const themeFiles: Readonly<Record<string, unknown>> = {
  "editorial.json": theme0,
  "fallback.json": theme1,
  "midnight.json": theme2,
  "neutral.json": theme3,
}
