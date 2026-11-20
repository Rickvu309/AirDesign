import { slideExportLines } from "../slide-export.mjs"

const original = "picture-png.pptx"
const exported = "exported-mask.pptx"
const slide = "ppt/slides/slide1.xml"
const text = (bytes) => new TextDecoder().decode(bytes)
const hidden = '<p:cNvPr id="4" name="Picture 4" hidden="1"/>'
const clipped =
  /<p:pic><p:nvPicPr><p:cNvPr id="\d+" name="Picture 4"\/><p:cNvPicPr\/><p:nvPr\/><\/p:nvPicPr><p:blipFill><a:blip r:embed="rId2"\/><a:srcRect[^>]*\/><a:stretch><a:fillRect\/><\/a:stretch><\/p:blipFill><p:spPr><a:xfrm>.*?<\/a:xfrm><a:prstGeom prst="ellipse">/

const fitted =
  /<p:cNvPr id="\d+" name="Mask group"\/><p:cNvGrpSpPr\/><p:nvPr\/><\/p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="(\d+)" y="(\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"\/>.*?<p:spPr><a:xfrm><a:off x="(\d+)" y="(\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"\/><\/a:xfrm><a:prstGeom prst="ellipse">/

function fitsMask(xml) {
  const found = fitted.exec(xml)
  return found !== null && found.slice(1, 5).join() === found.slice(5, 9).join()
}

export default {
  specs: ["tests/browser/mask.spec.ts"],
  originals: [original],
  exports: [exported],
  covers: ["identity.mask"],
  lines(answers) {
    const before = answers.parts.get(original)
    const after = text(answers.parts.get(exported)?.get(slide))
    const kept = [...(before?.keys() ?? [])].filter((name) => name !== slide)
    return [
      ...slideExportLines({ ...answers, original, exported, kept }),
      ...(after.includes(hidden) ? [] : ["the masked picture is not kept hidden"]),
      ...(clipped.test(after) ? [] : ["the masked picture has no copy with the mask's outline and crop"]),
      ...(fitsMask(after) ? [] : ["the Mask group's box is not its mask's box"]),
    ]
  },
}
