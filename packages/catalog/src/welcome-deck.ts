import {id,themeId,type Deck} from "../../deck/src/index.ts"

export function welcomeDeck():Deck {
  const theme=themeId("welcome")
  const sections=[{title:"A clear proposal. A confident decision.",body:"Welcome to AirDesign. Start with the decision your board needs to make."},{title:"Lead with the recommendation",body:"Set out your recommendation, the evidence behind it, and the tradeoffs."},{title:"Make the next step clear",body:"Name the decision, the owner, and what happens next."}]
  return {id:id("welcome"),version:0,themes:[{id:theme,font:"Geist",background:"#ffffff"}],slides:sections.map((section,index)=>({id:id(`welcome${index}`),version:0,size:{width:960,height:540},theme,source:{kind:"created"},notes:"A sample board proposal. Replace these prompts with your story.",elements:[{id:id(`heading${index}`),kind:"text",box:{x:64,y:80,width:830,height:150},source:{kind:"created"},support:{kind:"native"},theme:null,placeholder:null,overlap:null,runs:[{text:section.title,font:"Geist",size:44,bold:true,color:"#222222"}]},{id:id(`body${index}`),kind:"text",box:{x:64,y:280,width:800,height:150},source:{kind:"created"},support:{kind:"native"},theme:null,placeholder:null,overlap:null,runs:[{text:section.body,font:"Geist",size:24,bold:false,color:"#666666"}]}]}))}
}
