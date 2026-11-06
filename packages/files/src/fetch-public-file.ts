import {lookup} from "node:dns/promises"
import {request} from "node:https"
import {isIP} from "node:net"
export function publicAddress(address:string):boolean {
  if(isIP(address)===4){const parts=address.split(".").map(Number),a=parts[0] ?? 0,b=parts[1] ?? 0;return !(a===0||a===10||a===127||a>=224||(a===100&&b>=64&&b<=127)||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&(b===0||b===168))||(a===198&&(b===18||b===19)))}
  return isIP(address)===6 && /^[23][0-9a-f]{3}:/i.test(address) && !address.toLowerCase().startsWith("2001:db8:")
}
export async function fetchPublicFile(source:string,limit:number,redirects=0):Promise<{bytes:Buffer;mime:string}> {
  const url=new URL(source)
  if(url.protocol!=="https:"||url.username||url.password||url.hash||(url.port&&url.port!=="443")||redirects>3)throw new Error("unsafe-file-url")
  const addresses=await lookup(url.hostname,{all:true})
  if(!addresses.length||addresses.some(value=>!publicAddress(value.address)))throw new Error("unsafe-file-destination")
  const chosen=addresses[0];if(!chosen)throw new Error("unsafe-file-destination")
  const response=await new Promise<{bytes:Buffer;mime:string}|{location:string}>((resolve,reject)=>{
    const req=request(url,{method:"GET",headers:{accept:"application/octet-stream,text/plain,application/vnd.openxmlformats-officedocument.presentationml.presentation"},lookup:(_host,_options,callback)=>callback(null,chosen.address,chosen.family)},res=>{
      if(res.statusCode && res.statusCode>=300&&res.statusCode<400){res.resume();const location=res.headers.location;if(!location){reject(new Error("file-redirect-missing"));return}resolve({location:new URL(location,url).href});return}
      if(res.statusCode!==200){res.resume();reject(new Error("file-fetch-failed"));return}
      const chunks:Buffer[]=[];let size=0
      res.on("data",(chunk:Buffer)=>{size+=chunk.length;if(size>limit){res.destroy(new Error("file-too-large"));return}chunks.push(chunk)})
      res.on("error",reject);res.on("end",()=>resolve({bytes:Buffer.concat(chunks),mime:(res.headers["content-type"] ?? "application/octet-stream").split(";")[0] ?? "application/octet-stream"}))
    })
    req.setTimeout(5000,()=>req.destroy(new Error("file-fetch-timeout")))
    req.on("error",reject);req.end()
  })
  return "location" in response ? fetchPublicFile(response.location,limit,redirects+1) : response
}
