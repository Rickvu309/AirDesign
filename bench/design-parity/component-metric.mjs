import sharp from "sharp"
import {compareDesign} from "./metric.mjs"
export async function cropComponent(image,box){
  const metadata=await sharp(image).metadata()
  const left=Math.floor(box.left??box.x),top=Math.floor(box.top??box.y)
  const width=Math.ceil((box.left??box.x)+box.width)-left,height=Math.ceil((box.top??box.y)+box.height)-top
  if(![left,top,width,height].every(Number.isFinite)||left<0||top<0||width<=0||height<=0||left+width>metadata.width||top+height>metadata.height)throw new Error("invalid-component-box")
  return sharp(image).extract({left,top,width,height}).png().toBuffer()
}
export async function faithfulReference(image){
  const {width,height}=await sharp(image).metadata()
  return sharp(image).extract({left:0,top:0,width:width-1,height:height-1}).extend({left:1,top:1,right:0,bottom:0,background:"#ffffff"}).blur(0.3).png().toBuffer()
}
export async function compareComponent(design,capture,designBox,captureBox){
  const left=await cropComponent(design,designBox),right=await cropComponent(capture,captureBox)
  return {design:left,capture:right,metric:await compareDesign(left,right)}
}
