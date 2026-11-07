export async function downloadArtifact(url:string){
  const response=await fetch(url)
  if(!response.ok)throw new Error("Unable to download the export. Try again.")
  const filename=/filename="([^"]+)"/.exec(response.headers.get("content-disposition") ?? "")?.[1]
  if(!filename)throw new Error("The export filename is unavailable. Try again.")
  const blob=await response.blob(),objectUrl=URL.createObjectURL(blob),link=document.createElement("a")
  link.href=objectUrl;link.download=filename;document.body.append(link)
  try{link.click()}finally{link.remove();setTimeout(()=>URL.revokeObjectURL(objectUrl),1000)}
  return filename
}
