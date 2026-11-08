export async function localFixture<T>(start:()=>Promise<T>):Promise<T>{
  const previous=process.env.NODE_ENV
  process.env.NODE_ENV="test"
  try{return await start()}finally{
    if(previous===undefined)delete process.env.NODE_ENV
    else process.env.NODE_ENV=previous
  }
}
