const modes = ["fill", "fit", "crop", "tile"]
const exports = modes.map((mode) => `exported-picture-${mode}.pptx`)

export default {
  specs: ["tests/browser/picture-mode.spec.ts"],
  exports,
  covers: ["fills.mode"],
  cases: exports.map((after) => ({
    name: after.slice(0, -5),
    before: "picture-png.pptx",
    after,
    visible: true,
    targeted: [1],
    errors: 0,
    dupes: 0,
    pages: true,
  })),
  renders: exports,
  lines(answers) {
    return modes.flatMap((mode, index) => {
      const parts = answers.parts.get(exports[index])
      if (!parts) return [`picture ${mode} export missing`]
      const shown = answers.pptx.shownPictureMode(parts, { part: "ppt/slides/slide1.xml", shape: "4" })
      const original = answers.parts.get("picture-png.pptx")
      const changed = [...(original ?? [])].filter(
        ([name, bytes]) =>
          name !== "ppt/slides/slide1.xml" && !Buffer.from(bytes).equals(Buffer.from(parts.get(name) ?? [])),
      )
      return [
        ...(shown === mode ? [] : [`picture ${mode} did not export native placement`]),
        ...(changed.length === 0 ? [] : [`picture ${mode} changed unrelated parts`]),
      ]
    })
  },
}
