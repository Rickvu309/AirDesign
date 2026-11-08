import { renderToStaticMarkup } from "react-dom/server"
import { Slide } from "../../../../packages/render/src/index.ts"
import type { Deck } from "../../../../packages/deck/src/index.ts"
import { fontManifest } from "../../../../packages/render/src/font-manifest.ts"

export function renderDocument(deck:Deck,seq:number,fontCss:string,digest:string,assets:Record<string,string>={}) {
  return "<!doctype html>"+renderToStaticMarkup(<html><head><meta charSet="utf-8"/><title>{`AirDesign ${deck.id} saved version ${seq} ${digest}`}</title><meta httpEquiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src data:; img-src data:"/><style>{fontCss+`html,body{margin:0;padding:0;font-family:Geist}*{box-sizing:border-box}[data-font-warning]{display:none}.export-slide{break-after:page;position:relative}.export-slide:last-child{break-after:auto}`}</style></head><body data-saved-version={seq} data-font-manifest={JSON.stringify(fontManifest)}>{deck.slides.map(slide=><section key={slide.id} className="export-slide" style={{width:slide.size.width,height:slide.size.height,overflow:"hidden"}}><Slide slide={slide} themes={deck.themes} imageSources={assets}/></section>)}</body></html>)
}
