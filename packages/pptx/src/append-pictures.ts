import path from "node:path"
import { flatten,type Slide } from "../../deck/src/index.ts"
import { parseXml,escapeXml } from "./xml.ts"

export function appendCreatedPictures(parts:Map<string,Buffer>,native:Map<string,Buffer>,slide:Slide,index:number,prefix:string) {
  if(slide.source.kind!=="original")return
  const part=slide.source.part,generatedPart=`ppt/slides/slide${index+1}.xml`,parsed=parseXml(native.get(generatedPart)!),original=parseXml(parts.get(part)!),tree=original.nodes.find(node=>node.local==="spTree")
  if(!tree)throw new Error("slide-shape-tree-required")
  const additions=flatten(slide.elements).filter(element=>element.source.kind==="created")
  if(additions.some(element=>element.kind!=="image"))throw new Error("source-slide-structure-change-requires-fix")
  const names=new Set<string>(additions.map(element=>element.id)),relationships=parseXml(native.get(`ppt/slides/_rels/slide${index+1}.xml.rels`)!),relPart=path.posix.dirname(part)+"/_rels/"+path.posix.basename(part)+".rels"
  let rels=parts.get(relPart)!.toString(),next=Math.max(1,...original.nodes.filter(node=>node.local==="cNvPr").map(node=>Number(node.attributes.id)))+1,content=""
  for(const picture of parsed.nodes.filter(node=>node.local==="pic")){
    const children=parsed.nodes.filter(node=>node.start>picture.start&&node.end<picture.end),properties=children.find(node=>node.local==="cNvPr")
    if(!properties?.attributes.name||!names.has(properties.attributes.name))continue
    let fragment=parsed.xml.slice(picture.start,picture.end).replace(/(<p:cNvPr\b[^>]*\bid=")[^"]*"/,`$1${next++}"`)
    for(const blip of children.filter(node=>node.local==="blip")){
      const key=blip.attributes["r:embed"],rel=relationships.nodes.find(node=>node.local==="Relationship"&&node.attributes.Id===key)
      if(!rel?.attributes.Target)throw new Error("picture-relationship-required")
      const target=rel.attributes.Target.startsWith("/") ? rel.attributes.Target.slice(1) : path.posix.normalize(path.posix.join("ppt/slides",rel.attributes.Target)),id=`adPicture${next++}`
      fragment=fragment.replace(`r:embed="${key}"`,`r:embed="${id}"`)
      rels=rels.replace("</Relationships>",`<Relationship Id="${id}" Type="${escapeXml(rel.attributes.Type!)}" Target="${escapeXml(path.posix.relative(path.posix.dirname(part),prefix+target))}"/></Relationships>`)
    }
    content+=fragment
  }
  parts.set(part,Buffer.from(original.xml.slice(0,tree.closeStart)+content+original.xml.slice(tree.closeStart)))
  parts.set(relPart,Buffer.from(rels))
  if(slide.layout){
    const generated=relationships.nodes.find(node=>node.local==="Relationship"&&node.attributes.Type?.endsWith("/slideLayout")),saved=parseXml(parts.get(relPart)!),layout=saved.nodes.find(node=>node.local==="Relationship"&&node.attributes.Type?.endsWith("/slideLayout"))
    if(!generated?.attributes.Target||!layout)throw new Error("slide-layout-required")
    const target=path.posix.normalize(path.posix.join("ppt/slides",generated.attributes.Target))
    parts.set(relPart,Buffer.from(saved.xml.slice(0,layout.start)+saved.xml.slice(layout.start,layout.end).replace(/Target="[^"]*"/,`Target="${escapeXml(path.posix.relative(path.posix.dirname(part),prefix+target))}"`)+saved.xml.slice(layout.end)))
  }
}
