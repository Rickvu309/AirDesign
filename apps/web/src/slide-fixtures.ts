import { decide, elementId, openRegister, type Register } from "@airdesign/document"

export function xml(text: string): Uint8Array {
  return new TextEncoder().encode(text)
}

export function onSlide(slide: Uint8Array): Map<string, Uint8Array> {
  const presentation = `<p:presentation><p:sldIdLst><p:sldId id="256" r:id="rId2"/></p:sldIdLst></p:presentation>`
  const rels = `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/></Relationships>`
  return new Map([
    ["ppt/presentation.xml", xml(presentation)],
    ["ppt/_rels/presentation.xml.rels", xml(rels)],
    ["ppt/slides/slide1.xml", slide],
  ])
}

export function editedRegister(edits: readonly (readonly [string, string])[]): Register {
  let register = openRegister("", "clean")
  for (const [id, value] of edits) {
    if (!register.nodes.includes(elementId(id))) {
      const added = decide(register, { command: "add", node: elementId(id), floor: "", route: register.route })
      if (added.decision === "refuse") throw new Error("refused")
      register = added.register
    }
    const edited = decide(register, { command: "person", value, node: elementId(id) })
    if (edited.decision === "refuse") throw new Error("refused")
    register = edited.register
  }
  return register
}

export const twoBoxSlide = `<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:sp><p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:p><a:r><a:t>Hello</a:t></a:r></a:p></p:txBody></p:sp><p:sp><p:nvSpPr><p:cNvPr id="3" name="Body"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:p><a:r><a:t>World</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`

export const fallbackSlide = `<p:sld><p:cSld><p:spTree><mc:AlternateContent><mc:Choice Requires="x"><p:sp><p:nvSpPr><p:cNvPr id="6" name="C"/></p:nvSpPr><p:txBody><a:bodyPr/><a:p><a:r><a:t>Choice</a:t></a:r></a:p></p:txBody></p:sp></mc:Choice><mc:Fallback><p:sp><p:nvSpPr><p:cNvPr id="2" name="F"/></p:nvSpPr><p:txBody><a:bodyPr/><a:p><a:r><a:t>One</a:t></a:r></a:p><a:p><a:r><a:rPr b="1"/><a:t>Two</a:t></a:r></a:p><a:p><a:r><a:t>Three</a:t></a:r></a:p></p:txBody></p:sp></mc:Fallback></mc:AlternateContent><p:sp><p:nvSpPr><p:cNvPr id="2" name="P"/></p:nvSpPr><p:txBody><a:bodyPr/><a:p><a:r><a:t>Keep</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`
