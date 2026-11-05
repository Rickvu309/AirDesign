import type { ImagePlacement } from "../../../../packages/deck/src/index.ts"
export function focusedCrop(zoom:number,focal:ImagePlacement["focal"]):ImagePlacement["crop"] {
  const size=1/Math.max(1,Math.min(5,zoom))
  return {x:Math.max(0,Math.min(1-size,focal.x-size/2)),y:Math.max(0,Math.min(1-size,focal.y-size/2)),width:size,height:size}
}
export function lowResolution(width:number,height:number,box:{width:number;height:number}) {return width<box.width || height<box.height}
