export async function within<T>(work:Promise<T>,ms:number,fallback:T):Promise<T>{
  let timer:ReturnType<typeof setTimeout>|undefined
  try{return await Promise.race([work,new Promise<T>(resolve=>{timer=setTimeout(()=>resolve(fallback),ms)})])}
  finally{clearTimeout(timer)}
}
