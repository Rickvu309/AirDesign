const exported = "exported-picture-adjust.pptx"
const slide = "ppt/slides/slide1.xml"
const media = "ppt/media/picture-008753c5d40023df.png"

export default {
  specs: ["tests/browser/picture-adjust.spec.ts"],
  exports: [exported],
  covers: ["fills.blur", "fills.overlay"],
  cases: [
    {
      name: "picture-adjust",
      before: "picture-png.pptx",
      after: exported,
      visible: true,
      targeted: [1],
      errors: 0,
      dupes: 0,
      pages: true,
    },
  ],
  renders: [exported],
  lines(answers) {
    const after = answers.parts.get(exported)
    const before = answers.parts.get("picture-png.pptx")
    if (!after || !before) return ["picture adjust export missing"]
    const xml = new TextDecoder().decode(after.get(slide) ?? new Uint8Array())
    const added = [...after.keys()].filter((name) => name.startsWith("ppt/media/picture-") && name !== media)
    const kept = Buffer.from(after.get(media) ?? []).equals(Buffer.from(before.get(media) ?? []))
    return [
      ...(xml.includes("<a:blur") || xml.includes("<a:fillOverlay")
        ? ["picture adjust left a native blur or overlay in the download"]
        : []),
      ...(xml.includes('cx="4572000"') && xml.includes('cy="3048000"') ? [] : ["picture adjust moved the frame"]),
      ...(added.length === 1 ? [] : ["picture adjust did not bake one picture"]),
      ...(kept ? [] : ["picture adjust changed the original picture bytes"]),
    ]
  },
}
