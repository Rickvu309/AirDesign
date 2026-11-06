import path from "node:path"
export function jobPath(filename:string): string {
  return path.join(process.env.AIRDESIGN_JOB_DIRECTORY ?? "/job",filename)
}
