import type { ProblemRules } from "@airdesign/doom"

export const problemRules: ProblemRules = {
  onHeight: 1080,
  loneWord: ["title", "heading", "bigNumber"],
  readable: 24,
  contrast: { min: 4.5, large: { size: 40, min: 3 } },
  thinRule: 4,
}
