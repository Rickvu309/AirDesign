import { createHash } from "node:crypto"

const markupPart = /^ppt\/(slides|notesSlides|slideLayouts|slideMasters)\/[^/]+\.xml$/

const digest = (bytes) => createHash("sha1").update(bytes).digest("hex")

const byPart = (read) => {
  const answers = new Map()
  return (parts) => {
    const rows = []
    for (const [name, bytes] of parts) {
      if (!markupPart.test(name)) {
        rows.push(...read(new Map([[name, bytes]])))
        continue
      }
      const key = `${name}\0${digest(bytes)}`
      let found = answers.get(key)
      if (found === undefined) {
        found = read(new Map([[name, bytes]]))
        answers.set(key, found)
      }
      rows.push(...found)
    }
    return rows
  }
}

export const memoPptx = (pptx) => ({
  ...pptx,
  shapeIdCounts: byPart(pptx.shapeIdCounts),
  branchOrderErrors: byPart(pptx.branchOrderErrors),
  danglingShapeReferences: byPart(pptx.danglingShapeReferences),
})
