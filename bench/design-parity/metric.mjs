import sharp from "sharp"
import {PNG} from "pngjs"
import pixelmatch from "pixelmatch"
export const metricVersion="foreground-edges-v1"
const distance=(a,i,b,j)=>Math.max(Math.abs(a[i]-b[j]),Math.abs(a[i+1]-b[j+1]),Math.abs(a[i+2]-b[j+2]))
function background(data){
  const counts=new Map()
  for(let i=0;i<data.length;i+=4){const key=(data[i]>>3)*1024+(data[i+1]>>3)*32+(data[i+2]>>3);counts.set(key,(counts.get(key)??0)+1)}
  const key=[...counts].sort((a,b)=>b[1]-a[1])[0][0]
  return [(key>>10)*8+4,((key>>5)&31)*8+4,(key&31)*8+4]
}
function foreground(image){
  const bg=background(image.data),mask=new Uint8Array(image.width*image.height)
  for(let i=0;i<mask.length;i++)mask[i]=Number(distance(image.data,i*4,bg,0)>24)
  return mask
}
function near(mask,x,y,width,height,radius){
  for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++)if(x+dx>=0&&x+dx<width&&y+dy>=0&&y+dy<height&&mask[(y+dy)*width+x+dx])return true
  return false
}
function edges(image){
  const {data,width,height}=image,mask=new Uint8Array(width*height)
  const gray=i=>data[i]*0.2126+data[i+1]*0.7152+data[i+2]*0.0722
  for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++){const i=(y*width+x)*4;mask[y*width+x]=Number(Math.max(Math.abs(gray(i-4)-gray(i+4)),Math.abs(gray(i-width*4)-gray(i+width*4)))>32)}
  return mask
}
export async function compareDesign(design,capture){
  const originals=await Promise.all([design,capture].map(async buffer=>PNG.sync.read(await sharp(buffer).ensureAlpha().png().toBuffer())))
  const width=Math.max(...originals.map(image=>image.width)),height=Math.max(...originals.map(image=>image.height))
  const [left,right]=await Promise.all(originals.map(async image=>PNG.sync.read(await sharp(PNG.sync.write(image)).extend({right:width-image.width,bottom:height-image.height,background:"#ffffff"}).png().toBuffer())))
  const diff=new PNG({width,height}),pixels=pixelmatch(left.data,right.data,diff.data,width,height,{threshold:0.1,includeAA:false})
  const masks=originals.map(foreground)
  let ink=0,misses=0
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const active=originals.map((image,k)=>x<image.width&&y<image.height&&masks[k][y*image.width+x])
    if(!active.some(Boolean))continue
    ink++
    const mismatch=originals.some((image,k)=>{
      if(!active[k])return false
      const other=originals[1-k]
      for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
        const ox=x+dx,oy=y+dy
        if(ox>=0&&oy>=0&&ox<other.width&&oy<other.height&&distance(image.data,(y*image.width+x)*4,other.data,(oy*other.width+ox)*4)<=32)return false
      }
      return true
    })
    if(mismatch)misses++
  }
  const small=await Promise.all([left,right].map(async image=>PNG.sync.read(await sharp(PNG.sync.write(image)).resize(Math.ceil(width/2),Math.ceil(height/2)).png().toBuffer())))
  const maps=small.map(edges),counts=[0,0],matched=[0,0]
  for(let k=0;k<2;k++)for(let y=0;y<small[k].height;y++)for(let x=0;x<small[k].width;x++)if(maps[k][y*small[k].width+x]){counts[k]++;if(near(maps[1-k],x,y,small[k].width,small[k].height,1))matched[k]++}
  const precision=counts[0] ? matched[0]/counts[0] : Number(counts[1]===0),recall=counts[1] ? matched[1]/counts[1] : Number(counts[0]===0)
  const edgeLoss=precision+recall ? 1-2*precision*recall/(precision+recall) : 1
  const foregroundLoss=ink ? misses/ink : 0,sizeLoss=1-Math.min(originals[0].width,originals[1].width)*Math.min(originals[0].height,originals[1].height)/(width*height)
  const backgroundLoss=Math.max(0,distance(background(originals[0].data),0,background(originals[1].data),0)-32)/223
  return {score:Math.max(foregroundLoss,edgeLoss,sizeLoss,backgroundLoss),backgroundLoss,foregroundLoss,edgeLoss,sizeLoss,ratio:pixels/(width*height),pixels,left,right,diff,comparison:{width,height,design:{width:originals[0].width,height:originals[0].height},capture:{width:originals[1].width,height:originals[1].height}}}
}
