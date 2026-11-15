import { slideExportLines } from "../slide-export.mjs"

const original = "clean.pptx"
const slide = "ppt/slides/slide1.xml"
const person = "exported-text-layout.pptx"
const agent = "exported-agent-text-box.pptx"
const laidOut =
  '<a:bodyPr lIns="457200" tIns="45720" rIns="91440" bIns="45720" anchor="b" wrap="none" vert="vert270" numCol="2"/>'
const fitted = '<a:bodyPr anchor="ctr"><a:normAutofit/></a:bodyPr>'
const own = (value) =>
  Object.fromEntries(Object.entries(value).map(([field, set]) => [field, { value: set, own: true }]))

export default {
  specs: ["tests/browser/text-layout.spec.ts", "tests/browser/agent-text-box.spec.ts"],
  exports: [person, agent],
  cases: [
    { name: "browser-text-layout", after: person, visible: true, targeted: [1] },
    { name: "browser-agent-text-box", after: agent, visible: true, targeted: [1] },
  ].map((each) => ({ ...each, before: original, errors: 0, dupes: 0, pages: true })),
  renders: [person, agent],
  covers: ["body.insets", "body.anchor", "body.wrap", "body.autofit", "body.vertical", "body.columns"],
  lines(answers) {
    const decode = (name) => new TextDecoder().decode(answers.parts.get(name)?.get(slide) ?? new Uint8Array())
    const kept = [...(answers.parts.get(original)?.keys() ?? [])].filter((name) => name !== slide)
    const lines = [person, agent].flatMap((exported) =>
      slideExportLines({ ...answers, original, exported, kept }).map((line) =>
        line.replace(/^slide export/, `text box ${exported}`),
      ),
    )
    if (!decode(person).includes(laidOut))
      lines.push("text box did not write the margins, anchor, wrap, direction and columns")
    if (!decode(agent).includes(fitted)) lines.push("text box did not write the agent's autofit and anchor")
    const shown = answers.pptx.shownBody(answers.parts.get(person), { part: slide, shape: "2" })
    const wanted = own({
      insets: { left: 457200, top: 45720, right: 91440, bottom: 45720 },
      anchor: "b",
      wrap: false,
      autofit: "none",
      vertical: "vert270",
      columns: 2,
    })
    if (JSON.stringify(shown) !== JSON.stringify({ ...wanted, autofit: { value: "none", own: false } }))
      lines.push("text box does not read back the body it wrote")
    return lines
  },
}
