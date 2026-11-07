import {createServer} from "node:net"
export async function createWithBrowserOrigin<T>(create:(origin:string)=>Promise<T>):Promise<T>{
  const reservation=createServer()
  await new Promise<void>((resolve,reject)=>{reservation.once("error",reject);reservation.listen(0,"127.0.0.1",resolve)})
  try{
    const address=reservation.address()
    if(!address||typeof address==="string")throw new Error("browser-port-missing")
    return await create(`http://127.0.0.1:${address.port}`)
  }finally{await new Promise<void>((resolve,reject)=>reservation.close(error=>error ? reject(error) : resolve()))}
}
