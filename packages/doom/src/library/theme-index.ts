import theme0 from "./themes/consulting.json" with { type: "json" }
import theme1 from "./themes/editorial.json" with { type: "json" }
import theme2 from "./themes/fallback.json" with { type: "json" }
import theme3 from "./themes/midnight.json" with { type: "json" }
import theme4 from "./themes/neutral.json" with { type: "json" }
import theme5 from "./themes/technical.json" with { type: "json" }

export const themeFiles: Readonly<Record<string, unknown>> = {
  "consulting.json": theme0,
  "editorial.json": theme1,
  "fallback.json": theme2,
  "midnight.json": theme3,
  "neutral.json": theme4,
  "technical.json": theme5,
}
