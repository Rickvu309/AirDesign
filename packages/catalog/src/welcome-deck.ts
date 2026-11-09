import type {NativeDeck} from "../../deck/src/text/native-v3.ts"
import {parseNativeArchiveV3} from "../../deck/src/text/native-v3.ts"
import {parseDeck} from "../../deck/src/index.ts"
import type {TextStyle} from "../../deck/src/text/body.ts"
import {id,themeId,type Deck} from "../../deck/src/index.ts"

export function welcomeDeck(protocol: "legacy-text-v2"): Deck
export function welcomeDeck(protocol?: "paragraph-body-v3"): NativeDeck
export function welcomeDeck(protocol: "legacy-text-v2" | "paragraph-body-v3" = "paragraph-body-v3"): Deck | NativeDeck {
  function textContent(key: string, text: string, style: TextStyle) {
    if (protocol === "legacy-text-v2") return {runs: [{text, ...style}]}
    return {body: {frame: {id: id(`${key}Frame`), kind: "text-frame", anchor: "top", insets: {top: 0, right: 0, bottom: 0, left: 0}, autofit: {kind: "none"}}, paragraphs: [{id: id(`${key}Paragraph`), kind: "paragraph", runs: [{kind: "text", text, style}], endStyle: style, alignment: "left", level: 0, indentation: {left: 0, right: 0, firstLine: 0}, marker: {kind: "none"}, spacing: {before: 0, after: 0, line: {kind: "multiple", value: 1.2}}}]}}
  }
  const theme=themeId("welcome")
  const sections=[{title:"A clear proposal. A confident decision.",body:"Welcome to AirDesign. Start with the decision your board needs to make."},{title:"Lead with the recommendation",body:"Set out your recommendation, the evidence behind it, and the tradeoffs."},{title:"Make the next step clear",body:"Name the decision, the owner, and what happens next."}]
  const deck = {id:id("welcome"),version:0,themes:[{id:theme,font:"Geist",background:"#ffffff"}],slides:sections.map((section,index)=>({id:id(`welcome${index}`),version:0,size:{width:960,height:540},theme,source:{kind:"created"},notes:"A sample board proposal. Replace these prompts with your story.",elements:[{id:id(`heading${index}`),kind:"text",box:{x:64,y:80,width:830,height:150},source:{kind:"created"},support:{kind:"native"},theme:null,placeholder:null,overlap:null,...textContent(`heading${index}`,section.title,{font:"Geist",size:44,bold:true,color:"#222222"})},{id:id(`body${index}`),kind:"text",box:{x:64,y:280,width:800,height:150},source:{kind:"created"},support:{kind:"native"},theme:null,placeholder:null,overlap:null,...textContent(`body${index}`,section.body,{font:"Geist",size:24,bold:false,color:"#666666"})}]}))}
  return protocol === "legacy-text-v2" ? parseDeck(deck) : parseNativeArchiveV3({version: 3, deck}).deck
}
