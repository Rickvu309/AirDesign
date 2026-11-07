import {useLayoutEffect,useRef,useState} from "react"
import {fontReport} from "../../../../packages/render/src/fonts.ts"
import {Slide} from "../../../../packages/render/src/index.ts"

export function SlidePreview(props:Parameters<typeof Slide>[0]) {
  const frame=useRef<HTMLDivElement>(null),[scale,setScale]=useState(1)
  useLayoutEffect(()=>{const node=frame.current;if(!node)return;const measure=()=>{const width=node.getBoundingClientRect().width;if(width>0)setScale(width/props.slide.size.width)};measure();if(typeof ResizeObserver==="undefined")return;const observer=new ResizeObserver(measure);observer.observe(node);return ()=>observer.disconnect()},[props.slide.size.width])
  const missing=fontReport(props.slide,props.themes).missing
  return <><div ref={frame} className="slide-preview" style={{aspectRatio:`${props.slide.size.width}/${props.slide.size.height}`}}><div className="slide-canvas" style={{inlineSize:props.slide.size.width,blockSize:props.slide.size.height,transform:`scale(${scale})`}}><Slide {...props}/></div></div>{missing.length>0 && <details className="slide-font-disclosure"><summary>Font substitution</summary><p>Missing fonts: {missing.join(", ")}. Using pinned Geist.</p></details>}</>
}
