import { expect, it } from "vitest"
import { slideTextStyles } from "./slide-text-styles.js"

import { encodeUtf8 as bytes } from "./package-bytes.js"
const rel = (type: string, target: string) =>
  bytes(
    `<Relationships><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}" Target="${target}"/></Relationships>`,
  )

it("derives scoped native styles in title and body order, retaining font tokens and scheme colors", () => {
  const parts = new Map([
    ["ppt/slides/_rels/slide1.xml.rels", rel("slideLayout", "../slideLayouts/slideLayout1.xml")],
    ["ppt/slideLayouts/_rels/slideLayout1.xml.rels", rel("slideMaster", "../slideMasters/slideMaster1.xml")],
    [
      "ppt/slideLayouts/slideLayout1.xml",
      bytes('<p:sldLayout><p:cSld name="Cover"><p:spTree/></p:cSld></p:sldLayout>'),
    ],
    [
      "ppt/slideMasters/slideMaster1.xml",
      bytes(
        '<p:sldMaster><p:cSld><p:spTree/></p:cSld><p:txStyles><p:titleStyle><a:lvl1pPr algn="ctr"><a:lnSpc><a:spcPct val="120000"/></a:lnSpc><a:defRPr sz="4400" b="1"><a:solidFill><a:schemeClr val="accent1"/></a:solidFill><a:latin typeface="+mj-lt"/></a:defRPr></a:lvl1pPr></p:titleStyle><p:bodyStyle><a:lvl1pPr><a:defRPr sz="2000"/></a:lvl1pPr><a:lvl2pPr><a:defRPr sz="1600"/></a:lvl2pPr></p:bodyStyle></p:txStyles></p:sldMaster>',
      ),
    ],
  ])
  const styles = slideTextStyles(parts, "ppt/slides/slide1.xml")
  expect(styles.map((style) => style.name)).toEqual(["Title", "Body 1", "Body 2"])
  expect(styles[0]?.fields).toMatchObject({
    font: "+mj-lt",
    size: 4400,
    bold: true,
    color: { scheme: "accent1" },
    align: "center",
    lineSpacing: 120000,
  })
  expect(slideTextStyles(new Map(), "missing")).toEqual([])
})
