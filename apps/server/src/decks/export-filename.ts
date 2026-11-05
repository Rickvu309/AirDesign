export function exportFilename(title:string,seq:number|undefined,format:"pptx"|"pdf") {
  const name=title.replace(/[^a-zA-Z0-9 _-]/g,"_").trim().slice(0,120) || "AirDesign"
  return `${name}-v${seq ?? 0}.${format}`
}
