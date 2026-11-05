import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { ZipFile } from "yazl"
import { createNativePresentation } from "../../packages/pptx/src/native.ts"
import { exportPptx, hash } from "../../packages/pptx/src/index.ts"
import { writeArchive } from "../../packages/pptx/src/archive.ts"

const directory = import.meta.dirname
await mkdir(directory,{ recursive: true })
const native = await createNativePresentation([1,2].map(index => ({ title: `P03 executive slide ${index}`, table: { headers: ["Metric","Value"], rows: [["Revenue","12"],["Margin","24"]] }, chart: { name: "Revenue", labels: ["Q1","Q2"], values: [12,24] }, notes: `P03 confidential speaker note for slide ${index}` })))
const files = new Map<string,Buffer>([["native.pptx",await exportPptx(native)]])
const preserved = new Map(native.parts)
const slideName = "ppt/slides/slide1.xml"
const layoutName = "ppt/slideLayouts/slideLayout1.xml"
const placeholder = '<p:sp><p:nvSpPr><p:cNvPr id="700" name="Inherited placeholder"/><p:cNvSpPr/><p:nvPr><p:ph type="body" idx="7"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>Inherited placeholder content</a:t></a:r></a:p></p:txBody></p:sp>'
const layoutPlaceholder = placeholder.replace('<p:spPr/>','<p:spPr><a:xfrm><a:off x="457200" y="5300000"/><a:ext cx="7000000" cy="400000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>')
const group = '<p:grpSp><p:nvGrpSpPr><p:cNvPr id="800" name="Preserved group"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="9144000" y="914400"/><a:ext cx="914400" cy="457200"/><a:chOff x="0" y="0"/><a:chExt cx="914400" cy="457200"/></a:xfrm></p:grpSpPr><p:sp><p:nvSpPr><p:cNvPr id="801" name="Group rectangle"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="914400" cy="457200"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="2563EB"/></a:solidFill></p:spPr></p:sp></p:grpSp>'
for (const [name,insertion] of [[slideName,group+placeholder],[layoutName,layoutPlaceholder]]) {
  if (!name || !insertion) throw new Error("fixture-part-required")
  const xml = preserved.get(name)?.toString()
  if (!xml?.includes("</p:spTree>")) throw new Error("fixture-sp-tree-required")
  preserved.set(name,Buffer.from(xml.replace("</p:spTree>",insertion+"</p:spTree>")))
}
preserved.set("custom/preserved.xml",Buffer.from('<proof:opaque xmlns:proof="urn:airdesign:p03" stableId="P03-opaque-001"><proof:unknown attr="unchanged">Opaque metadata</proof:unknown></proof:opaque>'))
files.set("preservation.pptx",await writeArchive(preserved))
const unsafe = new Map(preserved)
const relationsName = "ppt/slides/_rels/slide1.xml.rels"
unsafe.set(relationsName,Buffer.from((unsafe.get(relationsName)?.toString() ?? "").replace("</Relationships>",'<Relationship Id="p03-external" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="http://169.254.169.254/latest/meta-data" TargetMode="External"/></Relationships>')))
unsafe.set("ppt/vbaProject.bin",Buffer.from("P03 inert macro marker; no executable code"))
files.set("unsafe.pptx",await writeArchive(unsafe))
const dtd = new Map(preserved)
dtd.set("custom/entity.xml",Buffer.from('<!DOCTYPE x [<!ENTITY secret SYSTEM "file:///etc/passwd">]><x>&secret;</x>'))
files.set("hostile-dtd.pptx",await writeArchive(dtd))
const font = new Map(preserved)
font.set("ppt/fonts/hostile.ttf",Buffer.from([0,1]))
files.set("hostile-font.pptx",await writeArchive(font))
const zip = new ZipFile()
const chunks: Buffer[] = []
const bomb = new Promise<Buffer>((resolve,reject) => { zip.outputStream.on("data",(chunk: Buffer) => chunks.push(chunk)); zip.outputStream.once("end",() => resolve(Buffer.concat(chunks))); zip.outputStream.once("error",reject) })
zip.addBuffer(Buffer.alloc(2*1024*1024),"oversized.bin",{ compress: true, mtime: new Date("2020-01-01T00:00:00Z") })
zip.end()
files.set("hostile-expansion.pptx",await bomb)
for (const [name,bytes] of files) await writeFile(path.join(directory,name),bytes)
await writeFile(path.join(directory,"manifest.json"),JSON.stringify({ license: "CC0-1.0", owner: "rickvu", source: "generate.ts; synthetic local content; no external assets or font files", dependencies: { pptxgenjs: "4.0.1", yazl: "3.3.1" }, fonts: [{ family: "Aptos", fileDistributed: false, license: null, status: "unresolved" }], powerpoint: "unproven-P09-X01", fixtures: [...files].map(([name,bytes]) => ({ name, bytes: bytes.length, sha256: hash(bytes) })) },null,2)+"\n")
process.stdout.write(JSON.stringify({ generated: [...files.keys()] })+"\n")
