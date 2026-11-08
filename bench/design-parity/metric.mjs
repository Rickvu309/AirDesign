import sharp from "sharp"
import {PNG} from "pngjs"
import pixelmatch from "pixelmatch"
export const metricVersion="local-oklab-v2"
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
const linear=Array.from({length:256},(_,value)=>{const c=value/255;return c<=0.04045 ? c/12.92 : ((c+0.055)/1.055)**2.4})
function labImage(image){
  const cache=new Map(),result=new Float32Array(image.width*image.height*3)
  for(let i=0;i<image.data.length;i+=4){
    const key=image.data[i]*65536+image.data[i+1]*256+image.data[i+2]
    let lab=cache.get(key)
    if(!lab){
      const r=linear[image.data[i]],g=linear[image.data[i+1]],b=linear[image.data[i+2]]
      const l=Math.cbrt(0.4122214708*r+0.5363325363*g+0.0514459929*b),m=Math.cbrt(0.2119034982*r+0.6806995451*g+0.1073969566*b),s=Math.cbrt(0.0883024619*r+0.2817188376*g+0.6299787005*b)
      lab=[0.2104542553*l+0.793617785*m-0.0040720468*s,1.9779984951*l-2.428592205*m+0.4505937099*s,0.0259040371*l+0.7827717662*m-0.808675766*s]
      cache.set(key,lab)
    }
    result.set(lab,i/4*3)
  }
  return result
}
const labDistanceSquared=(a,i,b,j)=>{const l=a[i]-b[j],c=a[i+1]-b[j+1],h=a[i+2]-b[j+2];return l*l+c*c+h*h}
function localFidelity(images,masks,width,height){
  const labs=images.map(labImage),regions=Array.from({length:96},(_,index)=>({column:index%12,row:Math.floor(index/12),foreground:0,background:0,foregroundMisses:0,backgroundMisses:0}))
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const region=regions[Math.min(7,Math.floor(y/height*8))*12+Math.min(11,Math.floor(x/width*12))]
    const active=images.map((image,k)=>x<image.width&&y<image.height&&masks[k][y*image.width+x])
    const category=active.some(Boolean) ? "foreground" : "background"
    region[category]++
    const mismatch=Math.max(...images.map((image,k)=>{
      if(x>=image.width||y>=image.height)return 1
      const other=images[1-k],i=(y*image.width+x)*3
      let closest=x<other.width&&y<other.height ? labDistanceSquared(labs[k],i,labs[1-k],(y*other.width+x)*3) : 1
      if(closest<=0.025**2)return 0
      for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){
        const ox=x+dx,oy=y+dy
        if(ox>=0&&oy>=0&&ox<other.width&&oy<other.height&&Boolean(masks[1-k][oy*other.width+ox])===Boolean(active[k])){
          closest=Math.min(closest,labDistanceSquared(labs[k],i,labs[1-k],(oy*other.width+ox)*3))
          if(closest<=0.025**2)return 0
        }
      }
      return Math.min(1,(Math.sqrt(closest)-0.025)/0.1)
    }))
    region[category+"Misses"]+=mismatch
  }
  const loss=region=>{const floor=(region.foreground+region.background)*0.03;if(!floor)return 0;return Math.max(region.foregroundMisses/Math.max(floor,region.foreground),region.backgroundMisses/Math.max(floor,region.background))}
  const total=regions.reduce((sum,region)=>Object.fromEntries(Object.keys(sum).map(key=>[key,sum[key]+region[key]])),{foreground:0,background:0,foregroundMisses:0,backgroundMisses:0})
  const scored=regions.map(region=>({...region,score:loss(region)})),worstRegion=scored.reduce((a,b)=>a.score>=b.score ? a : b)
  return {colorLoss:loss(total),localLoss:worstRegion.score,worstRegion,regions:scored}
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
  const fidelity=localFidelity(originals,masks,width,height)
  const globalScore=Math.max(foregroundLoss,edgeLoss,sizeLoss,backgroundLoss,fidelity.colorLoss)
  return {...fidelity,globalScore,score:Math.max(globalScore,fidelity.localLoss),backgroundLoss,foregroundLoss,edgeLoss,sizeLoss,ratio:pixels/(width*height),pixels,left,right,diff,comparison:{width,height,design:{width:originals[0].width,height:originals[0].height},capture:{width:originals[1].width,height:originals[1].height}}}
}
