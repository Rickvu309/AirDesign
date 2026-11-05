import { useEffect,useState } from "react"
import { waitForFonts } from "../../../../packages/render/src/fonts.ts"
type FontState={kind:"loading"}|{kind:"ready";waitMs:number}|{kind:"failed";message:string}
export function FontReadiness(){
  const [state,setState]=useState<FontState>({kind:"loading"})
  useEffect(()=>{let active=true;const started=performance.now();void waitForFonts(document).then(()=>{if(active)setState({kind:"ready",waitMs:performance.now()-started})}).catch(error=>{if(active)setState({kind:"failed",message:String(error)})});return ()=>{active=false}},[])
  return <p className="editor-status" role={state.kind==="failed" ? "alert" : "status"} data-font-state={state.kind} data-font-wait-ms={state.kind==="ready" ? state.waitMs : undefined} hidden={state.kind==="ready"}>{state.kind==="loading" ? "Loading deck fonts…" : state.kind==="failed" ? state.message : "Deck fonts ready"}</p>
}
