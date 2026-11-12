export const stackedFrames = {
  name: "stacked-frames",
  rank: 2,
  reads:
    "closed borders, outlines and ring shadows, and whether one frame sits 2 to 8 px inside another and fills half of it",
  cannot: "whether two frames were meant, such as a focus ring around a bordered field",
  inspect: (element, page) => {
    const outer = page.frameBox(element)
    if (outer === null || page.thumbnail(element) || outer.width < 16 || outer.height < 12) return
    const frames = page.memo("frames", () =>
      page.elements
        .filter((each) => !page.thumbnail(each))
        .map((each) => ({ each, frame: page.frameBox(each) }))
        .filter((row) => row.frame !== null),
    )
    const inner = frames.find(({ each, frame }) => {
      if (each === element) return false
      const gaps = [
        frame.x - outer.x,
        frame.y - outer.y,
        outer.x + outer.width - frame.x - frame.width,
        outer.y + outer.height - frame.y - frame.height,
      ]
      const covers = (frame.width * frame.height) / (outer.width * outer.height)
      return gaps.every((gap) => gap >= -0.5 && gap <= 8) && Math.max(...gaps) >= 2 && covers >= 0.5
    })
    if (inner === undefined) return
    const gap = Math.round(Math.max(inner.frame.x - outer.x, inner.frame.y - outer.y))
    return `Two frames are drawn ${gap} px apart, one inside the other: ${page.describe(element)} around ${page.describe(inner.each)}.`
  },
}
