import { describe, expect, it } from "vitest"

import { actionTitles, edgeTitles, topicTitles } from "./testing/slide-titles.js"
import { isTitleLabel } from "./title-label.js"

const finite =
  /\b(am|is|are|was|were|be|been|being|have|has|had|do|does|did|can|could|may|might|shall|should|will|would|must|rose|fell|grew|led|saw|went|made|took|held|met|ran|became|account|continue|drop|face|lead|rise|fall|grow|remain|vary|[a-z]+ed|[a-z]+s)\b/i
const lexicon = (title: string) =>
  !finite.test(title) || /^(overview|summary|agenda)\b|\bby (region|market|year|segment)$/i.test(title)

describe("title-label precision", () => {
  it("compares the two rules against labelled exhibit titles and edge cases", () => {
    const takeaways = Object.values(actionTitles).flat()
    const labels = Object.values(topicTitles).flat()
    const score = (detect: (title: string) => boolean) => ({
      exhibitFalsePositives: takeaways.filter(detect),
      edgeFalsePositives: edgeTitles.filter(detect),
      labelsFound: labels.filter(detect).length,
    })

    expect(score(lexicon)).toMatchObject({ exhibitFalsePositives: [], edgeFalsePositives: edgeTitles.slice(0, 5) })
    expect(score(isTitleLabel)).toEqual({ exhibitFalsePositives: [], edgeFalsePositives: [], labelsFound: 8 })
    for (const label of ["Revenue by region", "Market overview", "Q3 results"]) expect(isTitleLabel(label)).toBe(true)
  })
})
