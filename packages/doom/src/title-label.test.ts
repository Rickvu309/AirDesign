import { describe, expect, it } from "vitest"

import {
  actionTitles,
  consultingTakeaways,
  consultingTopics,
  edgeTitles,
  heldOutTakeaways,
  imperativeTakeaways,
  topicTitles,
} from "./testing/slide-titles.js"
import { isTitleLabel } from "./title-label.js"

describe("title-label precision", () => {
  it("leaves the takeaways and structural titles clear", () => {
    const takeaways = [
      ...Object.values(actionTitles).flat(),
      ...edgeTitles,
      ...consultingTakeaways,
      ...heldOutTakeaways,
      ...imperativeTakeaways,
      "Executive summary",
      "Next steps",
    ]
    expect(takeaways.filter(isTitleLabel)).toEqual([])
  })

  it("keeps noun uses of ambiguous action words eligible for advice", () => {
    const topics = ["Shift performance", "Exit strategy", "Launch timeline", "Fund performance", "Delay analysis"]
    expect(topics.filter(isTitleLabel)).toEqual(topics)
  })

  it("identifies the topics supported by the head nouns and dimensions", () => {
    expect(consultingTopics.filter((title) => !isTitleLabel(title))).toEqual([
      "Market size and growth",
      "Sales performance by quarter",
    ])
    expect(Object.values(topicTitles).flat().filter(isTitleLabel)).toHaveLength(15)
  })
})
