import type {NativeDeck} from "../../deck/src/text/native-v3.ts"
import {renderToStaticMarkup} from "react-dom/server"
import {Slide} from "./slide.tsx"
import type {Deck} from "../../deck/src/index.ts"
export function captureDocument(deck:Deck | NativeDeck,slideId:string,fontCss:string,assets:Record<string,string>){
  const slide=deck.slides.find(item=>item.id===slideId)
  if(!slide)throw new Error("slide-not-found")
  return "<!doctype html>"+renderToStaticMarkup(<html><head><meta httpEquiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src data:; img-src data:"/><style>{fontCss+"html,body{margin:0;padding:0}*{box-sizing:border-box}[data-font-warning]{display:none}"}</style></head><body><Slide slide={slide} themes={deck.themes} imageSources={assets}/></body></html>)
}
