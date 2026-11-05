import path from "node:path"
import type { Deck } from "../../deck/src/index.ts"
import { importPptx } from "./index.ts"
import { parseXml,escapeXml } from "./xml.ts"

export async function attachTemplateLayouts(parts:Map<string,Buffer>,deck:Deck,sources:Record<string,string>) {
  const used=new Map<string,{prefix:string;masters:Set<string>;layoutMasters:Map<string,string>}>()
  for(const [index,slide] of deck.slides.entries()){
    const layout=slide.layout;if(!layout)continue
    const key=`${layout.template}:${layout.version}`
    let entry=used.get(key)
    if(!entry){
      const source=sources[key];if(!source)throw new Error("template-source-not-found")
      const original=await importPptx(Buffer.from(source,"base64")),prefix=`airdesign-template/${layout.template}-v${layout.version}/`
      entry={prefix,masters:new Set(),layoutMasters:new Map(original.report.relationships.filter(relation=>relation.type.endsWith("/slideMaster")).map(relation=>[relation.part,relation.target]))};used.set(key,entry)
      for(const [name,bytes] of original.parts){
        if(name==="[Content_Types].xml"||name==="_rels/.rels")continue
        let payload=bytes
        if(name.endsWith(".rels")){const parsed=parseXml(bytes);let xml=parsed.xml;for(const node of parsed.nodes.filter(node=>node.local==="Relationship"&&node.attributes.Target?.startsWith("/")).reverse())xml=xml.slice(0,node.start)+parsed.xml.slice(node.start,node.end).replace(/Target="[^"]*"/,`Target="/${prefix}${escapeXml(node.attributes.Target!.slice(1))}"`)+xml.slice(node.end);payload=Buffer.from(xml)}
        parts.set(prefix+name,payload)
      }
      const sourceTypes=parseXml(original.parts.get("[Content_Types].xml")!),types=parts.get("[Content_Types].xml")!.toString(),existing=new Set(parseXml(Buffer.from(types)).nodes.filter(node=>node.local==="Default").map(node=>node.attributes.Extension))
      const additions=sourceTypes.nodes.filter(node=>node.local==="Override").map(node=>`<Override PartName="/${prefix}${escapeXml(node.attributes.PartName!.slice(1))}" ContentType="${escapeXml(node.attributes.ContentType!)}"/>`).join("")+sourceTypes.nodes.filter(node=>node.local==="Default"&&!existing.has(node.attributes.Extension)).map(node=>sourceTypes.xml.slice(node.start,node.end)).join("")
      parts.set("[Content_Types].xml",Buffer.from(types.replace("</Types>",additions+"</Types>")))
    }
    if(!parts.has(entry.prefix+layout.master)||!parts.has(entry.prefix+layout.part))throw new Error("template-layout-not-found")
    if(entry.layoutMasters.get(layout.part)!==layout.master)throw new Error("template-master-layout-mismatch")
    entry.masters.add(layout.master)
    const relPart=`ppt/slides/_rels/slide${index+1}.xml.rels`,parsed=parseXml(parts.get(relPart)!),node=parsed.nodes.find(node=>node.local==="Relationship"&&node.attributes.Type?.endsWith("/slideLayout"))
    if(!node)throw new Error("slide-layout-required")
    parts.set(relPart,Buffer.from(parsed.xml.slice(0,node.start)+parsed.xml.slice(node.start,node.end).replace(/Target="[^"]*"/,`Target="${path.posix.relative("ppt/slides",entry.prefix+layout.part)}"`)+parsed.xml.slice(node.end)))
  }
  let relationships=parts.get("ppt/_rels/presentation.xml.rels")!.toString(),presentation=parts.get("ppt/presentation.xml")!.toString(),ordinal=100000
  for(const entry of used.values())for(const master of entry.masters){const key=`adTemplate${ordinal++}`;relationships=relationships.replace("</Relationships>",`<Relationship Id="${key}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="${path.posix.relative("ppt",entry.prefix+master)}"/></Relationships>`);presentation=presentation.replace("</p:sldMasterIdLst>",`<p:sldMasterId id="${2147483648+ordinal}" r:id="${key}"/></p:sldMasterIdLst>`)}
  parts.set("ppt/_rels/presentation.xml.rels",Buffer.from(relationships));parts.set("ppt/presentation.xml",Buffer.from(presentation))
}
