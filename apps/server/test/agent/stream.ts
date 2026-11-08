export async function eventStream(url:string,cookie:string,headers:Record<string,string>={}){
  const controller=new AbortController(),response=await fetch(url,{headers:{cookie,...headers},signal:controller.signal})
  const reader=response.body?.getReader();if(!reader)throw new Error("missing-event-stream")
  let buffer=""
  return {async next(){for(;;){const split=buffer.indexOf("\n\n");if(split>=0){const event=buffer.slice(0,split);buffer=buffer.slice(split+2);const data=event.split("\n").find(line=>line.startsWith("data: "));if(data)return JSON.parse(data.slice(6))}else{const chunk=await reader.read();if(chunk.done)throw new Error("stream-ended");buffer+=new TextDecoder().decode(chunk.value)}}},async close(){controller.abort();await reader.cancel().catch(()=>undefined)}}
}
export function deferred(){let resolve=()=>{};const promise=new Promise<void>(ready=>{resolve=ready});return {promise,resolve}}
