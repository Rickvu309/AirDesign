import { readTheme, type Theme } from "../theme.js"
import values from "./theme.json" with { type: "json" }

export const testTheme: Theme = readTheme(values)
